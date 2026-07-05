import sys
import unittest
from pathlib import Path
from typing import cast

from fastapi import Request
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import (  # noqa: E402
    app,
    health,
    api_analyze_salary,
    api_best_driver,
    api_best_employee,
    api_detect_anomalies,
    api_predict_orders,
    api_predict_salary,
    api_smart_alerts,
    api_top_platform,
    AnomalyDetectionRequest,
    BestDriverRequest,
    BestEmployeeRequest,
    PredictOrdersRequest,
    SalaryAnalysisRequest,
    SalaryForecastRequest,
    SmartAlertsRequest,
    TopPlatformRequest,
)
from model import (  # noqa: E402
    analyze_salary,
    detect_anomalies,
    find_best_driver,
    generate_smart_alerts,
    predict_orders,
    predict_salary_forecast,
    rank_employees,
    rank_platforms,
)


class AiBackendSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.history = [
            {"date": "2026-03-01", "orders": 10, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-02", "orders": 12, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-03", "orders": 11, "app_name": "Hunger", "employee_id": "emp-2", "employee_name": "Omar"},
            {"date": "2026-03-04", "orders": 14, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-05", "orders": 15, "app_name": "Hunger", "employee_id": "emp-2", "employee_name": "Omar"},
            {"date": "2026-03-06", "orders": 16, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-07", "orders": 18, "app_name": "Hunger", "employee_id": "emp-2", "employee_name": "Omar"},
        ]
        self.alert_history = [
            {"date": "2026-03-01", "orders": 24, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-02", "orders": 23, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-03", "orders": 22, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-04", "orders": 21, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-05", "orders": 4, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-06", "orders": 3, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
            {"date": "2026-03-07", "orders": 2, "app_name": "Jahez", "employee_id": "emp-1", "employee_name": "Ali"},
        ]
        self.employee_rows = [
            {
                "employee_id": "emp-1",
                "employee_name": "Ali",
                "total_orders": 320,
                "attendance_days": 28,
                "error_count": 1,
                "late_days": 0,
                "salary": 3200,
                "avg_orders_per_day": 11.4,
            },
            {
                "employee_id": "emp-2",
                "employee_name": "Omar",
                "total_orders": 250,
                "attendance_days": 26,
                "error_count": 2,
                "late_days": 1,
                "salary": 2600,
                "avg_orders_per_day": 9.6,
            },
        ]
        self.anomaly_payload = {
            "employee_id": "emp-1",
            "employee_name": "Ali",
            "current_salary": 1800,
            "expected_salary_min": 2400,
            "expected_salary_max": 3000,
            "monthly_orders": 150,
            "previous_month_orders": 260,
            "deductions": 400,
            "deduction_reasons": ["late", "delivery_error"],
        }

    def test_health_endpoint_shape(self) -> None:
        result = health()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["version"], "2.0.0")

    def test_openapi_exposes_expected_paths(self) -> None:
        schema = app.openapi()
        expected_paths = {
            "/health",
            "/predict-orders",
            "/best-driver",
            "/top-platform",
            "/smart-alerts",
            "/analyze",
            "/predict-salary",
            "/best-employee",
            "/detect-anomalies",
        }
        self.assertTrue(expected_paths.issubset(set(schema["paths"].keys())))

    def test_predict_orders_returns_forecast_shape(self) -> None:
        result = predict_orders(self.history, forecast_days=3)
        self.assertEqual(len(result["daily_forecast"]), 3)
        self.assertIn(result["trend"], {"up", "down", "stable"})
        self.assertIn(result["confidence"], {"high", "medium", "low"})

    def test_predict_salary_forecast_returns_expected_fields(self) -> None:
        result = predict_salary_forecast(current_orders=120, days_passed=10, avg_order_value=6, base_salary=1500)
        self.assertGreaterEqual(result["predicted_monthly_salary"], 1500)
        self.assertIn(result["trend"], {"above_target", "on_track", "below_target"})

    def test_rank_platforms_returns_sorted_platforms(self) -> None:
        result = rank_platforms(self.history)
        self.assertGreaterEqual(len(result["platforms"]), 1)
        self.assertGreaterEqual(result["platforms"][0]["total_orders"], result["platforms"][-1]["total_orders"])

    def test_find_best_driver_returns_sorted_drivers(self) -> None:
        result = find_best_driver(self.history, top_n=2)
        self.assertEqual(len(result["drivers"]), 2)
        self.assertEqual(result["drivers"][0]["employee_id"], "emp-1")
        self.assertIn(result["drivers"][0]["trend"], {"up", "down", "stable"})

    def test_rank_employees_returns_best_employee(self) -> None:
        result = rank_employees(self.employee_rows, top_n=2)
        self.assertEqual(len(result["employees"]), 2)
        self.assertIsNotNone(result["best_employee"])
        self.assertEqual(result["best_employee"]["rank"], 1)

    def test_generate_smart_alerts_flags_demand_drop(self) -> None:
        result = generate_smart_alerts(self.alert_history, {})
        self.assertGreaterEqual(len(result["alerts"]), 1)
        self.assertEqual(result["alerts"][0]["severity"], "warning")
        self.assertIn(result["alerts"][0]["type"], {"low_demand", "driver_drop"})

    def test_analyze_salary_classifies_underpaid_case(self) -> None:
        result = analyze_salary(base_salary=1000, orders=10, bonus=0)
        self.assertEqual(result["risk"], "underpaid")
        self.assertLess(result["diff_percent"], 0)

    def test_detect_anomalies_returns_risk_level(self) -> None:
        result = detect_anomalies(self.anomaly_payload)
        self.assertIn(result["risk_level"], {"low", "medium", "high", "critical"})
        self.assertIsInstance(result["anomalies"], list)
        self.assertGreater(result["overall_risk_score"], 0)

    def test_request_models_enforce_basic_validation(self) -> None:
        with self.assertRaises(ValidationError):
            PredictOrdersRequest(history=[], forecast_days=3)

        with self.assertRaises(ValidationError):
            SmartAlertsRequest(history=self.history[:6])

        with self.assertRaises(ValidationError):
            SalaryForecastRequest(current_orders=10, days_passed=0)

    def test_api_handlers_accept_pydantic_requests(self) -> None:
        class MockRequest:
            headers = {}
        orders_result = api_predict_orders(
            cast(Request, MockRequest()), PredictOrdersRequest(history=self.history, forecast_days=2)
        )
        self.assertEqual(len(orders_result["daily_forecast"]), 2)

        driver_result = api_best_driver(BestDriverRequest(history=self.history, top_n=2))
        self.assertEqual(len(driver_result["drivers"]), 2)

        platform_result = api_top_platform(TopPlatformRequest(history=self.history))
        self.assertGreaterEqual(len(platform_result["platforms"]), 1)

        alerts_result = api_smart_alerts(SmartAlertsRequest(history=self.alert_history))
        self.assertIsInstance(alerts_result["alerts"], list)

        analyze_result = api_analyze_salary(SalaryAnalysisRequest(base_salary=1200, orders=15, bonus=100))
        self.assertIn(analyze_result["risk"], {"underpaid", "normal", "overpaid"})

        salary_result = api_predict_salary(
            SalaryForecastRequest(
                current_orders=120,
                days_passed=10,
                avg_order_value=6,
                base_salary=1500,
                working_days_per_month=30,
            )
        )
        self.assertGreaterEqual(salary_result["projected_monthly_orders"], 120)

        employee_result = api_best_employee(BestEmployeeRequest(employees=self.employee_rows, top_n=2))
        self.assertEqual(employee_result["best_employee"]["rank"], 1)

        anomaly_result = api_detect_anomalies(AnomalyDetectionRequest(**self.anomaly_payload))
        self.assertIn(anomaly_result["risk_level"], {"low", "medium", "high", "critical"})


if __name__ == "__main__":
    unittest.main()
