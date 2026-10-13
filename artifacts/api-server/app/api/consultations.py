from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import add_audit, current_user, ensure_consultation_access, require_roles
from app.db.session import get_db
from app.models import (
    Consultation,
    ConsultationReport,
    Priority,
    QueueEntry,
    QueueStatus,
    ReviewStatus,
    TriageAssessment,
    TriageStatus,
    User,
    UserRole,
)
from app.schemas.api import (
    ConsultationCreate,
    ConsultationDetail,
    ConsultationOut,
    ConsultationWorkflowResult,
    ProcessReportInput,
    ReportOut,
    ReportPatch,
    ReportPreview,
    TriageInput,
    TriageOut,
    TriageReviewInput,
    TriageWorkflowResult,
    VitalSignsInput,
)
from app.services.n8n_client import N8nClient, get_n8n_client
from app.core.config import get_settings

router = APIRouter(tags=["consultations", "triage"])
_CARE_ROLES = (UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)
_CLINICIAN_ROLES = (UserRole.ADMIN, UserRole.DOCTOR)
_TRIAGE_ROLES = (UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE)


def _load_consultation(db: Session, consultation_id: UUID) -> Consultation:
    consultation = db.scalar(
        select(Consultation)
        .options(selectinload(Consultation.reports), selectinload(Consultation.triage_assessments))
        .where(Consultation.id == consultation_id)
    )
    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found.")
    return consultation


@router.post("/consultations", response_model=ConsultationOut, status_code=status.HTTP_201_CREATED)
def create_consultation(
    payload: ConsultationCreate,
    user: User = Depends(require_roles(*_CARE_ROLES)),
    db: Session = Depends(get_db),
) -> ConsultationOut:
    from app.models import Patient

    if db.get(Patient, payload.patient_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    if payload.doctor_id:
        doctor = db.get(User, payload.doctor_id)
        if doctor is None or doctor.role not in (UserRole.DOCTOR, UserRole.ADMIN) or not doctor.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Assigned clinician is not active.")
    consultation = Consultation(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        chief_complaint=payload.chief_complaint,
        vital_signs=payload.vital_signs,
    )
    db.add(consultation)
    add_audit(db, user.id, "consultation.create", "consultation", consultation.id)
    db.commit()
    db.refresh(consultation)
    return ConsultationOut.model_validate(consultation)


@router.get("/consultations/{consultation_id}", response_model=ConsultationDetail)
def get_consultation(
    consultation_id: UUID,
    user: User = Depends(require_roles(*_CARE_ROLES)),
    db: Session = Depends(get_db),
) -> ConsultationDetail:
    consultation = _load_consultation(db, consultation_id)
    ensure_consultation_access(user, consultation.doctor_id)
    return ConsultationDetail.model_validate(consultation)


@router.post("/consultations/{consultation_id}/process-report", response_model=ReportPreview)
async def process_report(
    consultation_id: UUID,
    payload: ProcessReportInput,
    user: User = Depends(require_roles(*_CLINICIAN_ROLES)),
    db: Session = Depends(get_db),
    n8n: N8nClient = Depends(get_n8n_client),
) -> ReportPreview:
    consultation = _load_consultation(db, consultation_id)
    ensure_consultation_access(user, consultation.doctor_id)
    if consultation.status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This consultation is already confirmed.")
    patient = consultation.patient
    outgoing = {
        "sessionId": str(consultation.id),
        "doctorId": str(consultation.doctor_id or user.id),
        "patientId": str(patient.id),
        "language": payload.language,
        "transcript": payload.transcript,
    }
    response = await n8n.post(get_settings().n8n_consultation_path, outgoing)
    if isinstance(response, list):
        if len(response) != 1:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The clinical workflow returned an invalid response.")
        response = response[0]
    try:
        result = ConsultationWorkflowResult.model_validate(response)
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The clinical workflow returned an invalid report.") from None
    # Transcript and unreviewed workflow output are deliberately not persisted here.
    return ReportPreview(consultation_id=consultation.id, report_data=result.report)


@router.patch("/consultations/{consultation_id}/report", response_model=ReportOut)
def update_report(
    consultation_id: UUID,
    payload: ReportPatch,
    user: User = Depends(require_roles(*_CLINICIAN_ROLES)),
    db: Session = Depends(get_db),
) -> ReportOut:
    consultation = _load_consultation(db, consultation_id)
    ensure_consultation_access(user, consultation.doctor_id)
    if consultation.status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirmed consultations cannot be edited.")
    if payload.review_status == ReviewStatus.CONFIRMED:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Use the confirmation endpoint to confirm a report.")
    latest = max(consultation.reports, key=lambda report: report.version, default=None)
    if latest and latest.review_status != ReviewStatus.CONFIRMED:
        latest.report_data = payload.report_data
        latest.review_status = payload.review_status
        report = latest
    else:
        version = (latest.version if latest else 0) + 1
        report = ConsultationReport(
            consultation_id=consultation.id,
            version=version,
            report_data=payload.report_data,
            review_status=payload.review_status,
            created_by=user.id,
        )
        db.add(report)
    add_audit(db, user.id, "report.update", "consultation_report", report.id)
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)


