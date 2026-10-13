from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    Priority,
    QueueStatus,
    ResourceStatus,
    ResourceType,
    ReviewStatus,
    Sex,
    TriageStatus,
    UserRole,
)


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class UserOut(ApiModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class LoginInput(ApiModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class TokenOut(ApiModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class PatientCreate(ApiModel):
    medical_record_number: str | None = Field(default=None, min_length=2, max_length=48)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: date | None = None
    sex: Sex = Sex.UNKNOWN
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("first_name", "last_name")
    @classmethod
    def require_nonblank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank.")
        return value.strip()

    @field_validator("medical_record_number")
    @classmethod
    def normalize_record_number(cls, value: str | None) -> str | None:
        return value.strip().upper() if value else None


class PatientPatch(ApiModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    date_of_birth: date | None = None
    sex: Sex | None = None
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("first_name", "last_name")
    @classmethod
    def require_nonblank_optional_name(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Name cannot be blank.")
        return value.strip() if value else value


class PatientOut(ApiModel):
    id: UUID
    medical_record_number: str
    first_name: str
    last_name: str
    date_of_birth: date | None
    sex: Sex
    phone: str | None
    created_at: datetime
    updated_at: datetime


class PatientPage(ApiModel):
    items: list[PatientOut]
    total: int
    page: int
    page_size: int


class ConsultationCreate(ApiModel):
    patient_id: UUID
    doctor_id: UUID | None = None
    chief_complaint: str = Field(min_length=1, max_length=4000)
    vital_signs: dict[str, Any] = Field(default_factory=dict)

    @field_validator("chief_complaint")
    @classmethod
    def require_nonblank_complaint(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Chief complaint cannot be blank.")
        return value.strip()


class ConsultationOut(ApiModel):
    id: UUID
    patient_id: UUID
    doctor_id: UUID | None
    status: str
    chief_complaint: str
    vital_signs: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None


class ConsultationDetail(ConsultationOut):
    reports: list["ReportOut"] = Field(default_factory=list)
    triage_assessments: list["TriageOut"] = Field(default_factory=list)


class ConsultationPage(ApiModel):
    items: list[ConsultationOut]
    total: int
    page: int
    page_size: int


class ProcessReportInput(ApiModel):
    transcript: str = Field(min_length=1, max_length=20000)
    language: str = Field(default="es", min_length=2, max_length=16)

    @field_validator("transcript")
    @classmethod
    def require_nonblank_transcript(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Transcript cannot be blank.")
        return value.strip()


class ReportPatch(ApiModel):
    report_data: dict[str, Any]
    review_status: ReviewStatus = ReviewStatus.PENDING_REVIEW


class ReportOut(ApiModel):
    id: UUID
    consultation_id: UUID
    version: int
    report_data: dict[str, Any]
    review_status: ReviewStatus
    created_at: datetime
    created_by: UUID
    confirmed_at: datetime | None


class VitalSignsInput(ApiModel):
    vital_signs: dict[str, Any] = Field(min_length=1)


class TriageInput(ApiModel):
    chief_complaint: str | None = Field(default=None, max_length=4000)
    symptoms: list[str] = Field(default_factory=list, max_length=50)
    duration: str | None = Field(default=None, max_length=300)
    age: int | None = Field(default=None, ge=0, le=130)
    sex: str | None = Field(default=None, max_length=32)
    medical_history: list[str] = Field(default_factory=list, max_length=100)
    medications: list[str] = Field(default_factory=list, max_length=100)
    allergies: list[str] = Field(default_factory=list, max_length=100)
    vital_signs: dict[str, Any] = Field(default_factory=dict)


class TriageReviewInput(ApiModel):
    priority: Priority | None = None
    reason: str | None = Field(default=None, max_length=2000)


class TriageOut(ApiModel):
    id: UUID
    consultation_id: UUID
    status: TriageStatus
    priority: Priority
    red_flags_detected: bool
    red_flags: list[Any]
    relevant_symptoms: list[Any]
    missing_information: list[Any]
    reason: str
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    created_at: datetime


class QueueOut(ApiModel):
    id: UUID
    consultation_id: UUID
    priority: Priority
    status: QueueStatus
    queued_at: datetime
    called_at: datetime | None
    completed_at: datetime | None


class QueueStatusInput(ApiModel):
    status: QueueStatus


class ResourceCreate(ApiModel):
    name: str = Field(min_length=1, max_length=160)
    resource_type: ResourceType
    description: str | None = Field(default=None, max_length=4000)
    status: ResourceStatus = ResourceStatus.AVAILABLE
    capacity: int = Field(default=1, ge=0, le=10000)

    @field_validator("name")
    @classmethod
    def require_nonblank_resource_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Resource name cannot be blank.")
        return value.strip()


class ResourcePatch(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    resource_type: ResourceType | None = None
    description: str | None = Field(default=None, max_length=4000)
    status: ResourceStatus | None = None
    capacity: int | None = Field(default=None, ge=0, le=10000)

    @field_validator("name")
    @classmethod
    def validate_optional_resource_name(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Resource name cannot be blank.")
        return value.strip() if value else value


class ResourceOut(ApiModel):
    id: UUID
    name: str
    resource_type: ResourceType
    description: str | None
    status: ResourceStatus
    capacity: int
    created_at: datetime
    updated_at: datetime


class AssignmentCreate(ApiModel):
    consultation_id: UUID


class AssignmentOut(ApiModel):
    id: UUID
    resource_id: UUID
    consultation_id: UUID
    assigned_by: UUID
    assigned_at: datetime
    released_at: datetime | None


class AuditOut(ApiModel):
    id: UUID
    user_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID | None
    created_at: datetime


class DashboardSummary(ApiModel):
    patients_today: int
    active_consultations: int
    critical_queue_count: int
    waiting_queue_count: int
    average_wait_minutes: float | None
    available_beds: int
    total_beds: int
    open_alerts: int = 0
    last_synchronized_at: datetime


class TriageWorkflowResult(ApiModel):
    session_id: str
    patient_id: str
    status: str
    triage: "TriageWorkflowPayload"

    model_config = ConfigDict(populate_by_name=True, extra="ignore", alias_generator=lambda value: "".join(
        part.capitalize() if index else part for index, part in enumerate(value.split("_"))
    ))


class TriageWorkflowPayload(ApiModel):
    priority: Priority
    red_flags_detected: bool
    red_flags: list[Any] = Field(default_factory=list)
    chief_complaint: str | None = None
    relevant_symptoms: list[Any] = Field(default_factory=list)
    missing_information: list[Any] = Field(default_factory=list)
    reason: str = Field(min_length=1)

    model_config = ConfigDict(populate_by_name=True, extra="ignore", alias_generator=lambda value: "".join(
        part.capitalize() if index else part for index, part in enumerate(value.split("_"))
    ))


class ConsultationWorkflowResult(ApiModel):
    session_id: str | None = None
    report: dict[str, Any]

    model_config = ConfigDict(populate_by_name=True, extra="ignore", alias_generator=lambda value: "".join(
        part.capitalize() if index else part for index, part in enumerate(value.split("_"))
    ))


class ReportPreview(ApiModel):
    consultation_id: UUID
    report_data: dict[str, Any]


ConsultationDetail.model_rebuild()
TriageWorkflowResult.model_rebuild()
