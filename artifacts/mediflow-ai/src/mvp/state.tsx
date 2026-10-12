import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  areas as demoAreas,
  auditEvents as demoActivity,
  beds as demoBeds,
  dashboardSummary as demoDashboard,
  episodes as demoEpisodes,
  patients as demoPatients,
  staff as demoStaff,
  triageResults as demoEvaluations,
} from '@/data/mock-data';
import { integrationConfig } from '@/integration/config';
import type {
  AuditEvent,
  Bed,
  DashboardSummary,
  Episode,
  Patient,
  TriageResult,
} from '@/domain/contracts';
import { hospitalService } from '@/services/hospital';
import type { MvpArea, MvpBed, MvpDoctor, MvpEpisode, MvpPatient, MvpState } from './types';

export type MvpAction =
  | { type: 'loading' }
  | { type: 'hydrate'; payload: Partial<MvpState>; errors?: string[] }
  | { type: 'register-demo'; patient: MvpPatient; episode: MvpEpisode; event: AuditEvent }
  | { type: 'register-live'; patient: MvpPatient }
  | { type: 'reassess'; episode: MvpEpisode; event: AuditEvent }
  | { type: 'apply-evaluation'; episodeId: string; result: TriageResult; event: AuditEvent }
  | { type: 'confirm-priority'; episodeId: string; priority: MvpEpisode['priority']; event: AuditEvent }
  | { type: 'set-episode-status'; episodeId: string; status: MvpEpisode['status']; event: AuditEvent }
  | { type: 'set-needs-reevaluation'; episodeId: string; needsReassessment: boolean; event: AuditEvent }
  | { type: 'assign-bed'; episodeId: string; bedId: string; event: AuditEvent }
  | { type: 'release-bed'; episodeId: string; bedId: string; event: AuditEvent }
  | { type: 'assign-doctor'; episodeId: string; doctorId: string; event: AuditEvent }
  | { type: 'set-doctor-availability'; doctorId: string; availability: MvpDoctor['availability']; event: AuditEvent }
  | { type: 'add-doctor'; doctor: MvpDoctor; event: AuditEvent }
  | { type: 'add-bed'; bed: MvpBed; event: AuditEvent }
  | { type: 'add-area'; area: MvpArea; event: AuditEvent };

const isDemo = integrationConfig.dataSource === 'mock';

function toMvpPatient(patient: Patient): MvpPatient {
  return { ...patient, sex: patient.sex ?? 'No especificado' };
}

function toMvpEpisode(episode: (typeof demoEpisodes)[number]): MvpEpisode {
  const sampleResult = demoEvaluations.find((item) => item.episodeId === episode.id);
  return {
    ...episode,
    symptoms: episode.observations,
    status:
      episode.status === 'Completado'
        ? 'Atendido'
        : episode.status === 'Observación'
          ? 'En atención'
          : episode.status,
    triageStatus: episode.priority ? 'Recibido' : 'Pendiente',
    proposedPriority: sampleResult?.priority ?? null,
    prioritySource: episode.priority ? 'Muestra de demostración · no evaluada en vivo' : undefined,
    priorityNotes: sampleResult
      ? 'Registro estático para mostrar el formato. No se evaluó en tiempo real.'
      : undefined,
  };
}

function toMvpArea(area: (typeof demoAreas)[number], index: number): MvpArea {
  const slug = area.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    ...area,
    id: `AREA-${slug || index + 1}`,
    attentionType: area.name,
    isAvailable: true,
  };
}

function initialState(): MvpState {
  if (!isDemo) {
    return {
      patients: [],
      episodes: [],
      beds: [],
      doctors: [],
      areas: [],
      evaluations: [],
      activity: [],
      dashboardSummary: null,
      loading: true,
      loadErrors: [],
    };
  }

  return {
    patients: demoPatients.map(toMvpPatient),
    episodes: demoEpisodes.map(toMvpEpisode),
    beds: demoBeds.map((bed) => ({ ...bed })),
    doctors: demoStaff.map((member) => ({
      ...member,
      availability:
        member.status === 'En turno' && member.patients < 4
          ? 'Disponible'
          : member.status === 'En turno'
            ? 'Asignado'
            : 'No disponible',
    })),
    areas: demoAreas.map(toMvpArea),
    evaluations: demoEvaluations.map((result) => ({
      ...result,
      source: 'Ejemplo estático de demostración · no es una evaluación en vivo',
    })),
    activity: demoActivity.map((event) => ({
      ...event,
      actor: event.actor.startsWith('Sistema n8n') ? 'Ejemplo de demostración' : event.actor,
      kind: event.kind,
    })).filter((event) => /ingreso|triaje|cama|episodio|prioridad/i.test(`${event.action} ${event.detail}`)),
    dashboardSummary: { ...demoDashboard },
    loading: false,
    loadErrors: [],
  };
}