@router.post("/consultations/{consultation_id}/confirm", response_model=ReportOut)
def confirm_report(
    consultation_id: UUID,
    user: User = Depends(require_roles(*_CLINICIAN_ROLES)),
    db: Session = Depends(get_db),
) -> ReportOut:
    consultation = _load_consultation(db, consultation_id)
    ensure_consultation_access(user, consultation.doctor_id)
    latest = max(consultation.reports, key=lambda report: report.version, default=None)
    if latest is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="There is no report to confirm.")
    if latest.review_status == ReviewStatus.CONFIRMED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The latest report is already confirmed.")
    now = datetime.now(timezone.utc)
    latest.review_status = ReviewStatus.CONFIRMED
    latest.confirmed_at = now
    consultation.status = "COMPLETED"
    consultation.confirmed_at = now
    active_queue = db.scalar(
        select(QueueEntry).where(
            QueueEntry.consultation_id == consultation.id,
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]),
        )
    )
    if active_queue:
        active_queue.status = QueueStatus.COMPLETED
        active_queue.completed_at = now
    add_audit(db, user.id, "report.confirm", "consultation_report", latest.id)
    db.commit()
    db.refresh(latest)
    return ReportOut.model_validate(latest)


@router.post("/consultations/{consultation_id}/vital-signs", response_model=ConsultationOut)
def update_vital_signs(
    consultation_id: UUID,
    payload: VitalSignsInput,
    user: User = Depends(require_roles(*_CARE_ROLES)),
    db: Session = Depends(get_db),
) -> ConsultationOut:
    consultation = _load_consultation(db, consultation_id)
    ensure_consultation_access(user, consultation.doctor_id)
    consultation.vital_signs = {**(consultation.vital_signs or {}), **payload.vital_signs}
    add_audit(db, user.id, "consultation.vital_signs.update", "consultation", consultation.id)
    db.commit()
    db.refresh(consultation)
    return ConsultationOut.model_validate(consultation)


