"""
Muhimmat AI Backend — Full analytics engine.

Endpoints:
  POST /predict-orders    → Forecast daily/monthly orders using ML
  POST /predict-salary    → Forecast monthly salary based on current performance
  POST /best-driver       → Identify top-performing driver
  POST /best-employee     → Rank employees by composite performance score
  POST /top-platform      → Rank platforms by order volume & growth
  POST /smart-alerts      → Generate operational alerts from data patterns
  POST /detect-anomalies  → Detect salary, order, and deduction anomalies
  GET  /health            → Liveness check (no auth required)

Security:
  - API key auth via X-Internal-Key header (when AI_INTERNAL_KEY env var is set)
  - In-memory per-IP rate limiting: MAX_REQUESTS_PER_WINDOW per RATE_LIMIT_WINDOW_SECS
  - Request size capped at 2 MB by Uvicorn (--limit-max-requests)
  - CORS restricted to configured origins
"""

import hmac
import os
import time
import hashlib
import threading

from fastapi import FastAPI, Depends, Request, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import (
    predict_orders,
    predict_salary_forecast,
    find_best_driver,
    rank_employees,
    rank_platforms,
    generate_smart_alerts,
    detect_anomalies,
    analyze_salary,
)

# ─── Configuration ────────────────────────────────────────────────────────────

# If set, every protected endpoint MUST include this value in X-Internal-Key.
# When unset (dev default), auth is SKIPPED and a warning is printed at startup.
AI_INTERNAL_KEY: str | None = os.getenv("AI_INTERNAL_KEY")

# Rate limiting: max N requests per IP per window (seconds)
MAX_REQUESTS_PER_WINDOW: int = int(os.getenv("RATE_LIMIT_MAX", "60"))
RATE_LIMIT_WINDOW_SECS: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_CLEANUP_EVERY_SECS: int = int(os.getenv("RATE_LIMIT_CLEANUP_EVERY", "300"))

if AI_INTERNAL_KEY:
    _masked = AI_INTERNAL_KEY[:4] + "****"
    print(f"[security] API key auth ENABLED (key={_masked})")
else:
    print(
        "[security] WARNING: AI_INTERNAL_KEY is not set — "
        "endpoint authentication is DISABLED. Set this variable in production."
    )

# ── Production guard ──────────────────────────────────────────────────────────
_ENV = os.getenv("ENV", "development").lower()
if _ENV == "production" and not AI_INTERNAL_KEY:
    raise SystemExit(
        "[security] FATAL: AI_INTERNAL_KEY must be set when ENV=production.\n"
        "Generate one with:  openssl rand -hex 32\n"
        "Then add it to your environment secrets."
    )

# ─── Rate Limiter ─────────────────────────────────────────────────────────────

_rate_lock = threading.Lock()
# { ip_hash: (window_start_ts, request_count) }
# FIX #14: Use plain dict with .get() instead of defaultdict.
# defaultdict auto-creates an entry on any key read, causing unbounded memory growth
# (every unique IP hash creates a permanent entry even if it never exceeds the limit).
_rate_store: dict[str, tuple[float, int]] = {}
_last_rate_cleanup = 0.0


_TRUSTED_PROXIES = {p.strip() for p in os.getenv("TRUSTED_PROXIES", "").split(",") if p.strip()}


def _get_client_ip(request: Request) -> str:
    """Extract real client IP, honouring X-Forwarded-For only from trusted proxies."""
    peer = request.client.host if request.client else "unknown"
    if peer in _TRUSTED_PROXIES:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
            if parts:
                # FIX #13: The LEFTMOST entry is the real client IP.
                # Each proxy appends to the RIGHT, so parts[-1] gives the last proxy's IP.
                # RFC 7239 / de-facto standard: take parts[0] for the originating client.
                return parts[0]
    return peer


