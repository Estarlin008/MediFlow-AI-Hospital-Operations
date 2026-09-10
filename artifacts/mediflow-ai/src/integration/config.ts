import { DATA_SOURCE_MODES, type DataSourceMode } from '@/domain/contracts';

export const DEFAULT_N8N_ROUTES = {
  registerPatient: '/webhook/mediflow/patients',
  runWorkflow: '/webhook/mediflow/workflows/:workflowId/run',
  receiveExternalTriage: '/webhook/mediflow/triage/:episodeId',
  patients: '/webhook/mediflow/patients',
  episodes: '/webhook/mediflow/episodes',
  triageQueue: '/webhook/mediflow/triage',
  dashboard: '/webhook/mediflow/dashboard',
  alerts: '/webhook/mediflow/alerts',
  beds: '/webhook/mediflow/beds',
  clinicalSummary: '/webhook/mediflow/patients/:patientId/summary',
  care: '/webhook/mediflow/episodes/:episodeId/care',
  reports: '/webhook/mediflow/reports',
  audit: '/webhook/mediflow/audit',
  system: '/webhook/mediflow/system',
} as const;

export type N8nRouteKey = keyof typeof DEFAULT_N8N_ROUTES;
export type N8nRoutes = Record<N8nRouteKey, string>;

function readDataSource(): DataSourceMode {
  const candidate = import.meta.env.VITE_DATA_SOURCE;
  return DATA_SOURCE_MODES.includes(candidate as DataSourceMode)
    ? (candidate as DataSourceMode)
    : 'mock';
}

function readRoutes(): N8nRoutes {
  const raw = import.meta.env.VITE_N8N_ROUTES_JSON;
  if (!raw) return { ...DEFAULT_N8N_ROUTES };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(DEFAULT_N8N_ROUTES).map(([key, fallback]) => [
        key,
        typeof parsed[key] === 'string' && parsed[key] ? parsed[key] : fallback,
      ]),
    ) as N8nRoutes;
  } catch {
    return { ...DEFAULT_N8N_ROUTES };
  }
}

export const integrationConfig = {
  dataSource: readDataSource(),
  n8nBaseUrl: import.meta.env.VITE_N8N_BASE_URL?.replace(/\/+$/, '') || null,
  requestTimeoutMs: Number(import.meta.env.VITE_N8N_TIMEOUT_MS) || 8000,
  routes: readRoutes(),
} as const;

export function requireN8nBaseUrl(): string {
  if (!integrationConfig.n8nBaseUrl) {
    throw new Error(
      'VITE_N8N_BASE_URL es obligatorio cuando VITE_DATA_SOURCE=n8n. No se aceptan credenciales en el navegador.',
    );
  }
  return integrationConfig.n8nBaseUrl;
}

export function resolveN8nRoute(route: string, params: Record<string, string> = {}): string {
  return Object.entries(params).reduce(
    (current, [key, value]) => current.replace(`:${key}`, encodeURIComponent(value)),
    route,
  );
}
