import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  BedDouble,
  CircleHelp,
  Plus,
  Stethoscope,
  UsersRound,
  UserRoundCheck,
} from 'lucide-react';
import { ActionButton, EmptyState, PageHeading, Panel, StateBadge, fieldClass } from './components';
import { createEvent, useMvpStore } from './state';
import { ResourceCreateDialog, type ResourceKind } from './resource-create-dialog';

type ResourceTab = 'beds' | 'staff' | 'areas';

const tabs: Array<{ id: ResourceTab; label: string; icon: typeof BedDouble }> = [
  { id: 'beds', label: 'Camas', icon: BedDouble },
  { id: 'staff', label: 'Personal médico', icon: Stethoscope },
  { id: 'areas', label: 'Áreas', icon: UsersRound },
];

export function ResourcesPage() {
  const { state, dispatch, demoMode } = useMvpStore();
  const [tab, setTab] = useState<ResourceTab>('beds');
  const [bedSelections, setBedSelections] = useState<Record<string, string>>({});
  const [doctorSelections, setDoctorSelections] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<ResourceKind>('bed');

  const assignableEpisodes = useMemo(
    () =>
      state.episodes.filter(
        (episode) =>
          episode.status !== 'Atendido' &&
          (!episode.bed || ['Sin asignar', 'Pendiente', '—'].includes(episode.bed)),
      ),
    [state.episodes],
  );
  const freeBeds = state.beds.filter((bed) => {
    const area = state.areas.find((item) => item.name === bed.area);
    return bed.status === 'Libre' && bed.availability !== 'No disponible' && area?.isAvailable !== false;
  }).length;
  const occupiedBeds = state.beds.filter((bed) => bed.status === 'Ocupada').length;
  const availableDoctors = state.doctors.filter((doctor) => doctor.availability === 'Disponible').length;

  function openCreateResource() {
    setCreateKind(tab === 'staff' ? 'doctor' : tab === 'areas' ? 'area' : 'bed');
    setCreateOpen(true);
  }

  function handleResourceCreated(kind: ResourceKind, id: string) {
    setTab(kind === 'doctor' ? 'staff' : kind === 'area' ? 'areas' : 'beds');
    setNotice(`El recurso ${id} se agregó al inventario de esta sesión de demostración.`);
  }

  function assignBed(bedId: string) {
    const episodeId = bedSelections[bedId];
    const bed = state.beds.find((item) => item.id === bedId);
    const episode = state.episodes.find((item) => item.id === episodeId);
    if (!bed || !episode || bed.status !== 'Libre' || bed.availability === 'No disponible') return;
    if (state.beds.some((item) => item.patientId === episode.patientId)) {
      setNotice('Este paciente ya tiene una cama asignada. Libera la asignación anterior antes de continuar.');
      return;
    }
    const patient = state.patients.find((item) => item.id === episode.patientId);
    dispatch({
      type: 'assign-bed',
      episodeId,
      bedId,
      event: createEvent('Cama asignada en demo', `${bedId} → ${patient?.name ?? episode.patientId}`),
    });
    setNotice(`La cama ${bedId} se asignó en esta sesión de demostración.`);
    setBedSelections((current) => ({ ...current, [bedId]: '' }));
  }

  function releaseBed(bedId: string) {
    const bed = state.beds.find((item) => item.id === bedId);
    const episode = state.episodes.find(
      (item) => item.patientId === bed?.patientId && item.bed === bedId,
    );
    if (!bed || !episode) {
      setNotice('Esta cama no está vinculada a un episodio identificable. No se puede liberar desde MediFlow.');
      return;
    }
    dispatch({
      type: 'release-bed',
      episodeId: episode.id,
      bedId,
      event: createEvent('Cama liberada en demo', `${bedId} · ${bed.patient}`),
    });
    setNotice(`La cama ${bedId} quedó libre en esta sesión de demostración.`);
  }

  function assignDoctor(doctorId: string) {
    const episodeId = doctorSelections[doctorId];
    const doctor = state.doctors.find((item) => item.id === doctorId);
    const episode = state.episodes.find((item) => item.id === episodeId);
    if (!doctor || !episode || doctor.availability !== 'Disponible') return;
    if (episode.doctor && episode.doctor !== 'Sin asignar') {
      setNotice('Este episodio ya tiene un profesional asignado.');
      return;
    }
    dispatch({
      type: 'assign-doctor',
      episodeId,
      doctorId,
      event: createEvent('Profesional asignado en demo', `${doctor.name} → ${episode.id}`),
    });
    setNotice(`Se asignó ${doctor.name} en esta sesión de demostración.`);
    setDoctorSelections((current) => ({ ...current, [doctorId]: '' }));
  }

  function setDoctorAvailability(doctorId: string, availability: 'Disponible' | 'No disponible') {
    const doctor = state.doctors.find((item) => item.id === doctorId);
    if (!doctor || doctor.patients > 0 || doctor.status !== 'En turno') return;
    dispatch({
      type: 'set-doctor-availability',
      doctorId,
      availability,
      event: createEvent(
        availability === 'Disponible' ? 'Personal marcado disponible en demo' : 'Personal marcado no disponible en demo',
        doctor.name,
      ),
    });
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Capacidad operativa"
        title="Gestión de recursos"
        description="Consulta ocupación de camas, disponibilidad del personal y capacidad por área."
        actions={
          <>
            <ActionButton icon={Plus} onClick={openCreateResource}>Agregar recurso</ActionButton>
            <Link className="mf-link-button" href="/cola">Volver a la cola <ArrowRight size={14} /></Link>
          </>
        }
      />

      {!demoMode && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e8d6a9] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#70581d]">
          <CircleHelp size={17} className="mt-0.5 shrink-0" />
          <p><strong>Operación en solo lectura.</strong> La API configurada puede devolver camas; no proporciona médicos ni áreas y no tiene operaciones para crear, asignar o liberar recursos. No se muestran datos de demostración junto con los registros reales.</p>
        </div>
      )}
      {demoMode && (
        <div className="mb-5 rounded-xl border border-[#e8d6a9] bg-[#fffaf0] px-4 py-3 text-[11px] leading-5 text-[#70581d]">
          <strong>Modo demo.</strong> Las altas, asignaciones y cambios de disponibilidad se conservan solo durante esta sesión.
        </div>
      )}
      {notice && <div role="status" aria-live="polite" className="mb-4 rounded-xl border border-[#c8dce8] bg-[#f2f8fb] px-4 py-3 text-xs text-[#36556e]">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <ResourceSummary icon={BedDouble} label="Camas libres" value={freeBeds} note={`de ${state.beds.length} registradas`} tone="teal" />
        <ResourceSummary icon={BedDouble} label="Camas ocupadas" value={occupiedBeds} note="Según estado reportado" tone="amber" />
        <ResourceSummary icon={UserRoundCheck} label="Personal disponible" value={state.doctors.length ? availableDoctors : '—'} note={state.doctors.length ? `de ${state.doctors.length} registros` : 'No incluido en la API'} tone="navy" />
      </div>

      <Panel className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-extrabold">Inventario de recursos</h2>
            <p className="mt-1 text-xs text-muted-foreground">Camas, personal médico y áreas hospitalarias.</p>
          </div>
          <div
            role="tablist"
            aria-label="Tipo de recurso"
            className="mf-tablist"
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const currentIndex = tabs.findIndex((item) => item.id === tab);
              const nextIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (currentIndex + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
              const nextTab = tabs[nextIndex];
              setTab(nextTab.id);
              requestAnimationFrame(() => document.getElementById(`resource-tab-${nextTab.id}`)?.focus());
            }}
          >
            {tabs.map(({ id, label, icon: Icon }, index) => (
              <button
                type="button"
                role="tab"
                id={`resource-tab-${id}`}
                aria-controls={`resource-panel-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                key={id}
                onClick={() => setTab(id)}
                className={`mf-tab ${tab === id ? 'mf-tab-active' : ''}`}
              >
                <Icon size={14} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'beds' && (
          <div id="resource-panel-beds" role="tabpanel" aria-labelledby="resource-tab-beds">
            {state.beds.length === 0 ? (
              <EmptyState icon={BedDouble} title="No hay camas disponibles" detail="La API no devolvió camas o el endpoint no está configurado correctamente." />
            ) : (
              <div className="overflow-x-auto">
              <table className="mf-table min-w-[760px]">
                <thead><tr><th>Cama</th><th>Área / tipo</th><th>Estado</th><th>Paciente</th><th>Ocupación</th><th>Acción</th></tr></thead>
                <tbody>
                  {state.beds.map((bed) => {
                    const linkedEpisode = state.episodes.find((episode) => episode.bed === bed.id || (bed.patientId && episode.patientId === bed.patientId));
                    const bedDisplayStatus = bed.availability === 'No disponible' ? 'No disponible' : bed.status;
                    const bedStatusTone = bed.availability === 'No disponible' ? 'neutral' : bed.status === 'Libre' ? 'good' : bed.status === 'Ocupada' ? 'warning' : 'neutral';
                    const selectedEpisode = bedSelections[bed.id] ?? '';
                    return (
                      <tr key={bed.id}>
                        <td className="font-mono-ui text-xs font-extrabold">{bed.id}</td>
                        <td>
                          <span className="block text-xs font-semibold">{bed.area}</span>
                          <span className="mt-1 block text-[10px] text-muted-foreground" title={bed.observations}>{bed.type}</span>
                          {bed.observations && <span className="mt-1 block max-w-48 truncate text-[9px] text-muted-foreground" title={bed.observations}>{bed.observations}</span>}
                        </td>
                        <td><StateBadge tone={bedStatusTone}>{bedDisplayStatus}</StateBadge></td>
                        <td>
                          <span className="text-xs font-semibold">{bed.patient === '—' ? '—' : bed.patient}</span>
                          {linkedEpisode && <Link className="mt-1 block text-[10px] text-accent underline" href={`/cola?episode=${linkedEpisode.id}`}>Ver episodio {linkedEpisode.id}</Link>}
                        </td>
                        <td className="text-xs text-muted-foreground">{bed.since === '—' ? '—' : `Desde ${bed.since}`}</td>
                        <td>
                          {demoMode && bed.status === 'Libre' && bed.availability !== 'No disponible' ? (
                            <div className="flex min-w-[240px] items-center gap-2">
                              <select
                                aria-label={`Episodio para cama ${bed.id}`}
                                className="mf-compact-select"
                                value={selectedEpisode}
                                onChange={(event) => setBedSelections((current) => ({ ...current, [bed.id]: event.target.value }))}
                              >
                                <option value="">Seleccionar episodio…</option>
                                {assignableEpisodes.map((episode) => {
                                  const patient = state.patients.find((person) => person.id === episode.patientId);
                                  return <option key={episode.id} value={episode.id}>{patient?.name ?? episode.id} · {episode.id}</option>;
                                })}
                              </select>
                              <ActionButton icon={Plus} variant="secondary" disabled={!selectedEpisode} onClick={() => assignBed(bed.id)} className="min-h-8 px-2.5 text-[10px]">Asignar</ActionButton>
                            </div>
                          ) : demoMode && bed.status === 'Ocupada' && bed.patientId && linkedEpisode ? (
                            <ActionButton variant="danger" onClick={() => releaseBed(bed.id)} className="min-h-8 px-2.5 text-[10px]">Liberar cama</ActionButton>
                          ) : bed.status === 'Ocupada' && !linkedEpisode ? (
                            <span className="max-w-48 text-[10px] leading-4 text-muted-foreground">Paciente no vinculado; requiere verificación externa.</span>
                          ) : !demoMode ? (
                            <span className="text-[10px] text-muted-foreground">Solo lectura</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Sin acción disponible</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'staff' && (
          <div id="resource-panel-staff" role="tabpanel" aria-labelledby="resource-tab-staff">
            {state.doctors.length === 0 ? (
              <EmptyState icon={Stethoscope} title="Disponibilidad de personal no disponible" detail="La integración actual no tiene un endpoint de lectura para médicos o disponibilidad." />
            ) : (
              <div className="overflow-x-auto">
              <table className="mf-table min-w-[760px]">
                <thead><tr><th>Profesional</th><th>Área</th><th>Turno</th><th>Pacientes asignados</th><th>Disponibilidad</th><th>Acción</th></tr></thead>
                <tbody>
                  {state.doctors.map((doctor) => (
                    <tr key={doctor.id}>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4f6] text-[10px] font-extrabold text-primary">{doctor.initials}</span>
                          <span className="min-w-0">
                            <b className="block text-xs">{doctor.name}</b>
                            <span className="mt-0.5 block font-mono-ui text-[9px] text-muted-foreground">{doctor.id}</span>
                            {doctor.observations && <span className="mt-1 block max-w-48 truncate text-[9px] text-muted-foreground" title={doctor.observations}>{doctor.observations}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="text-xs">{doctor.role}</td>
                      <td className="font-mono-ui text-[10px] text-muted-foreground">{doctor.shift}</td>
                      <td className="font-mono-ui text-xs">{doctor.patients}</td>
                      <td><StateBadge tone={doctor.availability === 'Disponible' ? 'good' : doctor.availability === 'Asignado' ? 'info' : 'neutral'}>{doctor.availability}</StateBadge></td>
                      <td>
                        {demoMode && doctor.availability === 'Disponible' && !doctor.role.toLowerCase().includes('enfermer') ? (
                          <div className="flex min-w-[250px] items-center gap-2">
                            <select
                              aria-label={`Episodio para asignar a ${doctor.name}`}
                              className="mf-compact-select"
                              value={doctorSelections[doctor.id] ?? ''}
                              onChange={(event) => setDoctorSelections((current) => ({ ...current, [doctor.id]: event.target.value }))}
                            >
                              <option value="">Seleccionar episodio…</option>
                              {assignableEpisodes.filter((episode) => !episode.doctor || episode.doctor === 'Sin asignar').map((episode) => {
                                const patient = state.patients.find((person) => person.id === episode.patientId);
                                return <option key={episode.id} value={episode.id}>{patient?.name ?? episode.id}</option>;
                              })}
                            </select>
                            <ActionButton icon={Plus} variant="secondary" disabled={!doctorSelections[doctor.id]} onClick={() => assignDoctor(doctor.id)} className="min-h-8 px-2.5 text-[10px]">Asignar</ActionButton>
                          </div>
                        ) : demoMode && doctor.patients === 0 && doctor.status === 'En turno' ? (
                          <button
                            type="button"
                            className="text-[10px] font-bold text-accent underline"
                            onClick={() => setDoctorAvailability(doctor.id, doctor.availability === 'Disponible' ? 'No disponible' : 'Disponible')}
                          >
                            {doctor.availability === 'Disponible' ? 'Marcar no disponible' : 'Marcar disponible'}
                          </button>
                        ) : !demoMode ? (
                          <span className="text-[10px] text-muted-foreground">Solo lectura</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Revisar asignaciones</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'areas' && (
          <div id="resource-panel-areas" role="tabpanel" aria-labelledby="resource-tab-areas">
            {state.areas.length === 0 ? (
              <EmptyState icon={UsersRound} title="Capacidad por área no disponible" detail="La API actual no entrega áreas, ocupación ni capacidad instalada." />
            ) : (
              <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {state.areas.map((area) => {
                const occupancy = area.total ? Math.min(100, Math.round((area.used / area.total) * 100)) : 0;
                const free = area.isAvailable ? Math.max(0, area.total - area.used - (area.unavailableBeds ?? 0)) : 0;
                return (
                  <article className="rounded-xl border border-border bg-white p-4" key={area.name}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-extrabold">{area.name}</h3>
                        <p className="mt-1 font-mono-ui text-[9px] text-muted-foreground">{area.id} · {area.attentionType}</p>
                        {area.observations && <p className="mt-1 text-[10px] text-muted-foreground">{area.observations}</p>}
                      </div>
                      <StateBadge tone={!area.isAvailable ? 'neutral' : free > 0 ? 'good' : 'warning'}>
                        {!area.isAvailable ? 'No disponible' : `${free} disponibles`}
                      </StateBadge>
                    </div>
                    <div className="mt-5 flex items-baseline justify-between">
                      <strong className="font-mono-ui text-2xl">{area.used} <span className="font-sans text-xs font-medium text-muted-foreground">ocupados</span></strong>
                      <span className="font-mono-ui text-xs text-muted-foreground">{area.total} total</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eaf0f2]">
                      <div className={`h-full rounded-full ${occupancy >= 90 ? 'bg-[#b04c43]' : occupancy >= 70 ? 'bg-[#c48a32]' : 'bg-accent'}`} style={{ width: `${occupancy}%` }} />
                    </div>
                    <p className="mt-2 text-right text-[10px] text-muted-foreground">{occupancy}% ocupación · {area.total} espacios</p>
                  </article>
                );
              })}
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="mt-4 flex flex-wrap items-start gap-2 rounded-xl border border-border bg-white px-4 py-3 text-[10px] leading-5 text-muted-foreground">
        <CircleHelp size={14} className="mt-0.5 shrink-0" />
        <p>Las altas, asignaciones y cambios de disponibilidad son de demostración. Para activar cambios reales, la API debe ofrecer operaciones de creación y asignación/liberación con reglas de exclusividad del lado servidor.</p>
      </div>
      <ResourceCreateDialog
        open={createOpen}
        initialKind={createKind}
        onOpenChange={setCreateOpen}
        onCreated={handleResourceCreated}
      />
    </div>
  );
}

function ResourceSummary({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof BedDouble;
  label: string;
  value: number | string;
  note: string;
  tone: 'teal' | 'amber' | 'navy';
}) {
  const colors = {
    teal: 'bg-[#edf7f5] text-[#16796f]',
    amber: 'bg-[#fff7e9] text-[#956216]',
    navy: 'bg-[#edf2f7] text-[#2e506e]',
  };
  return (
    <div className="mf-panel flex items-center gap-4 px-4 py-4">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}><Icon size={18} /></span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-mono-ui text-2xl font-semibold">{value} <span className="font-sans text-[10px] font-normal text-muted-foreground">{note}</span></p>
      </div>
    </div>
  );
}
