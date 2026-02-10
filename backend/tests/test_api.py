"""Integration tests for FastAPI routes using TestClient."""

from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def test_app():
    """Create a test app with a mocked camera."""
    with patch("capture.cv2.VideoCapture") as mock_cap:
        mock_cap_instance = MagicMock()
        mock_cap_instance.isOpened.return_value = False
        mock_cap.return_value = mock_cap_instance

        import main
        # Use context manager to trigger lifespan events
        with TestClient(main.app) as client:
            yield client, main.capture_manager


class TestHealthEndpoint:
    def test_health_returns_ok(self, test_app) -> None:
        client, _ = test_app
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestStatsEndpoint:
    def test_stats_returns_defaults(self, test_app) -> None:
        client, _ = test_app
        resp = client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "labelsInspected" in data
        assert "defectsFound" in data
        assert "runTime" in data
        assert "status" in data


class TestInspectionControl:
    def test_start_inspection(self, test_app) -> None:
        client, _ = test_app
        resp = client.post("/api/inspection/start")
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

    def test_pause_inspection(self, test_app) -> None:
        client, _ = test_app
        client.post("/api/inspection/start")
        resp = client.post("/api/inspection/pause")
        assert resp.status_code == 200
        assert resp.json()["status"] == "paused"

    def test_stop_inspection(self, test_app) -> None:
        client, _ = test_app
        client.post("/api/inspection/start")
        resp = client.post("/api/inspection/stop")
        assert resp.status_code == 200
        assert resp.json()["status"] == "stopped"


class TestSensitivity:
    def test_set_valid_sensitivity(self, test_app) -> None:
        client, _ = test_app
        resp = client.put("/api/inspection/sensitivity", json={"sensitivity": 80})
        assert resp.status_code == 200
        assert resp.json()["sensitivity"] == 80


class TestReferenceEndpoints:
    def test_reference_image_returns_204_when_none(self, test_app) -> None:
        client, _ = test_app
        resp = client.get("/api/reference_image")
        assert resp.status_code == 204

    def test_set_reference_fails_without_frame(self, test_app) -> None:
        client, cm = test_app
        # Stop capture thread so it doesn't overwrite _latest_frame
        cm.stop_capture()
        cm._latest_frame = None
        resp = client.post("/api/set_reference")
        assert resp.status_code == 400

    def test_reset_reference(self, test_app) -> None:
        client, _ = test_app
        resp = client.post("/api/reset_reference")
        assert resp.status_code == 200


class TestDefectsEndpoint:
    def test_defects_empty_initially(self, test_app) -> None:
        client, _ = test_app
        resp = client.get("/api/defects")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_defect_breakdown_empty_initially(self, test_app) -> None:
        client, _ = test_app
        resp = client.get("/api/defect_breakdown")
        assert resp.status_code == 200
        assert resp.json() == []
