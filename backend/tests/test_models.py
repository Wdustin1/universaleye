"""Tests for Pydantic models."""

from models import Defect, Severity, AIVerdict, StatsResponse, InspectionState


class TestDefect:
    def test_model_dump_frontend_keys(self) -> None:
        d = Defect(
            id=1,
            timestamp="2026-02-12T14:32:07",
            type="Smudge",
            severity=Severity.major,
            ai_verdict=AIVerdict.reject,
            ssim_score=0.72,
        )
        result = d.model_dump_frontend()
        assert result["aiVerdict"] == "reject"
        assert result["ssimScore"] == 0.72
        assert "ai_verdict" not in result
        assert "labelNumber" not in result
        assert "lane" not in result


class TestStatsResponse:
    def test_model_dump_frontend(self) -> None:
        s = StatsResponse(
            labels_inspected=100,
            defects_found=5,
            run_time="01:23:45",
            status=InspectionState.running,
        )
        result = s.model_dump_frontend()
        assert result["labelsInspected"] == 100
        assert result["runTime"] == "01:23:45"
