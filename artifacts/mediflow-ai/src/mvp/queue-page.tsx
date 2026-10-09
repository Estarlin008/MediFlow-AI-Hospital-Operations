import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'wouter';
import {
  Activity,
  ArrowRight,
  Check,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  RotateCcw,
  Search,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { hospitalService } from '@/services/hospital';
import { ActionButton, EmptyState, PageHeading, Panel, PriorityBadge, StateBadge, fieldClass } from './components';
import { PatientDetail } from './patient-detail';
import { createEvent, useMvpStore } from './state';
import type { MvpEpisode } from './types';
import type { Priority, TriageResult } from '@/domain/contracts';

const priorityOrder: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

function parseArrival(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

function queueOrder(a: MvpEpisode, b: MvpEpisode) {
  if (a.priority && !b.priority) return -1;
  if (!a.priority && b.priority) return 1;
  if (a.priority && b.priority && priorityOrder[a.priority] !== priorityOrder[b.priority]) {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }
  return parseArrival(a.createdAt) - parseArrival(b.createdAt);
}

export function QueuePage() {
  const { state, dispatch, demoMode, refresh } = useMvpStore();
  const [location] = useLocation();
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [status, setStatus] = useState('active');
  const [area, setArea] = useState('all');
  const [needsReview, setNeedsReview] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const episodeId = params.get('episode');
    const patientId = params.get('patient');
    const found = episodeId
      ? state.episodes.find((episode) => episode.id === episodeId)
      : state.episodes.find((episode) => episode.patientId === patientId);
    if (found) setSelectedEpisode(found.id);
  }, [location, state.episodes]);

  const areas = Array.from(new Set(state.episodes.map((episode) => episode.area).filter((item) => item && item !== 'Por asignar')));
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.episodes
      .filter((episode) => {
        if (status === 'active' && episode.status === 'Atendido') return false;
        if (status !== 'all' && status !== 'active' && episode.status !== status) return false;
        if (priority === 'pending' && episode.priority) return false;
        if (priority !== 'all' && priority !== 'pending' && episode.priority !== priority) return false;
        if (area !== 'all' && episode.area !== area) return false;
        if (needsReview && !episode.needsReassessment) return false;
        const patient = state.patients.find((item) => item.id === episode.patientId);
        return !needle || [
          patient?.name,
          patient?.record,
          patient?.identityNumber,
          episode.id,
          episode.reason,
          episode.area,
        ].some((value) => value?.toLowerCase().includes(needle));
      })
      .sort(queueOrder);
  }, [state.episodes, state.patients, query, priority, status, area, needsReview]);
  const pendingVisible = visible.filter((episode) => !episode.priority);
  const priorityVisible = visible.filter((episode) => Boolean(episode.priority));

  const waitingCount = state.episodes.filter((episode) => episode.status === 'En espera').length;
  const pendingCount = state.episodes.filter((episode) => episode.status !== 'Atendido' && !episode.priority).length;
  const urgentCount = state.episodes.filter((episode) => episode.status !== 'Atendido' && episode.priority === 'P1').length;
  const selected = state.episodes.find((episode) => episode.id === selectedEpisode) ?? null;

  async function requestExternalTriage(episode: MvpEpisode) {
    setWorkingId(episode.id);
    setMessage(null);
    try {
      const result = await hospitalService.receiveExternalTriage({ episodeId: episode.id });
      dispatch({
        type: 'apply-evaluation',
        episodeId: episode.id,
        result: result as TriageResult,
        event: createEvent('Recomendación externa recibida', `${episode.id} · ${result.priority}`, 'Integración'),
      });
      setMessage({
        text: `La integración devolvió la sugerencia ${result.priority}. Sigue pendiente de confirmación profesional; la prioridad operativa no cambió.`,
      });
    } catch (error) {
      setMessage({
        error: true,
        text: error instanceof Error ? `No se recibió una respuesta válida de n8n: ${error.message}` : 'No se recibió una respuesta válida de n8n.',
      });
    } finally {
      setWorkingId(null);
    }
  }

  function confirmSuggestedPriority(episode: MvpEpisode) {
    if (!episode.proposedPriority) return;
    dispatch({
      type: 'confirm-priority',
      episodeId: episode.id,
      priority: episode.proposedPriority,
      event: createEvent('Prioridad operativa confirmada', `${episode.id} · ${episode.proposedPriority} · sesión de demostración`),
    });
    setMessage({ text: `La prioridad ${episode.proposedPriority} quedó confirmada solo en esta sesión de demostración.` });
  }

  function setOperationalStatus(episode: MvpEpisode, next: MvpEpisode['status']) {
    dispatch({
      type: 'set-episode-status',
      episodeId: episode.id,
      status: next,
      event: createEvent(
        next === 'Atendido' ? 'Atención finalizada' : 'Atención iniciada',
        `${episode.id} · ${episode.reason}`,
      ),
    });
  }

  function toggleNeedsReevaluation(episode: MvpEpisode) {
    const next = !episode.needsReassessment;
    dispatch({
      type: 'set-needs-reevaluation',
      episodeId: episode.id,
      needsReassessment: next,
      event: createEvent(
        next ? 'Episodio marcado para reevaluación' : 'Marca de reevaluación retirada',
        episode.id,
      ),
    });
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Operación de emergencias"
        title="Cola de atención"
        description="Consulta episodios activos, verifica recomendaciones externas y registra cambios operativos."
        actions={
          <>
            <div className="mf-summary-chip"><Clock3 size={14} /><b>{waitingCount}</b> en espera</div>
            <div className="mf-summary-chip mf-summary-chip-alert"><CircleAlert size={14} /><b>{urgentCount}</b> P1 vigente</div>
            <Link className="mf-primary-link" href="/registro">Registrar paciente</Link>
          </>
        }
      />

      {message && (
        <div role={message.error ? 'alert' : 'status'} aria-live="polite" className={`mb-4 rounded-xl border px-4 py-3 text-xs leading-5 ${message.error ? 'border-[#e8c0bc] bg-[#fff3f1] text-[#872c28]' : 'border-[#c8dce8] bg-[#f2f8fb] text-[#36556e]'}`}>
          {message.text}
        </div>
      )}

      {demoMode && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#e8d6a9] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#70581d]">
          <Activity size={15} className="mt-0.5 shrink-0" />
          <p><strong>Modo demo.</strong> Los episodios y prioridades existentes son ejemplos estáticos. Los cambios hechos aquí no se guardan fuera de esta sesión, y no se solicita una clasificación de IA.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <QueueCount label="Episodios activos" value={state.episodes.filter((episode) => episode.status !== 'Atendido').length} note="Sin episodios atendidos" />
        <QueueCount label="En espera" value={waitingCount} note="Ordenados por prioridad vigente y hora de llegada" />
        <QueueCount label="Sin prioridad confirmada" value={pendingCount} note="Requieren revisión, no asignación automática" warning={pendingCount > 0} />
      </div>

      <Panel className="mt-4" title="Episodios" detail="La sugerencia recibida y la decisión operativa del profesional se muestran por separado.">
        <div className="grid gap-3 border-b border-border bg-[#fbfcfd] p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_160px_160px_180px_auto] xl:items-end">
          <label className="block text-[10px] font-bold text-muted-foreground">
            Buscar paciente o episodio
            <span className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={`${fieldClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código, motivo…" />
            </span>
          </label>
          <FilterSelect label="Prioridad vigente" value={priority} onChange={setPriority}>
            <option value="all">Todas</option>
            <option value="P1">P1 · inmediata</option>
            <option value="P2">P2 · muy urgente</option>
            <option value="P3">P3 · urgente</option>
            <option value="P4">P4 · no urgente</option>
            <option value="pending">Sin evaluar</option>
          </FilterSelect>
          <FilterSelect label="Estado" value={status} onChange={setStatus}>
            <option value="active">Activos</option>
            <option value="all">Todos</option>
            <option value="En espera">En espera</option>
            <option value="En atención">En atención</option>
            <option value="Atendido">Atendidos</option>
          </FilterSelect>
          <FilterSelect label="Área" value={area} onChange={setArea}>
            <option value="all">Todas las áreas</option>
            {areas.map((item) => <option key={item}>{item}</option>)}
          </FilterSelect>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground">
            <input type="checkbox" checked={needsReview} onChange={(event) => setNeedsReview(event.target.checked)} className="h-4 w-4 accent-[#247d77]" />
            Requiere reevaluación
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-[10px] text-muted-foreground">
          <span>{visible.length} episodios coinciden con los filtros</span>
          {state.loading && <StateBadge tone="info">Cargando datos de la API</StateBadge>}
          {!demoMode && state.loadErrors.length > 0 && (
            <button type="button" onClick={() => void refresh()} className="text-accent underline">Reintentar carga</button>
          )}
        </div>

        {pendingVisible.length > 0 && (
          <section className="border-b border-[#ead9b4] bg-[#fffaf1]">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
              <div>
                <h3 className="text-xs font-extrabold text-[#66501f]">Pendientes de prioridad confirmada</h3>
                <p className="mt-1 max-w-2xl text-[10px] leading-4 text-[#7a6840]">
                  Estos episodios se muestran aparte y no se mezclan con el orden por prioridad. La lista no implica nivel de riesgo; requiere revisión profesional.
                </p>
              </div>
              <StateBadge tone="warning">{pendingVisible.length} sin prioridad vigente</StateBadge>
            </div>
            <div className="divide-y divide-[#efe5cd]">
              {pendingVisible.map((episode) => {
                const patient = state.patients.find((item) => item.id === episode.patientId);
                return (
                  <article className="grid gap-3 px-5 py-3.5 lg:grid-cols-[minmax(180px,.7fr)_minmax(190px,1fr)_minmax(260px,1.2fr)_auto] lg:items-center" key={episode.id}>
                    <button type="button" onClick={() => setSelectedEpisode(episode.id)} className="min-w-0 text-left">
                      <span className="block truncate text-xs font-extrabold text-foreground">{patient?.name ?? 'Paciente sin nombre'}</span>
                      <span className="mt-1 block font-mono-ui text-[9px] text-muted-foreground">{episode.id} · {episode.createdAt}</span>
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{episode.reason}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{episode.area} · espera {episode.wait}</p>
                    </div>
                    <RecommendationCell episode={episode} demoMode={demoMode} onRequest={() => void requestExternalTriage(episode)} onConfirm={() => confirmSuggestedPriority(episode)} loading={workingId === episode.id} />
                    <EpisodeActions episode={episode} demoMode={demoMode} onSetStatus={setOperationalStatus} onToggleReview={toggleNeedsReevaluation} onOpen={() => setSelectedEpisode(episode.id)} />
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {priorityVisible.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={state.loading ? 'Cargando cola' : pendingVisible.length ? 'Sin episodios con prioridad vigente en este filtro' : 'No hay episodios que coincidan'}
            detail={state.loading ? 'Esperando la respuesta de la fuente configurada.' : pendingVisible.length ? 'Los episodios pendientes se muestran en una sección separada y no se les asigna un orden clínico.' : 'Prueba con otros filtros o registra un paciente con episodio de emergencia.'}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="mf-table min-w-[1120px]">
                <thead><tr><th>Pos.</th><th>Paciente / episodio</th><th>Prioridad vigente</th><th>Sugerencia externa</th><th>Motivo / área</th><th>Espera / llegada</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {priorityVisible.map((episode, index) => (
                    <tr key={episode.id} className={episode.priority === 'P1' ? 'mf-priority-row' : ''}>
                      <td className="font-mono-ui text-xs font-bold text-muted-foreground">{String(index + 1).padStart(2, '0')}</td>
                      <td>
                        <button type="button" onClick={() => setSelectedEpisode(episode.id)} className="text-left">
                          <span className="block max-w-48 truncate text-xs font-bold text-foreground hover:text-accent">{state.patients.find((p) => p.id === episode.patientId)?.name ?? 'Paciente sin nombre'}</span>
                          <span className="mt-1 block font-mono-ui text-[10px] text-muted-foreground">{episode.id}</span>
                        </button>
                      </td>
                      <td><PriorityBadge priority={episode.priority} /></td>
                      <td><RecommendationCell episode={episode} demoMode={demoMode} onRequest={() => void requestExternalTriage(episode)} onConfirm={() => confirmSuggestedPriority(episode)} loading={workingId === episode.id} /></td>
                      <td className="max-w-52">
                        <span className="block truncate text-xs font-semibold" title={episode.reason}>{episode.reason}</span>
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{episode.area}</span>
                      </td>
                      <td><span className="font-mono-ui text-xs font-semibold">{episode.wait}</span><span className="mt-1 block text-[10px] text-muted-foreground">{episode.createdAt}</span></td>
                      <td><StateBadge tone={episode.status === 'Atendido' ? 'good' : episode.status === 'En atención' ? 'info' : 'warning'}>{episode.status}</StateBadge></td>
                      <td><EpisodeActions episode={episode} demoMode={demoMode} onSetStatus={setOperationalStatus} onToggleReview={toggleNeedsReevaluation} onOpen={() => setSelectedEpisode(episode.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border xl:hidden">
              {priorityVisible.map((episode, index) => (
                <article key={episode.id} className={`p-4 ${episode.priority === 'P1' ? 'border-l-[3px] border-l-[#ae3932]' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button type="button" onClick={() => setSelectedEpisode(episode.id)} className="text-left">
                        <p className="truncate text-sm font-bold">{state.patients.find((p) => p.id === episode.patientId)?.name ?? 'Paciente sin nombre'}</p>
                        <p className="mt-1 font-mono-ui text-[10px] text-muted-foreground">{episode.id} · posición {index + 1}</p>
                      </button>
                    </div>
                    <PriorityBadge priority={episode.priority} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StateBadge tone={episode.status === 'Atendido' ? 'good' : episode.status === 'En atención' ? 'info' : 'warning'}>{episode.status}</StateBadge>
                    <span className="text-[10px] text-muted-foreground">{episode.area} · espera {episode.wait}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold">{episode.reason}</p>
                  <div className="mt-3 rounded-lg bg-[#f6f9fa] p-3">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sugerencia externa · no es prioridad vigente</p>
                    <RecommendationCell episode={episode} demoMode={demoMode} onRequest={() => void requestExternalTriage(episode)} onConfirm={() => confirmSuggestedPriority(episode)} loading={workingId === episode.id} />
                  </div>
                  <div className="mt-3"><EpisodeActions episode={episode} demoMode={demoMode} onSetStatus={setOperationalStatus} onToggleReview={toggleNeedsReevaluation} onOpen={() => setSelectedEpisode(episode.id)} /></div>
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
        <div className="flex items-start gap-2.5">
          <InfoIcon />
          <p className="max-w-3xl text-[10px] leading-5 text-muted-foreground">
            La cola solo ordena por una prioridad recibida y confirmada, seguida por la hora de llegada. No evalúa signos vitales ni estima riesgo. Un episodio sin prioridad se conserva como pendiente.
          </p>
        </div>
        <Link className="mf-subtle-link shrink-0" href="/reevaluacion">Ir a reevaluación <ArrowRight size={13} /></Link>
      </div>

      {selected && <PatientDetail episode={selected} onClose={() => setSelectedEpisode(null)} />}
    </div>
  );

}

function QueueCount({ label, value, note, warning = false }: { label: string; value: number; note: string; warning?: boolean }) {
  return (
    <div className={`mf-panel flex items-center gap-4 px-4 py-3.5 ${warning ? 'border-l-[3px] border-l-[#c58d2e]' : ''}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${warning ? 'bg-[#fff6e8] text-[#926018]' : 'bg-[#eef4f6] text-[#375b72]'}`}>
        {warning ? <CircleAlert size={17} /> : <ClipboardCheck size={17} />}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2"><strong className="font-mono-ui text-2xl">{value}</strong><span className="truncate text-[10px] text-muted-foreground">{note}</span></div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold text-muted-foreground">
      {label}
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function RecommendationCell({
  episode,
  demoMode,
  onRequest,
  onConfirm,
  loading,
}: {
  episode: MvpEpisode;
  demoMode: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (episode.proposedPriority) {
    return (
      <div className="flex max-w-60 flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={episode.proposedPriority} label="Sugerida" />
          <StateBadge tone={demoMode ? 'warning' : episode.triageStatus === 'Confirmado' ? 'good' : 'info'}>
            {demoMode ? 'Ejemplo demo' : episode.triageStatus ?? 'Recibida'}
          </StateBadge>
        </div>
        {demoMode ? (
          <button type="button" onClick={onConfirm} disabled={episode.priority === episode.proposedPriority} className="text-left text-[10px] font-bold text-accent underline disabled:cursor-default disabled:no-underline disabled:opacity-60">
            {episode.priority === episode.proposedPriority ? 'Prioridad vigente coincide' : 'Confirmar ejemplo en esta sesión'}
          </button>
        ) : (
          <>
            <span className="text-[9px] leading-4 text-muted-foreground">Pendiente de confirmación profesional</span>
            <button
              type="button"
              disabled
              title="La API actual no ofrece un endpoint para guardar la confirmación profesional."
              className="cursor-not-allowed text-left text-[9px] font-semibold text-muted-foreground underline opacity-65"
            >
              Confirmación no disponible en API
            </button>
          </>
        )}
      </div>
    );
  }
  if (demoMode) {
    return (
      <div className="max-w-52">
        <StateBadge tone="warning">No disponible</StateBadge>
        <p className="mt-1 text-[9px] leading-4 text-muted-foreground">El modo demo no ejecuta IA.</p>
      </div>
    );
  }
  return (
    <div className="max-w-56">
      <ActionButton variant="secondary" icon={RotateCcw} disabled={loading} onClick={onRequest} className="min-h-8 px-2.5 py-1.5 text-[10px]">
        {loading ? 'Esperando n8n…' : 'Solicitar a n8n'}
      </ActionButton>
      <p className="mt-1 text-[9px] leading-4 text-muted-foreground">Usa el endpoint de evaluación configurado.</p>
    </div>
  );
}

function EpisodeActions({
  episode,
  demoMode,
  onSetStatus,
  onToggleReview,
  onOpen,
}: {
  episode: MvpEpisode;
  demoMode: boolean;
  onSetStatus: (episode: MvpEpisode, next: MvpEpisode['status']) => void;
  onToggleReview: (episode: MvpEpisode) => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={onOpen} className="mf-small-action" title="Abrir expediente">
        <UserRound size={13} /> Expediente
      </button>
      {episode.status !== 'Atendido' && (
        <Link className="mf-small-action" href={`/reevaluacion?episode=${encodeURIComponent(episode.id)}`}>
          <Stethoscope size={13} /> Reevaluar
        </Link>
      )}
      {demoMode && episode.status !== 'Atendido' && (
        <button type="button" onClick={() => onToggleReview(episode)} className="mf-small-action">
          <Clock3 size={13} /> {episode.needsReassessment ? 'Quitar marca' : 'Marcar reevaluación'}
        </button>
      )}
      {demoMode && episode.status === 'En espera' && (
        <button type="button" onClick={() => onSetStatus(episode, 'En atención')} className="mf-small-action">
          <ArrowRight size={13} /> Iniciar atención
        </button>
      )}
      {demoMode && episode.status === 'En atención' && (
        <button type="button" onClick={() => onSetStatus(episode, 'Atendido')} className="mf-small-action mf-small-action-good">
          <Check size={13} /> Marcar atendido
        </button>
      )}
      {!demoMode && episode.status !== 'Atendido' && (
        <span title="La integración no incluye un endpoint para actualizar el estado operativo." className="text-[9px] text-muted-foreground">Estado: solo lectura</span>
      )}
      {episode.status === 'Atendido' && <StateBadge tone="good">Atendido</StateBadge>}
    </div>
  );
}

function InfoIcon() {
  return <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#7993a2] text-[9px] font-bold text-[#587384]" aria-hidden="true">i</span>;
}
