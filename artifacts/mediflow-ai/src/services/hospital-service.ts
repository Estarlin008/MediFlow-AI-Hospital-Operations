import { z } from 'zod';

import {
  emergencyEpisodeSchema,
  patientSchema,
  registeredPatientSchema,
  triageResultSchema,
  workflowRunResultSchema,
  type Alert,
  type AuditEvent,
  type Bed,
  type CareEncounter,
  type ClinicalReport,
  type ClinicalSummary,
  type DashboardSummary,
  type EmergencyEpisode,
  type ExternalTriageInput,
  type ExternalTriageResponse,
  type Patient,
  type RegisterPatientInput,
  type SystemStatus,
  type TriageResult,
  type WorkflowRunResult,
} from '@/domain/contracts';
import { integrationConfig, resolveN8nRoute } from '@/integration/config';
import { IntegrationHttpClient } from '@/integration/http-client';

export type HospitalService = {
  listPatients(): Promise<Patient[]>;
  listEpisodes(): Promise<EmergencyEpisode[]>;
  listTriageQueue(): Promise<TriageResult[]>;
  getDashboardSummary(): Promise<DashboardSummary>;
  listAlerts(): Promise<Alert[]>;
  listBeds(): Promise<Bed[]>;
  getClinicalSummary(patientId: string): Promise<ClinicalSummary>;
  getCareEncounter(episodeId: string): Promise<CareEncounter>;
  listReports(): Promise<ClinicalReport[]>;
  listAuditEvents(): Promise<AuditEvent[]>;
  getSystemStatus(): Promise<SystemStatus[]>;
  registerPatient(input: RegisterPatientInput): Promise<Patient>;
  runWorkflow(workflowId: string): Promise<WorkflowRunResult>;
  receiveExternalTriage(input: ExternalTriageInput): Promise<ExternalTriageResponse>;
};

const dashboardSummarySchema = z.object({
  patientsToday: z.number(),
  patientsTodayDelta: z.number(),
  emergencyCount: z.number(),
  criticalEmergencyCount: z.number(),
  averageWaitMinutes: z.number(),
  averageWaitDeltaMinutes: z.number(),
  freeBeds: z.number(),
  totalBeds: z.number(),
  openAlerts: z.number(),
  lastSynchronizedAt: z.string(),
}) satisfies z.ZodType<DashboardSummary>;

const alertSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  tone: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  detail: z.string(),
  time: z.string(),
  patientId: z.string().optional(),
  episodeId: z.string().optional(),
  acknowledged: z.boolean().optional(),
}) satisfies z.ZodType<Alert>;

const bedSchema = z.object({
  id: z.string(),
  area: z.string(),
  type: z.string(),
  status: z.enum(['Ocupada', 'Libre', 'Limpieza', 'Reservada']),
  patient: z.string(),
  patientId: z.string().optional(),
  since: z.string(),
  acuity: z.union([z.enum(['P1', 'P2', 'P3', 'P4']), z.literal('—')]),
}) satisfies z.ZodType<Bed>;

const clinicalSummarySchema = z.object({
  patientId: z.string(),
  episodeId: z.string().optional(),
  diagnoses: z.array(z.string()),
  allergies: z.array(z.string()),
  chronicConditions: z.array(z.string()),
  medications: z.array(z.string()),
  notes: z.array(z.string()),
  lastUpdatedAt: z.string(),
}) satisfies z.ZodType<ClinicalSummary>;

const careEncounterSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  episodeId: z.string(),
  status: z.enum(['Abierta', 'En curso', 'Cerrada']),
  clinician: z.string(),
  startedAt: z.string(),
  closedAt: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
}) satisfies z.ZodType<CareEncounter>;

const clinicalReportSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  episodeId: z.string().optional(),
  type: z.enum(['Resumen de atención', 'Informe de laboratorio', 'Alta']),
  status: z.enum(['Borrador', 'Validado', 'Enviado']),
  issuedAt: z.string(),
  summary: z.string(),
}) satisfies z.ZodType<ClinicalReport>;

const auditEventSchema = z.object({
  id: z.string(),
  time: z.string(),
  actor: z.string(),
  action: z.string(),
  detail: z.string(),
  kind: z.enum(['Integración', 'Operación', 'Acceso', 'Clínico']),
}) satisfies z.ZodType<AuditEvent>;

const systemStatusSchema = z.object({
  name: z.string(),
  status: z.enum(['Operativo', 'Latencia', 'Revisar']),
  detail: z.string(),
  latency: z.string(),
}) satisfies z.ZodType<SystemStatus>;

export function createN8nHospitalService(client = new IntegrationHttpClient()): HospitalService {
  const { routes } = integrationConfig;
  return {
    listPatients: () => client.request(routes.patients, patientSchema.array()),
    listEpisodes: () => client.request(routes.episodes, emergencyEpisodeSchema.array()),
    listTriageQueue: () => client.request(routes.triageQueue, triageResultSchema.array()),
    getDashboardSummary: () => client.request(routes.dashboard, dashboardSummarySchema),
    listAlerts: () => client.request(routes.alerts, alertSchema.array()),
    listBeds: () => client.request(routes.beds, bedSchema.array()),
    getClinicalSummary: (patientId) =>
      client.request(resolveN8nRoute(routes.clinicalSummary, { patientId }), clinicalSummarySchema),
    getCareEncounter: (episodeId) =>
      client.request(resolveN8nRoute(routes.care, { episodeId }), careEncounterSchema),
    listReports: () => client.request(routes.reports, clinicalReportSchema.array()),
    listAuditEvents: () => client.request(routes.audit, auditEventSchema.array()),
    getSystemStatus: () => client.request(routes.system, systemStatusSchema.array()),
    registerPatient: (input) =>
      client.request(routes.registerPatient, registeredPatientSchema, { method: 'POST', body: input }),
    runWorkflow: (workflowId) =>
      client.request(resolveN8nRoute(routes.runWorkflow, { workflowId }), workflowRunResultSchema, {
        method: 'POST',
        body: { workflowId },
      }),
    receiveExternalTriage: ({ episodeId }) =>
      client.request(
        resolveN8nRoute(routes.receiveExternalTriage, { episodeId }),
        triageResultSchema,
        { method: 'POST', body: { episodeId } },
      ),
  };
}