def _cleanup_rate_store(now: float) -> None:
    """Drop expired buckets so the in-memory rate-limit store does not grow forever."""
    global _last_rate_cleanup

    if now - _last_rate_cleanup < RATE_LIMIT_CLEANUP_EVERY_SECS:
        return

    expiry_cutoff = now - RATE_LIMIT_WINDOW_SECS
    stale_keys = [
        ip_key for ip_key, (window_start, _count) in _rate_store.items()
        if window_start < expiry_cutoff
    ]
    for ip_key in stale_keys:
        _rate_store.pop(ip_key, None)

    _last_rate_cleanup = now


import redis

REDIS_URL = os.getenv("REDIS_URL")
if REDIS_URL:
    rate_store = redis.Redis.from_url(REDIS_URL)
else:
    rate_store = None

def check_rate_limit(request: Request) -> None:
    """Raise 429 if the caller exceeds the configured rate limit."""
    ip = _get_client_ip(request)
    
    if rate_store:
        try:
            key = f"rate_limit:{ip}"
            count = rate_store.incr(key)
            if count == 1:
                rate_store.expire(key, RATE_LIMIT_WINDOW_SECS)
            if count > MAX_REQUESTS_PER_WINDOW:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Limit: {MAX_REQUESTS_PER_WINDOW} per {RATE_LIMIT_WINDOW_SECS}s.",
                    headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECS)},
                )
            return
        except redis.RedisError:
            pass # Fallback to in-memory on Redis error

    # In-memory fallback
    ip_key = hashlib.sha256(ip.encode()).hexdigest()[:16]
    now = time.monotonic()
    with _rate_lock:
        _cleanup_rate_store(now)
        window_start, count = _rate_store.get(ip_key, (0.0, 0))
        if now - window_start >= RATE_LIMIT_WINDOW_SECS:
            _rate_store[ip_key] = (now, 1)
        else:
            count += 1
            if count > MAX_REQUESTS_PER_WINDOW:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Limit: {MAX_REQUESTS_PER_WINDOW} per {RATE_LIMIT_WINDOW_SECS}s.",
                    headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECS)},
                )
            _rate_store[ip_key] = (window_start, count)


