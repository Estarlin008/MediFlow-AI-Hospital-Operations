import type {
  AreaCapacity,
  AuditEvent,
  Bed,
  DashboardSummary,
  Patient,
  Priority,
  StaffMember,
  TriageResult,
} from '@/domain/contracts';

export type MvpPatient = Omit<Patient, 'age' | 'sex'> & {
  age: number | null;
  sex: 'F' | 'M' | 'No especificado';
  identityType?: string;
  identityNumber?: string;
  birthDate?: string;
  relevantHistory?: string;
};

export type MvpEpisode = {
  id: string;
  patientId: string;
  reason: string;
  symptoms: string;
  duration?: string;
  vitals: {
    fc?: number;
    pa?: string;
    spo2?: number;
    temp?: number;
    respiratoryRate?: number;
    consciousness?: string;
    recordedAt?: string;
  };
  priority: Priority | null;
  proposedPriority?: Priority | null;
  status: 'En espera' | 'En atención' | 'Atendido';
  area: string;
  doctor: string;
  bed: string;
  wait: string;
  observations: string;
  createdAt: string;
  lastReassessmentAt?: string;
  needsReassessment?: boolean;
  prioritySource?: string;
  priorityNotes?: string;
  triageStatus?: 'Pendiente' | 'Recibido' | 'Confirmado' | 'Rechazado' | 'No disponible';
  reassessmentHistory?: Array<{
    at: string;
    vitals: MvpEpisode['vitals'];
    symptomChange: string;
    observations: string;
  }>;
};

export type MvpDoctor = StaffMember & {
  availability: 'Disponible' | 'Asignado' | 'No disponible';
};

export type MvpState = {
  patients: MvpPatient[];
  episodes: MvpEpisode[];
  beds: Bed[];
  doctors: MvpDoctor[];
  areas: AreaCapacity[];
  evaluations: TriageResult[];
  activity: AuditEvent[];
  dashboardSummary: DashboardSummary | null;
  loading: boolean;
  loadErrors: string[];
};

export type IntakeForm = {
  identityType: string;
  identityNumber: string;
  name: string;
  age: string;
  birthDate: string;
  sex: MvpPatient['sex'];
  phone: string;
  reason: string;
  symptoms: string;
  duration: string;
  relevantHistory: string;
  allergies: string;
  heartRate: string;
  bloodPressure: string;
  respiratoryRate: string;
  temperature: string;
  oxygenSaturation: string;
  consciousness: string;
};

export type ReassessmentForm = {
  heartRate: string;
  bloodPressure: string;
  respiratoryRate: string;
  temperature: string;
  oxygenSaturation: string;
  consciousness: string;
  symptomChange: string;
  observations: string;
};
