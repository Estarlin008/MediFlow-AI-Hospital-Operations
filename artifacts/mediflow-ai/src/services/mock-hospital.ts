import { patients, type Patient } from '@/data/mock-data';

export type SystemStatus = { name: string; status: 'Operativo' | 'Latencia' | 'Revisar'; detail: string; latency: string };

export const systemServices: SystemStatus[] = [
  { name: 'Core clínico', status: 'Operativo', detail: 'Sincronización nominal', latency: '42 ms' },
  { name: 'n8n · integraciones', status: 'Operativo', detail: '4 workflows activos', latency: '118 ms' },
  { name: 'LIS · laboratorio', status: 'Latencia', detail: 'Demora en validación', latency: '860 ms' },
  { name: 'Inventario farmacia', status: 'Operativo', detail: 'Última actualización 09:41', latency: '64 ms' },
];

export async function registerPatient(input: Pick<Patient, 'name' | 'age' | 'sex' | 'phone'>) {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { id: `pt-${Date.now().toString().slice(-4)}`, record: `MF-${new Date().getFullYear()}${Math.floor(Math.random() * 800 + 100)}`, ...input };
}

export async function runWorkflow(workflowId: string) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { workflowId, status: 'success' as const, ranAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) };
}

export async function receiveExternalTriage(episodeId: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { episodeId, source: 'n8n / webhook triage-v2', priority: 'P2' as const, receivedAt: new Date().toISOString() };
}