def verify_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Validate the shared internal API key (only when configured)."""
    if not AI_INTERNAL_KEY:
        return  # Auth disabled — dev/test mode
    if not x_internal_key:
        raise HTTPException(status_code=401, detail="Missing X-Internal-Key header.")
    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(AI_INTERNAL_KEY, x_internal_key):
        raise HTTPException(status_code=403, detail="Invalid X-Internal-Key.")


# Combined dependency: rate limit first, then key check
def _security(request: Request, x_internal_key: str | None = Header(default=None)) -> None:
    check_rate_limit(request)
    verify_internal_key(x_internal_key)


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Muhimmat AI Engine",
    version="2.0.0",
    # Hide schema docs in production to reduce attack surface
    docs_url=None if AI_INTERNAL_KEY else "/docs",
    redoc_url=None if AI_INTERNAL_KEY else "/redoc",
)

# Get allowed origins from environment or use safe defaults
ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:5000" # NOSONAR
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # NOSONAR
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Internal-Key"],
    max_age=600,
)


# ─── Request / Response schemas ───────────────────────────────────────────────


class DayRecord(BaseModel):
    date: str
    orders: float
    app_name: str | None = None
    employee_id: str | None = None
    employee_name: str | None = None


class PredictOrdersRequest(BaseModel):
    history: list[DayRecord] = Field(..., min_length=1, max_length=1000)
    forecast_days: int = Field(7, ge=1, le=90)


class PredictOrdersResponse(BaseModel):
    daily_forecast: list[dict]
    monthly_total_predicted: float
    trend: str  # "up" | "down" | "stable"
    trend_percent: float
    confidence: str  # "high" | "medium" | "low"


class BestDriverRequest(BaseModel):
    history: list[DayRecord] = Field(..., min_length=1, max_length=1000)
    top_n: int = Field(5, ge=1, le=50)


class DriverRank(BaseModel):
    employee_id: str
    employee_name: str
    total_orders: int
    daily_avg: float
    trend: str
    trend_percent: float
    consistency_score: float


class BestDriverResponse(BaseModel):
    drivers: list[DriverRank]


class TopPlatformRequest(BaseModel):
    history: list[DayRecord] = Field(..., min_length=1, max_length=1000)


class PlatformRank(BaseModel):
    app_name: str
    total_orders: int
    share_percent: float
    growth_percent: float
    avg_daily: float


class TopPlatformResponse(BaseModel):
    platforms: list[PlatformRank]


class SmartAlertsRequest(BaseModel):
    history: list[DayRecord] = Field(..., min_length=7, max_length=1000)
    thresholds: dict = Field(default_factory=lambda: {
        "low_demand_drop_percent": -20,
        "high_demand_spike_percent": 30,
        "driver_drop_percent": -25,
    })


class Alert(BaseModel):
    type: str  # "low_demand" | "high_demand" | "driver_drop" | "driver_spike"
    severity: str  # "warning" | "critical" | "info"
    message: str
    value: float
    entity: str | None = None


class SmartAlertsResponse(BaseModel):
    alerts: list[Alert]


class SalaryAnalysisRequest(BaseModel):
    base_salary: float = Field(..., ge=0, le=1_000_000)
    orders: int = Field(..., ge=0, le=100_000)
    bonus: float = Field(0, ge=0, le=1_000_000)


class SalaryAnalysisResponse(BaseModel):
    expected_salary: float
    risk: str  # "underpaid" | "normal" | "overpaid"
    diff_percent: float


# ─── New AI Systems Schemas ─────────────────────────────────────────────────


class SalaryForecastRequest(BaseModel):
    current_orders: int = Field(..., ge=0, le=100_000, description="Orders completed so far this month")
    days_passed: int = Field(..., ge=1, le=31, description="Days passed in current month")
    avg_order_value: float = Field(5.0, ge=0, le=10_000, description="Average earnings per order")
    base_salary: float = Field(0, ge=0, le=1_000_000, description="Fixed base salary component")
    working_days_per_month: int = Field(30, ge=1, le=31)


class SalaryForecastResponse(BaseModel):
    predicted_monthly_salary: float
    current_daily_avg: float
    projected_monthly_orders: int
    confidence: str  # "high" | "medium" | "low"
    trend: str  # "on_track" | "above_target" | "below_target"
    days_remaining: int


class EmployeeRecord(BaseModel):
    employee_id: str = Field(..., max_length=200)
    employee_name: str = Field(..., max_length=200)
    total_orders: int = Field(0, ge=0, le=100_000)
    attendance_days: int = Field(0, ge=0, le=366)
    error_count: int = Field(0, ge=0, le=10_000)
    late_days: int = Field(0, ge=0, le=366)
    salary: float = Field(0, ge=0, le=1_000_000)
    avg_orders_per_day: float = Field(0, ge=0, le=10_000)


class BestEmployeeRequest(BaseModel):
    employees: list[EmployeeRecord] = Field(..., min_length=1, max_length=500)
    top_n: int = Field(5, ge=1, le=50)


class EmployeeRank(BaseModel):
    employee_id: str
    employee_name: str
    composite_score: float
    rank: int
    total_orders: int
    attendance_rate: float
    error_rate: float
    performance_tier: str  # "excellent" | "good" | "average" | "needs_improvement"


class BestEmployeeResponse(BaseModel):
    employees: list[EmployeeRank]
    best_employee: EmployeeRank | None


class AnomalyDetectionRequest(BaseModel):
    employee_id: str = Field(..., max_length=200)
    employee_name: str = Field(..., max_length=200)
    current_salary: float = Field(..., ge=0, le=1_000_000)
    # FIX #16: JSON has no tuple type — Pydantic v2 may silently drop/truncate values.
    # Using two explicit fields is safer, self-documenting, and enables proper validation.
    expected_salary_min: float = Field(..., ge=0, description="Minimum expected salary")
    expected_salary_max: float = Field(..., ge=0, description="Maximum expected salary")
    monthly_orders: int = Field(..., ge=0, le=100_000)
    previous_month_orders: int = Field(..., ge=0, le=100_000)
    deductions: float = Field(0, ge=0, le=1_000_000)
    deduction_reasons: list[str] = Field(default_factory=list, max_length=50)

    def model_post_init(self, __context: object) -> None:
        # FIX #16: Validate that min <= max to catch inverted ranges early.
        if self.expected_salary_min > self.expected_salary_max:
            raise ValueError(
                f"expected_salary_min ({self.expected_salary_min}) must be "
                f"<= expected_salary_max ({self.expected_salary_max})"
            )



class Anomaly(BaseModel):
    type: str  # "low_salary" | "order_drop" | "high_deductions" | "attendance_issue"
    severity: str  # "critical" | "warning" | "info"
    message: str
    value: float
    threshold: float
    recommendation: str


class AnomalyDetectionResponse(BaseModel):
    anomalies: list[Anomaly]
    overall_risk_score: float  # 0-100
    risk_level: str  # "low" | "medium" | "high" | "critical"


# ─── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    """Liveness check — no auth required."""
    return {"status": "ok", "version": "2.0.0"}


@app.post(
    "/predict-orders",
    response_model=PredictOrdersResponse,
    dependencies=[Depends(_security)],
    responses={413: {"description": "Payload or input history exceeds the allowed size limit."}},
)
def api_predict_orders(request: Request, req: PredictOrdersRequest):
    content_length = request.headers.get('content-length')
    if content_length and int(content_length) > 100_000:
        raise HTTPException(status_code=413, detail="Payload too large")

    total_chars = sum(len(str(r.model_dump())) for r in req.history)
    if total_chars > 50_000:
        raise HTTPException(status_code=413, detail="Input history too large")

    rows = [d.model_dump() for d in req.history]
    return predict_orders(rows, req.forecast_days)


@app.post("/best-driver", response_model=BestDriverResponse, dependencies=[Depends(_security)])
def api_best_driver(req: BestDriverRequest):
    rows = [d.model_dump() for d in req.history]
    return find_best_driver(rows, req.top_n)


@app.post("/top-platform", response_model=TopPlatformResponse, dependencies=[Depends(_security)])
def api_top_platform(req: TopPlatformRequest):
    rows = [d.model_dump() for d in req.history]
    return rank_platforms(rows)


@app.post("/smart-alerts", response_model=SmartAlertsResponse, dependencies=[Depends(_security)])
def api_smart_alerts(req: SmartAlertsRequest):
    rows = [d.model_dump() for d in req.history]
    return generate_smart_alerts(rows, req.thresholds)


@app.post("/analyze", response_model=SalaryAnalysisResponse, dependencies=[Depends(_security)])
def api_analyze_salary(req: SalaryAnalysisRequest):
    return analyze_salary(req.base_salary, req.orders, req.bonus)


@app.post("/predict-salary", response_model=SalaryForecastResponse, dependencies=[Depends(_security)])
def api_predict_salary(req: SalaryForecastRequest):
    """Predict monthly salary based on current performance."""
    return predict_salary_forecast(
        current_orders=req.current_orders,
        days_passed=req.days_passed,
        avg_order_value=req.avg_order_value,
        base_salary=req.base_salary,
        working_days_per_month=req.working_days_per_month,
    )


@app.post("/best-employee", response_model=BestEmployeeResponse, dependencies=[Depends(_security)])
def api_best_employee(req: BestEmployeeRequest):
    """Rank employees by composite performance score."""
    return rank_employees([e.model_dump() for e in req.employees], req.top_n)


@app.post("/detect-anomalies", response_model=AnomalyDetectionResponse, dependencies=[Depends(_security)])
def api_detect_anomalies(req: AnomalyDetectionRequest):
    """Detect anomalies in salary, orders, and deductions."""
    return detect_anomalies(req.model_dump())
