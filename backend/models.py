"""Pydantic models matching the frontend TypeScript interfaces."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class Severity(str, Enum):
    critical = "critical"
    major = "major"
    minor = "minor"


class AIVerdict(str, Enum):
    reject = "reject"
    accept = "accept"
    review = "review"


class InspectionState(str, Enum):
    running = "running"
    paused = "paused"
    stopped = "stopped"


class Defect(BaseModel):
    """Matches the frontend Defect interface exactly."""

    id: int
    timestamp: str
    type: str
    severity: Severity
    label_number: int
    lane: int
    ai_verdict: AIVerdict

    def model_dump_frontend(self) -> dict:
        """Return dict with camelCase keys matching TypeScript interface."""
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "type": self.type,
            "severity": self.severity.value,
            "labelNumber": self.label_number,
            "lane": self.lane,
            "aiVerdict": self.ai_verdict.value,
        }


class StatsResponse(BaseModel):
    labels_inspected: int
    defects_found: int
    run_time: str
    status: InspectionState

    def model_dump_frontend(self) -> dict:
        return {
            "labelsInspected": self.labels_inspected,
            "defectsFound": self.defects_found,
            "runTime": self.run_time,
            "status": self.status.value,
        }


class DefectBreakdownItem(BaseModel):
    type: str
    count: int
    percentage: float


class SensitivityRequest(BaseModel):
    sensitivity: int