@router.post("/consultations/{consultation_id}/triage", response_model=TriageOut, status_code=status.HTTP_201_CREATED)
async def assess_triage(
    consultation_id: UUID,
    payload: TriageInput,
    user: User = Depends(require_roles(*_TRIAGE_ROLES)),
    db: Session = Depends(get_db),
    n8n: N8nClient = Depends(get_n8n_client),
) -> TriageOut:
    consultation = _load_consultation(db, consultation_id)
    ensure_consultation_access(user, consultation.doctor_id)
    patient = consultation.patient
    outgoing = {
        "sessionId": str(consultation.id),
        "patientId": str(patient.id),
        "chiefComplaint": payload.chief_complaint or consultation.chief_complaint,
        "symptoms": payload.symptoms,
        "age": payload.age,
        "sex": payload.sex or patient.sex.value,
        "duration": payload.duration,
        "medicalHistory": payload.medical_history,
        "medications": payload.medications,
        "allergies": payload.allergies,
        "vitalSigns": payload.vital_signs or consultation.vital_signs,
    }
    response = await n8n.post(get_settings().n8n_triage_path, outgoing)
    if isinstance(response, list):
        if len(response) != 1:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The triage workflow returned an invalid response.")
        response = response[0]
    try:
        result = TriageWorkflowResult.model_validate(response)
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The triage workflow returned an invalid assessment.") from None
    if result.patient_id != str(patient.id):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The triage workflow returned a mismatched patient.")
    assessment = TriageAssessment(
        consultation_id=consultation.id,
        status=TriageStatus.COMPLETED,
        priority=result.triage.priority,
        red_flags_detected=result.triage.red_flags_detected,
        red_flags=result.triage.red_flags,
        relevant_symptoms=result.triage.relevant_symptoms,
        missing_information=result.triage.missing_information,
        reason=result.triage.reason,
    )
    db.add(assessment)
    active_entry = db.scalar(
        select(QueueEntry).where(
            QueueEntry.consultation_id == consultation.id,
            QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]),
        )
    )
    if active_entry:
        active_entry.priority = result.triage.priority
    else:
        db.add(QueueEntry(consultation_id=consultation.id, priority=result.triage.priority))
    add_audit(db, user.id, "triage.completed", "consultation", consultation.id)
    db.commit()
    db.refresh(assessment)
    return TriageOut.model_validate(assessment)


@router.get("/triage/{assessment_id}", response_model=TriageOut)
def get_triage_assessment(
    assessment_id: UUID,
    user: User = Depends(require_roles(*_TRIAGE_ROLES)),
    db: Session = Depends(get_db),
) -> TriageOut:
    assessment = db.scalar(
        select(TriageAssessment)
        .options(selectinload(TriageAssessment.consultation))
        .where(TriageAssessment.id == assessment_id)
    )
    if assessment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Triage assessment not found.")
    ensure_consultation_access(user, assessment.consultation.doctor_id)
    return TriageOut.model_validate(assessment)


@router.post("/triage/{assessment_id}/review", response_model=TriageOut)
def review_triage_assessment(
    assessment_id: UUID,
    payload: TriageReviewInput,
    user: User = Depends(require_roles(*_CLINICIAN_ROLES)),
    db: Session = Depends(get_db),
) -> TriageOut:
    assessment = db.scalar(
        select(TriageAssessment)
        .options(selectinload(TriageAssessment.consultation))
        .where(TriageAssessment.id == assessment_id)
    )
    if assessment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Triage assessment not found.")
    ensure_consultation_access(user, assessment.consultation.doctor_id)
    if payload.priority is not None and payload.priority != assessment.priority and not (payload.reason and payload.reason.strip()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A reason is required when changing the workflow priority.")
    if payload.priority is not None:
        assessment.priority = payload.priority
        active_entry = db.scalar(
            select(QueueEntry).where(
                QueueEntry.consultation_id == assessment.consultation_id,
                QueueEntry.status.in_([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS]),
            )
        )
        if active_entry:
            active_entry.priority = payload.priority
    if payload.reason:
        # The note records the professional review; it is clinical content and is not copied to the audit log.
        assessment.reason = f"{assessment.reason}\n\nProfessional review: {payload.reason.strip()}"
    assessment.status = TriageStatus.REVIEWED
    assessment.reviewed_by = user.id
    assessment.reviewed_at = datetime.now(timezone.utc)
    add_audit(db, user.id, "triage.reviewed", "triage_assessment", assessment.id)
    db.commit()
    db.refresh(assessment)
    return TriageOut.model_validate(assessment)
