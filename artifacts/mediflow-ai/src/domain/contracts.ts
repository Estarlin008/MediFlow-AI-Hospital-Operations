import { z } from 'zod';

export const DATA_SOURCE_MODES = ['mock', 'n8n'] as const;
export type DataSourceMode = (typeof DATA_SOURCE_MODES)[number];

export const PATIENT_STATUSES = ['En atención', 'En espera', 'Observación', 'Alta'] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const EPISODE_STATUSES = ['En espera', 'En atención', 'Observación', 'Completado'] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export const TRIAGE_STATUSES = ['Pendiente', 'Recibido', 'Confirmado', 'Rechazado'] as const;
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

export const ALERT_SEVERITIES = ['critical', 'warning', 'info'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const BED_STATUSES = ['Ocupada', 'Libre', 'Limpieza', 'Reservada'] as const;
export type BedStatus = (typeof BED_STATUSES)[number];

export const AUDIT_EVENT_KINDS = ['Integración', 'Operación', 'Acceso', 'Clínico'] as const;
export type AuditEventKind = (typeof AUDIT_EVENT_KINDS)[number];

export const WORKFLOW_STATUSES = ['Activo', 'Pausado', 'Error'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  P1: 'Atención inmediata',
  P2: 'Muy urgente',
  P3: 'Urgente',
  P4: 'No urgente',
};

export const PRIORITY_VISUAL_CLASSES: Record<Priority, string> = {
  P1: 'bg-[#fbe3e1] text-[#a92e29]',
  P2: 'bg-[#fff1d8] text-[#a56510]',
  P3: 'bg-[#def1ef] text-[#0c7770]',
  P4: 'bg-[#e8eef4] text-[#577083]',
};

export const STATUS_VISUAL_CLASSES: Record<string, string> = {
  Operativo: 'text-[#187f72] bg-[#e0f2ee]',
  Disponible: 'text-[#187f72] bg-[#e0f2ee]',
  Listo: 'text-[#187f72] bg-[#e0f2ee]',
  'En turno': 'text-[#187f72] bg-[#e0f2ee]',
  Validado: 'text-[#187f72] bg-[#e0f2ee]',
  Crítico: 'text-[#a92e29] bg-[#fbe3e1]',
  Revisar: 'text-[#a92e29] bg-[#fbe3e1]',
};

export const AUDIT_EVENT_KIND_LABELS: Record<AuditEventKind, string> = {
  Integración: 'Integración',
  Operación: 'Operación',
  Acceso: 'Acceso',
  Clínico: 'Clínico',
};

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Crítica',
  warning: 'Advertencia',
  info: 'Información',
};

export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  'En atención': 'En atención',
  'En espera': 'En espera',
  Observación: 'Observación',
  Alta: 'Alta',
};

export type VitalSigns = {
  fc: number;
  pa: string;
  spo2: number;
  temp: number;
  recordedAt?: string;
};

export type Patient = {
  id: string;
  record: string;
  name: string;
  age: number;
  sex: 'F' | 'M';
  blood: string;
  allergies: string[];
  chronic: string[];
  medications: string[];
  status: PatientStatus;
  lastVisit: string;
  phone: string;
};

export type EmergencyEpisode = {
  id: string;
  patientId: string;
  reason: string;
  vitals: VitalSigns;
  priority: Priority;
  status: EpisodeStatus;
  area: string;
  doctor: string;
  bed: string;
  wait: string;
  observations: string;
  createdAt: string;
};

export type Episode = EmergencyEpisode;

export type TriageResult = {
  id: string;
  episodeId: string;
  patientId: string;
  priority: Priority;
  status: TriageStatus;
  source: string;
  receivedAt: string;
  confirmedAt?: string;
  notes?: string;
};

export type Alert = {
  id: string;
  severity: AlertSeverity;
  tone: AlertSeverity;
  title: string;
  detail: string;
  time: string;
  patientId?: string;
  episodeId?: string;
  acknowledged?: boolean;
};

export type Bed = {
  id: string;
  area: string;
  type: string;
  status: BedStatus;
  patient: string;
  patientId?: string;
  since: string;
  acuity: Priority | '—';
};

export type AreaCapacity = {
  name: string;
  used: number;
  total: number;
  note: string;
  color: string;
};

