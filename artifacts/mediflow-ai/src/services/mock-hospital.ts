import {
  alerts,
  auditEvents,
  beds,
  clinicalReports,
  clinicalSummaries,
  dashboardSummary,
  episodes,
  patients,
  systemServices,
  triageResults,
  type Patient,
} from '@/data/mock-data';
import type {
  CareEncounter,
  ClinicalReport,
  ClinicalSummary,
  DashboardSummary,
  EmergencyEpisode,
  ExternalTriageResponse,
  RegisterPatientInput,
  SystemStatus,
  TriageResult,
  WorkflowRunResult,
} from '@/domain/contracts';
import type { HospitalService } from './hospital-service';

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let patientSequence = 1080;

export function createMockHospitalService(): HospitalService {
  return {
    async listPatients() {
      return patients.map((patient) => ({ ...patient, allergies: [...patient.allergies], chronic: [...patient.chronic], medications: [...patient.medications] }));
    },
    async listEpisodes() {
      return episodes.map((episode) => ({ ...episode, vitals: { ...episode.vitals } }));
    },
    async listTriageQueue() {
      return triageResults.map((result) => ({ ...result }));
    },
    async getDashboardSummary() {
      return { ...dashboardSummary };
    },
    async listAlerts() {
      return alerts.map((alert) => ({ ...alert }));
    },
    async listBeds() {
      return beds.map((bed) => ({ ...bed }));
    },
    async getClinicalSummary(patientId: string): Promise<ClinicalSummary> {
      const summary = clinicalSummaries.find((item) => item.patientId === patientId);
      if (!summary) throw new Error(`No existe resumen clínico demo para ${patientId}.`);
      return { ...summary, diagnoses: [...summary.diagnoses], allergies: [...summary.allergies], chronicConditions: [...summary.chronicConditions], medications: [...summary.medications], notes: [...summary.notes] };
    },
    async getCareEncounter(episodeId: string): Promise<CareEncounter> {
      const episode = episodes.find((item) => item.id === episodeId);
      if (!episode) throw new Error(`No existe episodio demo para ${episodeId}.`);
      return {
        id: `CARE-${episode.id}`,
        patientId: episode.patientId,
        episodeId,
        status: episode.status === 'Completado' ? 'Cerrada' : 'En curso',
        clinician: episode.doctor,
        startedAt: episode.createdAt,
        assessment: episode.observations,
      };
    },
    async listReports(): Promise<ClinicalReport[]> {
      return clinicalReports.map((report) => ({ ...report }));
    },
    async listAuditEvents() {
      return auditEvents.map((event) => ({ ...event }));
    },
    async getSystemStatus(): Promise<SystemStatus[]> {
      return systemServices.map((service) => ({ ...service }));
    },
    async registerPatient(input: RegisterPatientInput): Promise<Patient> {
      await wait(350);
      const id = `pt-${patientSequence++}`;
      return {
        id,
        record: `MF-240${patientSequence}`,
        ...input,
        blood: 'O+',
        allergies: ['Pendiente de registro'],
        chronic: ['Pendiente de registro'],
        medications: ['Pendiente de registro'],
        status: 'En espera',
        lastVisit: 'Ahora',
      };
    },
    async runWorkflow(workflowId: string): Promise<WorkflowRunResult> {
      await wait(700);
      return {
        workflowId,
        status: 'success',
        ranAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      };
    },
    async receiveExternalTriage({ episodeId }): Promise<ExternalTriageResponse> {
      await wait(500);
      const episode = episodes.find((item) => item.id === episodeId);
      if (!episode) throw new Error(`No existe episodio demo para ${episodeId}.`);
      return {
        id: `TR-${episode.id.slice(-4)}`,
        episodeId,
        patientId: episode.patientId,
        source: 'n8n / webhook triage-v2',
        priority: episode.priority,
        status: 'Confirmado',
        receivedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      };
    },
  };
}

export { systemServices };

// Compatibilidad temporal para las pantallas existentes. Las pantallas llaman
// a la fachada en services/hospital.ts; ninguna de estas funciones conoce URLs.
const mockHospital = createMockHospitalService();
export const registerPatient = (input: RegisterPatientInput) => mockHospital.registerPatient(input);
export const runWorkflow = (workflowId: string) => mockHospital.runWorkflow(workflowId);
export const receiveExternalTriage = (episodeId: string) => mockHospital.receiveExternalTriage({ episodeId });

export type { DashboardSummary, EmergencyEpisode, TriageResult };
export { dashboardSummary };
