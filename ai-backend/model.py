"""
ML model layer for the Muhimmat AI engine.

Uses scikit-learn (LinearRegression) and pandas for:
  - Order forecasting (linear trend on daily time-index)
  - Driver ranking & trend detection
  - Platform ranking
  - Smart alert generation

Notes:
  - A minimum of 30 data points is recommended for reliable forecasts.
    Functions return confidence="low" when fewer samples are available.
  - All forecast values are clipped at zero (no negative order counts).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


# ─── Shared helpers ───────────────────────────────────────────────────────────


def _prepare_time_df(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    if not df.empty and "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    return df


def _classify_trend(pct: float) -> str:
    """Classify a percentage change as up / stable / down."""
    if pct > 5:
        return "up"
    if pct < -5:
        return "down"
    return "stable"


def _classify_forecast_confidence(n_days: int) -> str:
    """Return forecast confidence tier based on sample size."""
    if n_days >= 21:
        return "high"
    if n_days >= 7:
        return "medium"
    return "low"


def _half_trend_pct(series: pd.Series) -> float:
    """Return % change from first half to second half of a time series."""
    if len(series) < 4:
        return 0.0
    mid = len(series) // 2
    first_half = series.iloc[:mid].mean()
    second_half = series.iloc[mid:].mean()
    return float(((second_half - first_half) / first_half * 100) if first_half > 0 else 0)


# ─── 1. Predict Orders ───────────────────────────────────────────────────────


def predict_orders(rows: list[dict], forecast_days: int = 7) -> dict:
    """Train on daily order totals, predict the next N days."""
    forecast_days = min(max(int(forecast_days), 1), 90)
    df = _prepare_time_df(rows)
    if df.empty or "date" not in df.columns:
        return {
            "daily_forecast": [],
            "monthly_total_predicted": 0.0,
            "trend": "stable",
            "trend_percent": 0.0,
            "confidence": "low",
        }
    daily = df.groupby("date")["orders"].sum().reset_index().sort_values("date")
    daily["day_idx"] = range(len(daily))

    X = daily[["day_idx"]].values
    y = daily["orders"].values

    # This forecast only uses a single time-index feature, so a linear trend is
    # much cheaper than re-training a random forest on every request and more
    # stable for extrapolation.
    model = LinearRegression()
    model.fit(X, y)

    # Forecast
    start_idx = len(daily)
    future_idx = np.array([[start_idx + i] for i in range(forecast_days)])
    predictions = model.predict(future_idx)
    predictions = np.maximum(predictions, 0)  # no negative orders

    last_date = daily["date"].iloc[-1]
    forecast = []
    for i, pred in enumerate(predictions):
        forecast_date = last_date + pd.Timedelta(days=i + 1)
        forecast.append({
            "date": forecast_date.strftime("%Y-%m-%d"),
            "predicted_orders": round(float(pred), 1),
        })

    monthly_predicted = float(np.sum(predictions))

    # Trend analysis (last 7 vs previous 7)
    if len(daily) >= 14:
        recent = daily["orders"].iloc[-7:].mean()
        previous = daily["orders"].iloc[-14:-7].mean()
        trend_pct = ((recent - previous) / previous * 100) if previous > 0 else 0
    elif len(daily) >= 7:
        recent = daily["orders"].iloc[-3:].mean()
        previous = daily["orders"].iloc[:-3].mean()
        trend_pct = ((recent - previous) / previous * 100) if previous > 0 else 0
    else:
        trend_pct = 0.0

    return {
        "daily_forecast": forecast,
        "monthly_total_predicted": round(monthly_predicted, 1),
        "trend": _classify_trend(trend_pct),
        "trend_percent": round(trend_pct, 1),
        "confidence": _classify_forecast_confidence(len(daily)),
    }


# ─── 2. Best Driver ──────────────────────────────────────────────────────────


def find_best_driver(rows: list[dict], top_n: int = 5) -> dict:
    """Rank drivers by total orders, daily avg, trend, and consistency."""
    df = _prepare_time_df(rows)
    if df.empty or "date" not in df.columns:
        return {"drivers": []}

    # Filter rows with driver info
    df = df.dropna(subset=["employee_id"])
    if df.empty:
        return {"drivers": []}

    drivers = []
    for emp_id, group in df.groupby("employee_id"):
        emp_name = group["employee_name"].iloc[0] or str(emp_id)
        daily_totals = group.groupby("date")["orders"].sum().sort_index()
        total = int(daily_totals.sum())
        n_days = max(len(daily_totals), 1)
        daily_avg = total / n_days

        trend_pct = _half_trend_pct(daily_totals)

        # Consistency: coefficient of variation (lower = more consistent)
        if len(daily_totals) >= 3 and daily_totals.mean() > 0:
            cv = float(daily_totals.std() / daily_totals.mean())
            consistency = max(0, round((1 - min(cv, 1)) * 100, 1))
        else:
            consistency = 50.0

        drivers.append({
            "employee_id": str(emp_id),
            "employee_name": emp_name,
            "total_orders": total,
            "daily_avg": round(daily_avg, 1),
            "trend": _classify_trend(trend_pct),
            "trend_percent": round(trend_pct, 1),
            "consistency_score": consistency,
        })

    # Sort by total orders descending
    drivers.sort(key=lambda d: d["total_orders"], reverse=True)
    return {"drivers": drivers[:top_n]}


# ─── 3. Top Platform ─────────────────────────────────────────────────────────


def rank_platforms(rows: list[dict]) -> dict:
    """Rank delivery platforms by volume, share, and growth."""
    df = _prepare_time_df(rows)
    if df.empty or "date" not in df.columns:
        return {"platforms": []}

    df = df.dropna(subset=["app_name"])
    if df.empty:
        return {"platforms": []}

    grand_total = df["orders"].sum()
    n_days = max((df["date"].max() - df["date"].min()).days + 1, 1)

    platforms = []
    for app_name, group in df.groupby("app_name"):
        total = int(group["orders"].sum())
        share = (total / grand_total * 100) if grand_total > 0 else 0
        avg_daily = total / n_days

        daily_totals = group.groupby("date")["orders"].sum().sort_index()
        growth = _half_trend_pct(daily_totals)

        platforms.append({
            "app_name": str(app_name),
            "total_orders": total,
            "share_percent": round(share, 1),
            "growth_percent": round(growth, 1),
            "avg_daily": round(avg_daily, 1),
        })

    platforms.sort(key=lambda p: p["total_orders"], reverse=True)
    return {"platforms": platforms}


# ─── 4. Smart Alerts ─────────────────────────────────────────────────────────


def _detect_driver_alerts(
    df_drivers: pd.DataFrame,
    daily: pd.Series,
    high_spike: float,
    driver_drop: float,
) -> list[dict]:
    """Generate per-driver performance alerts."""
    alerts = []
    if df_drivers.empty or len(daily) < 7:
        return alerts

    for emp_id, group in df_drivers.groupby("employee_id"):
        emp_daily = group.groupby("date")["orders"].sum().sort_index()
        if len(emp_daily) < 5:
            continue

        emp_name = group["employee_name"].iloc[0] or str(emp_id)
        recent = emp_daily.iloc[-3:].mean()
        prev = emp_daily.iloc[:-3].mean()
        if prev <= 0:
            continue

        emp_change = ((recent - prev) / prev) * 100
        if emp_change <= driver_drop:
            alerts.append({
                "type": "driver_drop",
                "severity": "warning",
                "message": f"انخفاض أداء {emp_name} بنسبة {abs(round(emp_change, 1))}%",
                "value": round(emp_change, 1),
                "entity": str(emp_id),
            })
        elif emp_change >= high_spike:
            alerts.append({
                "type": "driver_spike",
                "severity": "info",
                "message": f"ارتفاع ملحوظ في أداء {emp_name} بنسبة {round(emp_change, 1)}%",
                "value": round(emp_change, 1),
                "entity": str(emp_id),
            })

    return alerts


def generate_smart_alerts(rows: list[dict], thresholds: dict) -> dict:
    """Detect anomalies and generate operational alerts."""
    df = _prepare_time_df(rows)
    if df.empty or "date" not in df.columns:
        return {"alerts": []}
    daily = df.groupby("date")["orders"].sum().sort_index()

    alerts = []
    low_drop = thresholds.get("low_demand_drop_percent", -20)
    high_spike = thresholds.get("high_demand_spike_percent", 30)
    driver_drop = thresholds.get("driver_drop_percent", -25)

    # ── Overall demand alerts ────────────────────────────────────────────────
    if len(daily) >= 7:
        recent_avg = daily.iloc[-3:].mean()
        prev_avg = daily.iloc[-7:-3].mean()
        if prev_avg > 0:
            change_pct = ((recent_avg - prev_avg) / prev_avg) * 100

            if change_pct <= low_drop:
                alerts.append({
                    "type": "low_demand",
                    "severity": "warning",
                    "message": f"انخفاض الطلب بنسبة {abs(round(change_pct, 1))}% خلال آخر 3 أيام مقارنة بالأيام السابقة",
                    "value": round(change_pct, 1),
                    "entity": None,
                })
            elif change_pct >= high_spike:
                alerts.append({
                    "type": "high_demand",
                    "severity": "info",
                    "message": f"ارتفاع الطلب بنسبة {round(change_pct, 1)}% — قد تحتاج لزيادة المناديب",
                    "value": round(change_pct, 1),
                    "entity": None,
                })

    # ── Driver-level alerts ──────────────────────────────────────────────────
    df_drivers = df.dropna(subset=["employee_id"])
    alerts.extend(_detect_driver_alerts(df_drivers, daily, high_spike, driver_drop))

    # Sort: critical first, then warning, then info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return {"alerts": alerts}


# ─── 5. Salary Analysis ──────────────────────────────────────────────────────


def analyze_salary(base_salary: float, orders: int, bonus: float) -> dict:
    """
    Analyze salary against enterprise benchmarks.
    Logic: Base + (Orders * Benchmark) vs Actual (Base + Bonus).
    """
    # Enterprise benchmark: ~12 SR per order if base is provided,
    # or ~18 SR if pure commission (base=0).
    if base_salary > 0:
        benchmark_rate = 12.0
        expected = base_salary + (orders * benchmark_rate)
    else:
        benchmark_rate = 18.0
        expected = orders * benchmark_rate

    actual = base_salary + bonus
    diff_percent = ((actual - expected) / expected * 100) if expected > 0 else 0

    if diff_percent < -10:
        risk = "underpaid"
    elif diff_percent > 15:
        risk = "overpaid"
    else:
        risk = "normal"

    return {
        "expected_salary": round(expected, 2),
        "risk": risk,
        "diff_percent": round(diff_percent, 1),
    }


# ─── 6. Salary Forecast ───────────────────────────────────────────────────────


def predict_salary_forecast(
    current_orders: int,
    days_passed: int,
    avg_order_value: float = 5.0,
    base_salary: float = 0,
    working_days_per_month: int = 30,
) -> dict:
    """
    Predict monthly salary based on current performance.
    Uses linear projection with confidence scoring.
    """
    current_daily_avg = current_orders / days_passed if days_passed > 0 else 0
    days_remaining = max(0, working_days_per_month - days_passed)
    projected_monthly_orders = int(current_orders + current_daily_avg * days_remaining)
    predicted_monthly_salary = base_salary + projected_monthly_orders * avg_order_value

    if days_passed >= 20:
        confidence = "high"
    elif days_passed >= 10:
        confidence = "medium"
    else:
        confidence = "low"

    target_daily = 30
    if current_daily_avg >= target_daily * 1.1:
        trend = "above_target"
    elif current_daily_avg >= target_daily * 0.9:
        trend = "on_track"
    else:
        trend = "below_target"

    return {
        "predicted_monthly_salary": round(predicted_monthly_salary, 2),
        "current_daily_avg": round(current_daily_avg, 1),
        "projected_monthly_orders": projected_monthly_orders,
        "confidence": confidence,
        "trend": trend,
        "days_remaining": days_remaining,
    }


# ─── 7. Best Employee Ranking ─────────────────────────────────────────────────


def rank_employees(employees: list[dict], top_n: int = 5) -> dict:
    """
    Rank employees using a composite scoring algorithm.

    Scoring weights:
    - Orders performance: 40%
    - Attendance rate: 30%
    - Error rate (inverse): 20%
    - Punctuality (inverse of late days): 10%
    """
    if not employees:
        return {"employees": [], "best_employee": None}

    max_orders = max(e.get("total_orders", 0) for e in employees) or 1
    max_working_days = 30  # Assume 30-day month

    scored_employees = []

    for emp in employees:
        orders = emp.get("total_orders", 0)
        attendance = emp.get("attendance_days", 0)
        errors = emp.get("error_count", 0)
        late_days = emp.get("late_days", 0)

        orders_score = (orders / max_orders) * 100 if max_orders > 0 else 0
        attendance_rate = (attendance / max_working_days) * 100
        attendance_score = min(attendance_rate, 100)
        error_score = max(0, 100 - (errors * 20))
        punctuality_score = max(0, 100 - (late_days * 10))

        composite_score = (
            orders_score * 0.40
            + attendance_score * 0.30
            + error_score * 0.20
            + punctuality_score * 0.10
        )

        if composite_score >= 85:
            performance_tier = "excellent"
        elif composite_score >= 70:
            performance_tier = "good"
        elif composite_score >= 50:
            performance_tier = "average"
        else:
            performance_tier = "needs_improvement"

        scored_employees.append({
            "employee_id": emp.get("employee_id", ""),
            "employee_name": emp.get("employee_name", ""),
            "composite_score": round(composite_score, 1),
            "rank": 0,
            "total_orders": orders,
            "attendance_rate": round(attendance_rate, 1),
            "error_rate": round((errors / max(attendance, 1)) * 100, 1),
            "performance_tier": performance_tier,
        })

    scored_employees.sort(key=lambda x: x["composite_score"], reverse=True)

    for i, emp in enumerate(scored_employees):
        emp["rank"] = i + 1

    top_employees = scored_employees[:top_n]
    best_employee = top_employees[0] if top_employees else None

    return {
        "employees": top_employees,
        "best_employee": best_employee,
    }


# ─── 8. Anomaly Detection ─────────────────────────────────────────────────────


def _build_anomaly(a_type: str, severity: str, message: str, value: float, threshold: float, recommendation: str, risk: int) -> tuple[dict, int]:
    return {
        "type": a_type,
        "severity": severity,
        "message": message,
        "value": value,
        "threshold": threshold,
        "recommendation": recommendation,
    }, risk

def _detect_salary_anomaly(employee_name: str, current_salary: float, expected_range: tuple) -> tuple[dict | None, int]:
    """Return (anomaly_dict, risk_score) if salary is below expected, else (None, 0)."""
    min_expected, _max_expected = expected_range
    if not (min_expected > 0 and current_salary < min_expected):
        return None, 0
    shortfall = min_expected - current_salary
    shortfall_pct = (shortfall / min_expected) * 100
    if shortfall_pct > 30:
        severity, risk_score = "critical", 40
    elif shortfall_pct > 15:
        severity, risk_score = "warning", 25
    else:
        severity, risk_score = "info", 10
    return _build_anomaly(
        "low_salary", severity, f"راتب {employee_name} أقل من المتوقع بـ {shortfall_pct:.1f}% ({shortfall:.0f} ر.س)",
        current_salary, min_expected, "مراجعة سكيمة الراتب أو عدد الطلبات المنجزة", risk_score
    )


def _detect_order_anomaly(employee_name: str, monthly_orders: int, previous_month_orders: int) -> tuple[dict | None, int]:
    """Return (anomaly_dict, risk_score) if there is a significant order drop, else (None, 0)."""
    if previous_month_orders <= 0:
        return None, 0
    change_pct = ((monthly_orders - previous_month_orders) / previous_month_orders) * 100
    if change_pct < -50:
        severity, risk_score = "critical", 35
    elif change_pct < -30:
        severity, risk_score = "warning", 25
    elif change_pct < -15:
        severity, risk_score = "warning", 15
    else:
        return None, 0
    return _build_anomaly(
        "order_drop", severity, f"انخفاض حاد في طلبات {employee_name} بنسبة {abs(change_pct):.1f}% عن الشهر الماضي",
        monthly_orders, previous_month_orders, "التحقق من الحالة الصحية أو مشاكل التوصيل", risk_score
    )


def _detect_deduction_anomaly(employee_name: str, current_salary: float, deductions: float) -> tuple[dict | None, int]:
    """Return (anomaly_dict, risk_score) if deductions are unusually high, else (None, 0)."""
    if current_salary <= 0:
        return None, 0
    deduction_pct = (deductions / (current_salary + deductions)) * 100
    if deduction_pct > 20:
        severity, risk_score = "critical", 30
    elif deduction_pct > 10:
        severity, risk_score = "warning", 20
    elif deduction_pct > 5:
        severity, risk_score = "info", 10
    else:
        return None, 0
    return _build_anomaly(
        "high_deductions", severity, f"خصومات مرتفعة على {employee_name}: {deduction_pct:.1f}% من الراتب ({deductions:.0f} ر.س)",
        deductions, (current_salary + deductions) * 0.1, "مراجعة أسباب الخصومات وإمكانية تصحيح الأخطاء", risk_score
    )


def _classify_risk_level(score: int) -> str:
    """Map a numeric risk score to a risk level label."""
    if score >= 60:
        return "critical"
    if score >= 40:
        return "high"
    if score >= 20:
        return "medium"
    return "low"


def detect_anomalies(data: dict) -> dict:
    """
    Detect anomalies in salary, orders, and deductions.
    Returns a list of anomalies with severity, messages, and recommendations.
    """
    employee_name = data.get("employee_name", "الموظف")

    checks = [
        _detect_salary_anomaly(employee_name, data.get("current_salary", 0), (data.get("expected_salary_min", 0), data.get("expected_salary_max", 0))),
        _detect_order_anomaly(employee_name, data.get("monthly_orders", 0), data.get("previous_month_orders", 0)),
        _detect_deduction_anomaly(employee_name, data.get("current_salary", 0), data.get("deductions", 0)),
    ]

    anomalies = [a for a, _ in checks if a is not None]
    overall_risk_score = min(100, sum(s for _, s in checks))

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    anomalies.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return {
        "anomalies": anomalies,
        "overall_risk_score": overall_risk_score,
        "risk_level": _classify_risk_level(overall_risk_score),
    }