export type ClinicalSummary = {
  patientId: string;
  episodeId?: string;
  diagnoses: string[];
  allergies: string[];
  chronicConditions: string[];
  medications: string[];
  notes: string[];
  lastUpdatedAt: string;
};

export type CareEncounter = {
  id: string;
  patientId: string;
  episodeId: string;
  status: 'Abierta' | 'En curso' | 'Cerrada';
  clinician: string;
  startedAt: string;
  closedAt?: string;
  assessment?: string;
  plan?: string;
};

export type ClinicalReport = {
  id: string;
  patientId: string;
  episodeId?: string;
  type: 'Resumen de atención' | 'Informe de laboratorio' | 'Alta';
  status: 'Borrador' | 'Validado' | 'Enviado';
  issuedAt: string;
  summary: string;
};

export type AuditEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  detail: string;
  kind: AuditEventKind;
};

export type DashboardSummary = {
  patientsToday: number;
  patientsTodayDelta: number;
  emergencyCount: number;
  criticalEmergencyCount: number;
  averageWaitMinutes: number;
  averageWaitDeltaMinutes: number;
  freeBeds: number;
  totalBeds: number;
  openAlerts: number;
  lastSynchronizedAt: string;
};

export type SystemStatus = {
  name: string;
  status: 'Operativo' | 'Latencia' | 'Revisar';
  detail: string;
  latency: string;
};

export type OperatingRoom = {
  id: string;
  procedure: string;
  doctor: string;
  time: string;
  status: 'Preparación' | 'Disponible' | 'Programado';
};

export type Ambulance = {
  id: string;
  plate: string;
  crew: string;
  status: 'En base' | 'En ruta' | 'En traslado' | 'Mantenimiento';
  location: string;
  eta: string;
};

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
  shift: string;
  status: 'En turno' | 'En quirófano' | 'Próximo turno';
  patients: number;
};

export type LabOrder = {
  id: string;
  patient: string;
  record: string;
  study: string;
  requested: string;
  status: 'En proceso' | 'Listo' | 'Validado';
  result: string;
  urgency: 'Urgente' | 'Rutina';
};

export type MedicationStock = {
  id: string;
  name: string;
  presentation: string;
  stock: number;
  minimum: number;
  location: string;
  status: 'Disponible' | 'Reabastecer' | 'Crítico';
};

export type AutomationWorkflow = {
  id: string;
  name: string;
  source: string;
  target: string;
  status: WorkflowStatus;
  runs: number;
  last: string;
};

export type RegisterPatientInput = Pick<Patient, 'name' | 'age' | 'sex' | 'phone'>;
export type WorkflowRunResult = { workflowId: string; status: 'success'; ranAt: string };
export type ExternalTriageInput = { episodeId: string };
export type ExternalTriageResponse = TriageResult;

export const patientSchema = z.object({
  id: z.string(),
  record: z.string(),
  name: z.string(),
  age: z.number(),
  sex: z.enum(['F', 'M']),
  blood: z.string(),
  allergies: z.array(z.string()),
  chronic: z.array(z.string()),
  medications: z.array(z.string()),
  status: z.enum(PATIENT_STATUSES),
  lastVisit: z.string(),
  phone: z.string(),
}) satisfies z.ZodType<Patient>;

export const emergencyEpisodeSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  reason: z.string(),
  vitals: z.object({
    fc: z.number(),
    pa: z.string(),
    spo2: z.number(),
    temp: z.number(),
    recordedAt: z.string().optional(),
  }),
  priority: z.enum(PRIORITIES),
  status: z.enum(EPISODE_STATUSES),
  area: z.string(),
  doctor: z.string(),
  bed: z.string(),
  wait: z.string(),
  observations: z.string(),
  createdAt: z.string(),
}) satisfies z.ZodType<EmergencyEpisode>;

export const triageResultSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  patientId: z.string(),
  priority: z.enum(PRIORITIES),
  status: z.enum(TRIAGE_STATUSES),
  source: z.string(),
  receivedAt: z.string(),
  confirmedAt: z.string().optional(),
  notes: z.string().optional(),
}) satisfies z.ZodType<TriageResult>;

export const registeredPatientSchema = patientSchema;
export const workflowRunResultSchema = z.object({
  workflowId: z.string(),
  status: z.literal('success'),
  ranAt: z.string(),
}) satisfies z.ZodType<WorkflowRunResult>;
