import {
  Activity,
  BedDouble,
  CircleAlert,
  Clock3,
  HeartPulse,
  UserRoundCheck,
  UsersRound,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMvpStore } from './state';
import {
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
  PriorityBadge,
  StateBadge,
} from './components';
import type { MvpEpisode } from './types';

const priorityColors: Record<string, string> = {
  P1: '#ae3932',
  P2: '#c08027',
  P3: '#aa941e',
  P4: '#347f68',
};

function episodeOrder(a: MvpEpisode, b: MvpEpisode) {
  const order = { P1: 0, P2: 1, P3: 2, P4: 3 };
  const aPriority = a.priority ? order[a.priority] : 4;
  const bPriority = b.priority ? order[b.priority] : 4;
  return aPriority - bPriority;
}

function durationMinutes(wait: string) {
  const match = wait.match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : null;
}

export function DashboardPage() {
  const { state, demoMode } = useMvpStore();
  const activeEpisodes = state.episodes.filter((episode) => episode.status !== 'Atendido');
  const waiting = state.episodes.filter((episode) => episode.status === 'En espera').length;
  const inCare = state.episodes.filter((episode) => episode.status === 'En atención').length;
  const completed = state.episodes.filter((episode) => episode.status === 'Atendido').length;
  const p1Count = activeEpisodes.filter((episode) => episode.priority === 'P1').length;
  const waits = activeEpisodes.map((episode) => durationMinutes(episode.wait)).filter(
    (value): value is number => value !== null,
  );
  const averageWait = waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : null;
  const freeBeds = state.beds.filter((bed) => {
    const area = state.areas.find((item) => item.name === bed.area);
    return bed.status === 'Libre' && bed.availability !== 'No disponible' && area?.isAvailable !== false;
  }).length;
  const occupiedBeds = state.beds.filter((bed) => bed.status === 'Ocupada').length;
  const bedOccupancy = state.beds.length
    ? Math.round((occupiedBeds / state.beds.length) * 100)
    : null;
  const priorityData = ['P1', 'P2', 'P3', 'P4'].map((priority) => ({
    priority,
    cases: activeEpisodes.filter((episode) => episode.priority === priority).length,
  }));
  const currentWaiting = activeEpisodes
    .filter((episode) => episode.status === 'En espera')
    .sort(episodeOrder)
    .slice(0, 5);
  const urgent = activeEpisodes
    .filter((episode) => episode.priority === 'P1' || episode.priority === 'P2')
    .sort(episodeOrder)
    .slice(0, 4);
  const patientById = new Map(state.patients.map((patient) => [patient.id, patient]));
  const waitTrend = demoMode
    ? [
        { time: '07:00', minutes: 13 },
        { time: '08:00', minutes: 16 },
        { time: '09:00', minutes: 21 },
        { time: '10:00', minutes: 18 },
        { time: '11:00', minutes: 14 },
        { time: '12:00', minutes: 12 },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Resumen operativo · Turno actual"
        title="Panel de control"
        description="Estado de la cola de emergencias, tiempos de espera y recursos disponibles."
        actions={
          <>
            <Link className="mf-link-button" href="/cola">
              Ver cola completa <ArrowRight size={14} />
            </Link>
            <Link className="mf-primary-link" href="/registro">
              Registrar paciente
            </Link>
          </>
        }
      />

      {state.loadErrors.length > 0 && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-[#e7c8a2] bg-[#fff9ef] px-4 py-3 text-xs leading-5 text-[#72501f]">
          <CircleAlert size={17} className="mt-0.5 shrink-0" />
          <div>
            <strong className="font-bold">Algunos datos no están disponibles desde la integración.</strong>
            <ul className="mt-1 list-inside list-disc">{state.loadErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="En espera"
          value={waiting}
          detail="Episodios pendientes de atención"
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          label="En atención"
          value={inCare}
          detail="Episodios con atención iniciada"
          icon={HeartPulse}
          tone="teal"
        />
        <MetricCard
          label={demoMode ? 'Atendidos' : 'Pacientes hoy'}
          value={demoMode ? completed : state.dashboardSummary?.patientsToday ?? completed}
          detail={demoMode ? 'Episodios marcados como atendidos en esta sesión' : 'Conteo reportado por la API para hoy'}
          icon={UserRoundCheck}
          tone="navy"
        />
        <MetricCard
          label="P1 · inmediata"
          value={p1Count}
          detail="Prioridad confirmada en la cola"
          icon={CircleAlert}
          tone="red"
        />
        <MetricCard
          label="Espera promedio"
          value={averageWait === null ? '—' : `${averageWait} min`}
          detail={waits.length ? `Calculada con ${waits.length} episodios con tiempo disponible` : 'Sin tiempos suficientes'}
          icon={Activity}
          tone="navy"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Cola actual"
          detail="Ordenada por prioridad operativa recibida y luego por registro de llegada. Sin reevaluar prioridades."
          action={<Link className="mf-subtle-link" href="/cola">Abrir cola <ArrowRight size={13} /></Link>}
        >
          {currentWaiting.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="No hay episodios en espera"
              detail="Los nuevos registros aparecerán aquí cuando exista un episodio activo."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="mf-table min-w-0">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Motivo</th>
                    <th>Prioridad vigente</th>
                    <th>Espera</th>
                  </tr>
                </thead>
                <tbody>
                  {currentWaiting.map((episode) => {
                    const patient = patientById.get(episode.patientId);
                    return (
                      <tr key={episode.id}>
                        <td>
                          <Link className="font-bold text-foreground hover:text-accent" href={`/cola?episode=${episode.id}`}>
                            {patient?.name ?? 'Paciente sin nombre'}
                          </Link>
                          <span className="mt-1 block font-mono-ui text-[10px] text-muted-foreground">{episode.id}</span>
                        </td>
                        <td className="max-w-40 truncate" title={episode.reason}>{episode.reason}</td>
                        <td><PriorityBadge priority={episode.priority} /></td>
                        <td className="font-mono-ui font-medium">{episode.wait}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Atención prioritaria"
          detail="Casos con prioridad vigente P1 o P2. La clasificación debe verificarse en el episodio."
          action={<Link className="mf-subtle-link" href="/cola">Revisar <ArrowRight size={13} /></Link>}
        >
          {urgent.length === 0 ? (
            <EmptyState
              icon={HeartPulse}
              title="Sin casos P1 o P2 confirmados"
              detail="Las recomendaciones sin confirmar no se cuentan como prioridad operativa."
            />
          ) : (
            <div className="divide-y divide-border">
              {urgent.map((episode) => {
                const patient = patientById.get(episode.patientId);
                return (
                  <Link
                    key={episode.id}
                    href={`/cola?episode=${episode.id}`}
                    className="flex items-start gap-3 px-5 py-4 transition hover:bg-[#fafcfd]"
                  >
                    <span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${episode.priority === 'P1' ? 'bg-[#af3b34]' : 'bg-[#c1842a]'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{patient?.name ?? 'Paciente sin nombre'}</strong>
                        <PriorityBadge priority={episode.priority} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{episode.reason}</span>
                      <span className="mt-1.5 block text-[10px] text-muted-foreground">{episode.area} · {episode.createdAt}</span>
                    </span>
                    <ArrowRight size={15} className="mt-1 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Panel
          title="Prioridad en episodios activos"
          detail="Distribución de la prioridad vigente confirmada; las sugerencias pendientes no se incluyen."
        >
          {state.episodes.length === 0 ? (
            <EmptyState icon={Activity} title="Aún no hay episodios" detail="La distribución aparecerá cuando la fuente entregue episodios." />
          ) : (
            <div className="px-4 pb-5 pt-3">
              <div className="h-[205px]" role="img" aria-label={`Episodios por prioridad: ${priorityData.map((entry) => `${entry.priority}: ${entry.cases}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e8edf0" />
                    <XAxis dataKey="priority" tickLine={false} axisLine={false} tick={{ fill: '#6b7b85', fontSize: 11, fontWeight: 700 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#7b8992', fontSize: 10 }} />
                    <Tooltip cursor={{ fill: '#f5f8f9' }} contentStyle={{ borderRadius: 9, border: '1px solid #e1e7eb', fontSize: 12 }} />
                    <Bar dataKey="cases" name="Episodios" radius={[5, 5, 0, 0]} maxBarSize={38}>
                      {priorityData.map((entry) => <Cell key={entry.priority} fill={priorityColors[entry.priority]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
                {priorityData.map((entry) => (
                  <span className="inline-flex items-center gap-1.5" key={entry.priority}>
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: priorityColors[entry.priority] }} />
                    {entry.priority} <b className="font-mono-ui text-foreground">{entry.cases}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Tendencia de espera"
          detail={demoMode ? 'Serie ilustrativa · datos de demostración, no histórica real.' : 'La API no entrega una serie temporal de espera.'}
        >
          {waitTrend.length === 0 ? (
            <EmptyState icon={Clock3} title="Sin serie temporal disponible" detail="No se mostrará una tendencia fabricada cuando la fuente no entregue esos datos." />
          ) : (
            <div className="px-3 pb-4 pt-2">
              <div className="h-[218px]" role="img" aria-label="Tendencia ilustrativa del tiempo de espera en minutos">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={waitTrend} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="waitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#248b83" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#248b83" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e8edf0" />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#71808a', fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#7b8992', fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 9, border: '1px solid #e1e7eb', fontSize: 12 }} formatter={(value) => [`${value} min`, 'Espera']} />
                    <Area type="monotone" dataKey="minutes" name="Espera" stroke="#248b83" strokeWidth={2.5} fill="url(#waitFill)" activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Disponibilidad de recursos"
          detail="Ocupación derivada de los recursos devueltos por la fuente."
        >
          <div className="space-y-5 px-5 py-5">
            <ResourceMeter label="Camas" value={occupiedBeds} total={state.beds.length} suffix="ocupadas" />
            {state.doctors.length > 0 ? (
              <ResourceMeter
                label="Personal disponible"
                value={state.doctors.filter((doctor) => doctor.availability === 'Disponible').length}
                total={state.doctors.length}
                suffix="disponibles"
                invert
              />
            ) : (
              <p className="rounded-lg bg-muted/70 px-3 py-2 text-[11px] leading-4 text-muted-foreground">La fuente no proporciona disponibilidad del personal.</p>
            )}
            {state.areas.length > 0 ? (
              state.areas.slice(0, 2).map((area) => <ResourceMeter key={area.name} label={area.name} value={area.used} total={area.total} suffix="ocupados" />)
            ) : (
              <p className="rounded-lg bg-muted/70 px-3 py-2 text-[11px] leading-4 text-muted-foreground">La fuente no proporciona capacidad por área.</p>
            )}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="inline-flex items-center gap-2 text-xs font-semibold"><BedDouble size={15} className="text-accent" /> Camas libres</span>
              <strong className="font-mono-ui text-base">{freeBeds} <span className="font-sans text-[10px] font-medium text-muted-foreground">/ {state.beds.length}</span></strong>
            </div>
            <Link className="mf-subtle-link w-full justify-center border-t border-border pt-4" href="/recursos">Gestionar recursos <ArrowRight size={13} /></Link>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Actividad reciente"
          detail={demoMode ? 'Ejemplos de actividad · no son eventos reales del hospital.' : 'Eventos devueltos por el servicio de auditoría.'}
          action={<ExternalLink size={15} className="text-muted-foreground" aria-hidden="true" />}
        >
          {state.activity.length === 0 ? (
            <EmptyState icon={Activity} title="Sin actividad disponible" detail="No hay eventos de auditoría en la fuente conectada." />
          ) : (
            <div className="divide-y divide-border">
              {state.activity.slice(0, 5).map((event) => (
                <div className="flex items-start gap-3 px-5 py-3.5" key={event.id}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{event.action}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{event.detail}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{event.actor}</p>
                  </div>
                  <time className="shrink-0 font-mono-ui text-[10px] text-muted-foreground">{event.time}</time>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Casos sin prioridad confirmada" detail="Requieren revisión humana; no se les asigna prioridad automáticamente.">
          {activeEpisodes.filter((episode) => !episode.priority).length === 0 ? (
            <div className="px-5 py-5">
              <StateBadge tone="good">Todos los episodios activos tienen prioridad vigente</StateBadge>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Las recomendaciones externas y su confirmación profesional se conservan como estados separados.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeEpisodes.filter((episode) => !episode.priority).map((episode) => (
                <div className="flex items-center justify-between gap-3 px-5 py-4" key={episode.id}>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{patientById.get(episode.patientId)?.name ?? 'Paciente'}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{episode.id} · {episode.createdAt}</p>
                  </div>
                  <Link className="mf-subtle-link shrink-0" href={`/cola?episode=${episode.id}`}>Revisar <ArrowRight size={13} /></Link>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-white px-4 py-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><UsersRound size={13} /> {state.patients.length} pacientes en los datos cargados</span>
        <span className="inline-flex items-center gap-1.5"><Activity size={13} /> {activeEpisodes.length} episodios activos</span>
        {bedOccupancy !== null && <span className="inline-flex items-center gap-1.5"><BedDouble size={13} /> {bedOccupancy}% de camas ocupadas</span>}
        {state.loading && <StateBadge tone="info">Cargando datos de integración</StateBadge>}
        {!state.loading && !demoMode && state.loadErrors.length === 0 && <StateBadge tone="good">Lectura de la API completada</StateBadge>}
      </div>
    </div>
  );
}

function ResourceMeter({
  label,
  value,
  total,
  suffix,
  invert = false,
}: {
  label: string;
  value: number;
  total: number;
  suffix: string;
  invert?: boolean;
}) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const display = invert ? `${value} / ${total}` : `${value} / ${total}`;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        <span className="font-mono-ui text-muted-foreground">{display} <span className="font-sans text-[10px]">{suffix}</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#eaf0f2]">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