function resourceIdExists(state: MvpState, id: string) {
  const normalized = id.trim().toLocaleUpperCase('es-BO');
  return [
    ...state.beds.map((resource) => resource.id),
    ...state.doctors.map((resource) => resource.id),
    ...state.areas.map((resource) => resource.id),
  ].some((existing) => existing.toLocaleUpperCase('es-BO') === normalized);
}

function normalizeResourceName(name: string) {
  return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-BO');
}

function appendEvent(activity: AuditEvent[], event: AuditEvent) {
  return [event, ...activity].slice(0, 30);
}

function reducer(state: MvpState, action: MvpAction): MvpState {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, loadErrors: [] };
    case 'hydrate':
      return {
        ...state,
        ...action.payload,
        loading: false,
        loadErrors: action.errors ?? [],
      };
    case 'register-demo':
      return {
        ...state,
        patients: [action.patient, ...state.patients],
        episodes: [action.episode, ...state.episodes],
        activity: appendEvent(state.activity, action.event),
      };
    case 'register-live':
      return { ...state, patients: [action.patient, ...state.patients] };
    case 'reassess':
      return {
        ...state,
        episodes: state.episodes.map((episode) =>
          episode.id === action.episode.id ? action.episode : episode,
        ),
        activity: appendEvent(state.activity, action.event),
      };
    case 'apply-evaluation':
      return {
        ...state,
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId
            ? {
                ...episode,
                proposedPriority: action.result.priority,
                triageStatus: action.result.status,
                prioritySource: action.result.source,
                priorityNotes: action.result.notes,
              }
            : episode,
        ),
        evaluations: [action.result, ...state.evaluations],
        activity: isDemo ? appendEvent(state.activity, action.event) : state.activity,
      };
    case 'confirm-priority': {
      const target = state.episodes.find((episode) => episode.id === action.episodeId);
      if (
        !target ||
        target.status === 'Atendido' ||
        !action.priority ||
        target.proposedPriority !== action.priority
      ) {
        return state;
      }
      return {
        ...state,
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId
            ? {
                ...episode,
                priority: action.priority,
                triageStatus: 'Confirmado',
              }
            : episode,
        ),
        activity: appendEvent(state.activity, action.event),
      };
    }
    case 'set-episode-status':
      {
        const episode = state.episodes.find((item) => item.id === action.episodeId);
        if (!episode || (episode.status === 'Atendido' && action.status !== 'Atendido')) {
          return state;
        }
        const bed = episode && state.beds.find((item) => item.id === episode.bed);
        const completing = action.status === 'Atendido';
        const releasing = completing && Boolean(bed?.patientId);
        const releasedBedId = releasing ? bed?.id : undefined;
        const releasedDoctor = completing ? episode?.doctor : undefined;
        return {
        ...state,
        beds: releasing
          ? state.beds.map((item) =>
              item.id === releasedBedId
                ? {
                    ...item,
                    status: 'Libre',
                    patient: '—',
                    patientId: undefined,
                    since: '—',
                    acuity: '—',
                  }
                : item,
            )
          : state.beds,
        areas: releasing && bed
          ? state.areas.map((area) =>
              area.name === bed.area
                ? { ...area, used: Math.max(0, area.used - 1) }
                : area,
            )
          : state.areas,
        doctors: releasedDoctor && releasedDoctor !== 'Sin asignar'
          ? state.doctors.map((doctor) =>
              doctor.name === releasedDoctor
                ? {
                    ...doctor,
                    patients: Math.max(0, doctor.patients - 1),
                    availability: doctor.patients <= 1 ? 'Disponible' : doctor.availability,
                  }
                : doctor,
            )
          : state.doctors,
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId
            ? {
                ...episode,
                status: action.status,
                ...(action.status === 'Atendido' ? { bed: 'Sin asignar', doctor: 'Sin asignar' } : {}),
              }
            : episode,
        ),
        patients: state.patients.map((patient) => {
          const episode = state.episodes.find((item) => item.id === action.episodeId);
          if (!episode || patient.id !== episode.patientId) return patient;
          return {
            ...patient,
            status:
              action.status === 'Atendido'
                ? 'Alta'
                : action.status === 'En atención'
                  ? 'En atención'
                  : 'En espera',
          };
        }),
        activity: appendEvent(state.activity, action.event),
      };
      }
    case 'set-needs-reevaluation':
      if (
        !state.episodes.some((episode) => episode.id === action.episodeId && episode.status !== 'Atendido')
      ) {
        return state;
      }
      return {
        ...state,
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId
            ? { ...episode, needsReassessment: action.needsReassessment }
            : episode,
        ),
        activity: appendEvent(state.activity, action.event),
      };
    case 'assign-bed': {
      const targetBed = state.beds.find((bed) => bed.id === action.bedId);
      const targetEpisode = state.episodes.find((episode) => episode.id === action.episodeId);
      const targetArea = targetBed && state.areas.find((area) => area.name === targetBed.area);
      if (
        !targetBed ||
        targetBed.status !== 'Libre' ||
        targetBed.availability === 'No disponible' ||
        targetArea?.isAvailable === false ||
        !targetEpisode ||
        targetEpisode.status === 'Atendido' ||
        (targetEpisode.bed && !['Sin asignar', 'Pendiente', '—'].includes(targetEpisode.bed)) ||
        state.beds.some((bed) => bed.patientId === targetEpisode.patientId)
      ) {
        return state;
      }
      return {
        ...state,
        beds: state.beds.map((bed) => {
          if (bed.id !== action.bedId) return bed;
          const patient = state.patients.find((item) => item.id === targetEpisode.patientId);
          return {
            ...bed,
            status: 'Ocupada',
            patient: patient?.name ?? 'Paciente asignado',
            patientId: patient?.id,
            since: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
          };
        }),
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId
            ? {
                ...episode,
                bed: action.bedId,
                area: state.beds.find((bed) => bed.id === action.bedId)?.area ?? episode.area,
              }
            : episode,
        ),
        areas: state.areas.map((area) => {
          return targetBed && area.name === targetBed.area
            ? { ...area, used: Math.min(area.total, area.used + 1) }
            : area;
        }),
        activity: appendEvent(state.activity, action.event),
      };
    }
    case 'release-bed': {
      const targetBed = state.beds.find((bed) => bed.id === action.bedId);
      const targetEpisode = state.episodes.find((episode) => episode.id === action.episodeId);
      if (
        !targetBed ||
        targetBed.status !== 'Ocupada' ||
        !targetEpisode ||
        targetBed.patientId !== targetEpisode.patientId ||
        targetEpisode.bed !== action.bedId
      ) {
        return state;
      }
      return {
        ...state,
        beds: state.beds.map((bed) =>
          bed.id === action.bedId
            ? { ...bed, status: 'Libre', patient: '—', patientId: undefined, since: '—', acuity: '—' }
            : bed,
        ),
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId ? { ...episode, bed: 'Sin asignar' } : episode,
        ),
        areas: state.areas.map((area) => {
          return targetBed && area.name === targetBed.area
            ? { ...area, used: Math.max(0, area.used - 1) }
            : area;
        }),
        activity: appendEvent(state.activity, action.event),
      };
    }
    case 'assign-doctor': {
      const targetEpisode = state.episodes.find((episode) => episode.id === action.episodeId);
      const targetDoctor = state.doctors.find((doctor) => doctor.id === action.doctorId);
      if (
        !targetEpisode ||
        targetEpisode.status === 'Atendido' ||
        (targetEpisode.doctor && targetEpisode.doctor !== 'Sin asignar') ||
        !targetDoctor ||
        targetDoctor.availability !== 'Disponible'
      ) {
        return state;
      }
      return {
        ...state,
        doctors: state.doctors.map((doctor) =>
          doctor.id === action.doctorId
            ? { ...doctor, availability: 'Asignado', patients: doctor.patients + 1 }
            : doctor,
        ),
        episodes: state.episodes.map((episode) =>
          episode.id === action.episodeId
            ? { ...episode, doctor: targetDoctor.name }
            : episode,
        ),
        activity: appendEvent(state.activity, action.event),
      };
    }
    case 'set-doctor-availability': {
      const targetDoctor = state.doctors.find((doctor) => doctor.id === action.doctorId);
      if (!targetDoctor || targetDoctor.status !== 'En turno' || targetDoctor.patients > 0) {
        return state;
      }
      return {
        ...state,
        doctors: state.doctors.map((doctor) =>
          doctor.id === action.doctorId
            ? { ...doctor, availability: action.availability }
            : doctor,
        ),
        activity: appendEvent(state.activity, action.event),
      };
    }
    case 'add-doctor':
      if (!isDemo || resourceIdExists(state, action.doctor.id)) return state;
      return {
        ...state,
        doctors: [action.doctor, ...state.doctors],
        activity: appendEvent(state.activity, action.event),
      };
    case 'add-bed': {
      if (!isDemo || resourceIdExists(state, action.bed.id)) return state;
      const area = state.areas.find((item) => item.name === action.bed.area);
      if (!area || !area.isAvailable) return state;
      return {
        ...state,
        beds: [action.bed, ...state.beds],
        areas: state.areas.map((item) =>
          item.name === action.bed.area
            ? {
                ...item,
                total: item.total + 1,
                unavailableBeds: (item.unavailableBeds ?? 0) + (action.bed.availability === 'No disponible' ? 1 : 0),
              }
            : item,
        ),
        activity: appendEvent(state.activity, action.event),
      };
    }
    case 'add-area':
      if (
        !isDemo ||
        resourceIdExists(state, action.area.id) ||
        state.areas.some((area) => normalizeResourceName(area.name) === normalizeResourceName(action.area.name))
      ) {
        return state;
      }
      return {
        ...state,
        areas: [action.area, ...state.areas],
        activity: appendEvent(state.activity, action.event),
      };
    default:
      return state;
  }
}

