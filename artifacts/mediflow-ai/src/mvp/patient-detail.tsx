import { useLocation } from 'wouter';
import { ArrowUpRight, Clock3, HeartPulse, UserRound, X } from 'lucide-react';
import { ActionButton, PriorityBadge, StateBadge } from './components';
import { useMvpStore } from './state';
import type { MvpEpisode } from './types';

export function PatientDetail({
  episode,
  onClose,
}: {
  episode: MvpEpisode;
  onClose: () => void;
}) {
  const { state, demoMode } = useMvpStore();
  const [, setLocation] = useLocation();
  const patient = state.patients.find((item) => item.id === episode.patientId);
  if (!patient) return null;

  const statusTone =
    episode.status === 'Atendido'
      ? 'good'
      : episode.status === 'En atención'
        ? 'info'
        : 'warning';

  return (
    <div
      className="mf-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mf-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-detail-heading"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent">Expediente del episodio</p>
            <h2 id="patient-detail-heading" className="mt-1 text-lg font-extrabold tracking-tight">{patient.name}</h2>
            <p className="mt-1 font-mono-ui text-[10px] text-muted-foreground">{patient.record} · {episode.id}</p>
          </div>
          <button type="button" autoFocus className="mf-icon-button" onClick={onClose} aria-label="Cerrar expediente">
            <X size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 px-5 py-4">
            <DetailTile label="Edad" value={patient.age === null ? 'No informada' : `${patient.age} años`} />
            <DetailTile label="Sexo registrado" value={patient.sex === 'No especificado' ? 'No especificado' : patient.sex} />
            <DetailTile label="Contacto" value={patient.phone || 'No registrado'} />
            <DetailTile label="Ingreso" value={episode.createdAt || 'No disponible'} />
          </div>

          <section className="border-t border-border px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-extrabold"><HeartPulse size={15} className="text-accent" /> Episodio actual</div>
            <p className="mt-3 text-sm font-bold">{episode.reason}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{episode.symptoms || episode.observations || 'Relato no registrado.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StateBadge tone={statusTone}>{episode.status}</StateBadge>
              <span className="text-[10px] text-muted-foreground">{episode.area || 'Área sin asignar'}</span>
            </div>
          </section>

          <section className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold">Prioridad operativa</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Requiere confirmación profesional.</p>
              </div>
              <PriorityBadge priority={episode.priority} />
            </div>
            <div className="mt-4 rounded-lg border border-[#dce5eb] bg-[#f6f9fb] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sugerencia externa</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <PriorityBadge priority={episode.proposedPriority} label={episode.proposedPriority ? 'Sugerida' : undefined} />
                <StateBadge tone={episode.proposedPriority ? 'info' : 'neutral'}>
                  {episode.triageStatus ?? 'Pendiente'}
                </StateBadge>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                {episode.prioritySource
                  ? `${episode.prioritySource}${demoMode ? ' · ejemplo, no resultado clínico' : ''}`
                  : demoMode
                    ? 'Evaluación no disponible: el modo demo no ejecuta una clasificación de IA.'
                    : 'No se ha recibido una recomendación para este episodio.'}
              </p>
              {episode.priorityNotes && <p className="mt-2 border-t border-[#e1e8ec] pt-2 text-[11px] leading-5 text-foreground">{episode.priorityNotes}</p>}
            </div>
          </section>

          <section className="border-t border-border px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-extrabold"><ActivityIcon /> Signos vitales registrados</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <VitalTile label="Frecuencia cardíaca" value={episode.vitals.fc} unit="lpm" />
              <VitalTile label="Presión arterial" value={episode.vitals.pa} unit="mmHg" />
              <VitalTile label="Frecuencia respiratoria" value={episode.vitals.respiratoryRate} unit="rpm" />
              <VitalTile label="Temperatura" value={episode.vitals.temp} unit="°C" />
              <VitalTile label="Saturación O₂" value={episode.vitals.spo2} unit="%" />
              <VitalTile label="Conciencia" value={episode.vitals.consciousness} />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {episode.lastReassessmentAt
                ? `Última reevaluación registrada: ${episode.lastReassessmentAt}`
                : 'No hay reevaluación posterior registrada.'}
            </p>
          </section>

          <section className="border-t border-border px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-extrabold"><UserRound size={15} className="text-accent" /> Antecedentes declarados</div>
            <InfoLine label="Alergias" value={patient.allergies.length ? patient.allergies.join(', ') : 'No informado'} />
            <InfoLine label="Antecedentes" value={patient.relevantHistory || (patient.chronic.length ? patient.chronic.join(', ') : 'No informado')} />
            <InfoLine label="Medicamentos" value={patient.medications.length ? patient.medications.join(', ') : 'No informado'} />
          </section>

          <section className="border-t border-border px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-extrabold"><Clock3 size={15} className="text-accent" /> Asignaciones</div>
            <InfoLine label="Profesional" value={episode.doctor || 'Sin asignar'} />
            <InfoLine label="Cama" value={episode.bed || 'Sin asignar'} />
          </section>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-border bg-[#fbfcfd] px-5 py-4">
          <ActionButton
            variant="secondary"
            icon={ArrowUpRight}
            onClick={() => setLocation(`/reevaluacion?episode=${encodeURIComponent(episode.id)}`)}
            disabled={episode.status === 'Atendido'}
          >
            Reevaluar
          </ActionButton>
          <ActionButton variant="quiet" onClick={onClose}>Cerrar</ActionButton>
        </footer>
      </section>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f4f7f8] px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-xs font-semibold">{value || 'No registrado'}</p>
    </div>
  );
}

function VitalTile({ label, value, unit = '' }: { label: string; value?: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[9px] font-semibold leading-4 text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono-ui text-sm font-semibold">{value === undefined || value === '' ? '—' : `${value}${unit ? ` ${unit}` : ''}`}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-start justify-between gap-4">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="max-w-[70%] text-right text-[11px] font-semibold">{value}</span>
    </div>
  );
}

function ActivityIcon() {
  return <span aria-hidden="true" className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-accent text-[8px] text-accent">i</span>;
}
