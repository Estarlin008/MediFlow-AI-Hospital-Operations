import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def enum_column(enum_type: type[enum.Enum], name: str) -> Enum:
    return Enum(
        enum_type,
        name=name,
        values_callable=lambda values: [item.value for item in values],
        native_enum=True,
        create_constraint=False,
    )


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    DOCTOR = "DOCTOR"
    NURSE = "NURSE"
    RECEPTIONIST = "RECEPTIONIST"


class Sex(str, enum.Enum):
    F = "F"
    M = "M"
    UNKNOWN = "UNKNOWN"


class Priority(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"
    INSUFFICIENT_INFORMATION = "INSUFFICIENT_INFORMATION"


class TriageStatus(str, enum.Enum):
    COMPLETED = "COMPLETED"
    REVIEWED = "REVIEWED"


class QueueStatus(str, enum.Enum):
    WAITING = "WAITING"
    CALLED = "CALLED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReviewStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    CONFIRMED = "CONFIRMED"


class ResourceType(str, enum.Enum):
    DOCTOR = "DOCTOR"
    BED = "BED"
    AREA = "AREA"
    OTHER = "OTHER"


class ResourceStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    MAINTENANCE = "MAINTENANCE"
    INACTIVE = "INACTIVE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole, "user_role"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    consultations: Mapped[list["Consultation"]] = relationship(back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint("length(trim(first_name)) > 0", name="ck_patients_first_name_nonempty"),
        CheckConstraint("length(trim(last_name)) > 0", name="ck_patients_last_name_nonempty"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    medical_record_number: Mapped[str] = mapped_column(String(48), nullable=False, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    sex: Mapped[Sex] = mapped_column(enum_column(Sex, "patient_sex"), nullable=False, default=Sex.UNKNOWN)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    consultations: Mapped[list["Consultation"]] = relationship(back_populates="patient")


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="OPEN", server_default="OPEN")
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    vital_signs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped[Patient] = relationship(back_populates="consultations")
    doctor: Mapped[User | None] = relationship(back_populates="consultations")
    reports: Mapped[list["ConsultationReport"]] = relationship(back_populates="consultation")
    triage_assessments: Mapped[list["TriageAssessment"]] = relationship(back_populates="consultation")
    queue_entries: Mapped[list["QueueEntry"]] = relationship(back_populates="consultation")


class ConsultationReport(Base):
    __tablename__ = "consultation_reports"
    __table_args__ = (UniqueConstraint("consultation_id", "version", name="uq_report_consultation_version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    report_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    review_status: Mapped[ReviewStatus] = mapped_column(enum_column(ReviewStatus, "report_review_status"), nullable=False, default=ReviewStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consultation: Mapped[Consultation] = relationship(back_populates="reports")


class TriageAssessment(Base):
    __tablename__ = "triage_assessments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[TriageStatus] = mapped_column(enum_column(TriageStatus, "triage_status"), nullable=False, default=TriageStatus.COMPLETED)
    priority: Mapped[Priority] = mapped_column(enum_column(Priority, "triage_priority"), nullable=False)
    red_flags_detected: Mapped[bool] = mapped_column(Boolean, nullable=False)
    red_flags: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    relevant_symptoms: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    missing_information: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    consultation: Mapped[Consultation] = relationship(back_populates="triage_assessments")


class QueueEntry(Base):
    __tablename__ = "queue_entries"
    __table_args__ = (
        CheckConstraint("priority IN ('P1','P2','P3','P4','INSUFFICIENT_INFORMATION')", name="ck_queue_priority"),
        Index(
            "uq_queue_active_consultation",
            "consultation_id",
            unique=True,
            postgresql_where=text("status IN ('WAITING','CALLED','IN_PROGRESS')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    priority: Mapped[Priority] = mapped_column(enum_column(Priority, "queue_priority"), nullable=False)
    status: Mapped[QueueStatus] = mapped_column(enum_column(QueueStatus, "queue_status"), nullable=False, default=QueueStatus.WAITING)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consultation: Mapped[Consultation] = relationship(back_populates="queue_entries")


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (CheckConstraint("capacity >= 0", name="ck_resources_capacity_nonnegative"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    resource_type: Mapped[ResourceType] = mapped_column(enum_column(ResourceType, "resource_type"), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ResourceStatus] = mapped_column(enum_column(ResourceStatus, "resource_status"), nullable=False, default=ResourceStatus.AVAILABLE)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    assignments: Mapped[list["ResourceAssignment"]] = relationship(back_populates="resource")


class ResourceAssignment(Base):
    __tablename__ = "resource_assignments"
    __table_args__ = (
        Index(
            "uq_resource_assignment_active_pair",
            "resource_id",
            "consultation_id",
            unique=True,
            postgresql_where=text("released_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    resource_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False, index=True)
    consultation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("consultations.id", ondelete="RESTRICT"), nullable=False, index=True)
    assigned_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    resource: Mapped[Resource] = relationship(back_populates="assignments")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