type ContextValue = {
  state: MvpState;
  dispatch: Dispatch<MvpAction>;
  demoMode: boolean;
  refresh: () => Promise<void>;
};

const StoreContext = createContext<ContextValue | null>(null);

export function MvpStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const refresh = useCallback(async () => {
    if (isDemo) return;
    dispatch({ type: 'loading' });
    const requests = await Promise.allSettled([
      hospitalService.listPatients(),
      hospitalService.listEpisodes(),
      hospitalService.listTriageQueue(),
      hospitalService.listBeds(),
      hospitalService.getDashboardSummary(),
      hospitalService.listAuditEvents(),
    ]);

    const errors: string[] = [];
    const [patients, episodes, evaluations, beds, dashboardSummary, activity] = requests.map(
      (result, index) => {
        if (result.status === 'fulfilled') return result.value;
        errors.push(
          [
            'No fue posible cargar pacientes.',
            'No fue posible cargar episodios.',
            'No fue posible cargar clasificaciones.',
            'No fue posible cargar camas.',
            'No fue posible cargar el resumen del panel.',
            'No fue posible cargar la actividad.',
          ][index],
        );
        return undefined;
      },
    );

    const next: Partial<MvpState> = {};
    if (patients) next.patients = (patients as Patient[]).map(toMvpPatient);
    if (evaluations) next.evaluations = evaluations as TriageResult[];
    if (episodes) {
      const triageResults = (evaluations ?? []) as TriageResult[];
      next.episodes = (episodes as Episode[]).map((episode) => {
        const status =
          episode.status === 'Completado'
            ? 'Atendido'
            : episode.status === 'Observación'
              ? 'En atención'
              : episode.status;
        const triage = triageResults.find((item) => item.episodeId === episode.id);
        return {
          ...episode,
          symptoms: episode.observations,
          status,
          proposedPriority: triage?.priority ?? null,
          triageStatus: triage?.status ?? 'Pendiente',
          prioritySource: triage?.source,
          priorityNotes: triage?.notes,
        };
      });
    }
    if (beds) next.beds = beds as Bed[];
    if (dashboardSummary) next.dashboardSummary = dashboardSummary as DashboardSummary;
    if (activity) next.activity = activity as AuditEvent[];
    dispatch({ type: 'hydrate', payload: next, errors });
  }, []);

  useEffect(() => {
    if (!isDemo) void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ state, dispatch, demoMode: isDemo, refresh }),
    [state, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useMvpStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useMvpStore debe usarse dentro de MvpStoreProvider.');
  return context;
}

export function createEvent(action: string, detail: string, kind: AuditEvent['kind'] = 'Operación'): AuditEvent {
  const now = new Date();
  return {
    id: `LOCAL-${now.getTime()}-${Math.round(Math.random() * 1000)}`,
    time: now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: isDemo ? 'Personal de demostración' : 'Usuario de sesión',
    action,
    detail,
    kind,
  };
}
