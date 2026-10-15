"""Create the initial MediFlow IA schema.

Revision ID: 20261015_0001
Revises:
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261015_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=True)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("role", _enum("user_role", "ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "patients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("medical_record_number", sa.String(length=48), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("sex", _enum("patient_sex", "F", "M", "UNKNOWN"), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("length(trim(first_name)) > 0", name="ck_patients_first_name_nonempty"),
        sa.CheckConstraint("length(trim(last_name)) > 0", name="ck_patients_last_name_nonempty"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("medical_record_number"),
    )
    op.create_index("ix_patients_medical_record_number", "patients", ["medical_record_number"], unique=False)

    op.create_table(
        "consultations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=24), server_default="OPEN", nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=False),
        sa.Column("vital_signs", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_consultations_patient_id", "consultations", ["patient_id"], unique=False)
    op.create_index("ix_consultations_doctor_id", "consultations", ["doctor_id"], unique=False)

    op.create_table(
        "consultation_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("consultation_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("report_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("review_status", _enum("report_review_status", "DRAFT", "PENDING_REVIEW", "CONFIRMED"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("consultation_id", "version", name="uq_report_consultation_version"),
    )
    op.create_index("ix_consultation_reports_consultation_id", "consultation_reports", ["consultation_id"], unique=False)

    op.create_table(
        "triage_assessments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("consultation_id", sa.Uuid(), nullable=False),
        sa.Column("status", _enum("triage_status", "COMPLETED", "REVIEWED"), nullable=False),
        sa.Column("priority", _enum("triage_priority", "P1", "P2", "P3", "P4", "INSUFFICIENT_INFORMATION"), nullable=False),
        sa.Column("red_flags_detected", sa.Boolean(), nullable=False),
        sa.Column("red_flags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("relevant_symptoms", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("missing_information", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_triage_assessments_consultation_id", "triage_assessments", ["consultation_id"], unique=False)

    op.create_table(
        "queue_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("consultation_id", sa.Uuid(), nullable=False),
        sa.Column("priority", _enum("queue_priority", "P1", "P2", "P3", "P4", "INSUFFICIENT_INFORMATION"), nullable=False),
        sa.Column("status", _enum("queue_status", "WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED"), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("called_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_queue_entries_consultation_id", "queue_entries", ["consultation_id"], unique=False)
    op.create_index(
        "uq_queue_active_consultation",
        "queue_entries",
        ["consultation_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('WAITING','CALLED','IN_PROGRESS')"),
    )

    op.create_table(
        "resources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("resource_type", _enum("resource_type", "DOCTOR", "BED", "AREA", "OTHER"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", _enum("resource_status", "AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "INACTIVE"), nullable=False),
        sa.Column("capacity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("capacity >= 0", name="ck_resources_capacity_nonnegative"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resources_name", "resources", ["name"], unique=False)
    op.create_index("ix_resources_resource_type", "resources", ["resource_type"], unique=False)

    op.create_table(
        "resource_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("consultation_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_by", sa.Uuid(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["resource_id"], ["resources.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resource_assignments_resource_id", "resource_assignments", ["resource_id"], unique=False)
    op.create_index("ix_resource_assignments_consultation_id", "resource_assignments", ["consultation_id"], unique=False)
    op.create_index(
        "uq_resource_assignment_active_pair",
        "resource_assignments",
        ["resource_id", "consultation_id"],
        unique=True,
        postgresql_where=sa.text("released_at IS NULL"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)

    op.create_table(
        "refresh_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_refresh_sessions_user_id", "refresh_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_refresh_sessions_user_id", table_name="refresh_sessions")
    op.drop_table("refresh_sessions")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("uq_resource_assignment_active_pair", table_name="resource_assignments")
    op.drop_index("ix_resource_assignments_consultation_id", table_name="resource_assignments")
    op.drop_index("ix_resource_assignments_resource_id", table_name="resource_assignments")
    op.drop_table("resource_assignments")
    op.drop_index("ix_resources_resource_type", table_name="resources")
    op.drop_index("ix_resources_name", table_name="resources")
    op.drop_table("resources")
    op.drop_index("uq_queue_active_consultation", table_name="queue_entries")
    op.drop_index("ix_queue_entries_consultation_id", table_name="queue_entries")
    op.drop_table("queue_entries")
    op.drop_index("ix_triage_assessments_consultation_id", table_name="triage_assessments")
    op.drop_table("triage_assessments")
    op.drop_index("ix_consultation_reports_consultation_id", table_name="consultation_reports")
    op.drop_table("consultation_reports")
    op.drop_index("ix_consultations_doctor_id", table_name="consultations")
    op.drop_index("ix_consultations_patient_id", table_name="consultations")
    op.drop_table("consultations")
    op.drop_index("ix_patients_medical_record_number", table_name="patients")
    op.drop_table("patients")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
