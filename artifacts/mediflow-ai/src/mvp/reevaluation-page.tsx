import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, Link } from 'wouter';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  History,
  Info,
  Save,
  Stethoscope,
} from 'lucide-react';
import { ActionButton, EmptyState, PageHeading, Panel, PriorityBadge, StateBadge, fieldClass } from './components';
import { createEvent, useMvpStore } from './state';
import type { MvpEpisode, ReassessmentForm } from './types';

const emptyForm: ReassessmentForm = {
  heartRate: '',
  bloodPressure: '',
  respiratoryRate: '',
  temperature: '',
  oxygenSaturation: '',
  consciousness: '',
  symptomChange: '',
  observations: '',
};

function timeNow() {
  return new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

export function ReevaluationPage() {
  const { state, dispatch, demoMode } = useMvpStore();
  const [location] = useLocation();
  const activeEpisodes = state.episodes.filter((episode) => episode.status !== 'Atendido');
  const [episodeId, setEpisodeId] = useState(() => new URLSearchParams(window.location.search).get('episode') ?? '');
  const [form, setForm] = useState<ReassessmentForm>(emptyForm);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('episode');
    if (fromUrl && state.episodes.some((episode) => episode.id === fromUrl)) {
      setEpisodeId(fromUrl);
    } else if (!episodeId && activeEpisodes[0]) {
      setEpisodeId(activeEpisodes[0].id);
    }
    // A route change may provide a selected episode after this page mounts.
  }, [location, state.episodes.length]);

  const episode = useMemo(
    () => activeEpisodes.find((item) => item.id === episodeId) ?? null,
    [activeEpisodes, episodeId],
  );
  const patient = episode && state.patients.find((item) => item.id === episode.patientId);

  function update<K extends keyof ReassessmentForm>(key: K, value: ReassessmentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function selectEpisode(next: string) {
    setEpisodeId(next);
    setForm(emptyForm);
    setNotice(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!demoMode || !episode) return;
    const hasMeasurement = [
      form.heartRate,
      form.bloodPressure,
      form.respiratoryRate,
      form.temperature,
      form.oxygenSaturation,
      form.consciousness,
    ].some((value) => value.trim());
    if (!hasMeasurement && !form.symptomChange.trim() && !form.observations.trim()) {
      setNotice({ error: true, text: 'Registra una medición, un cambio referido o una observación para guardar la reevaluación.' });
      return;
    }

    setSaving(true);
    const timestamp = timeNow();
    const nextVitals = {
      ...(form.heartRate.trim() ? { fc: Number(form.heartRate) } : {}),
      ...(form.bloodPressure.trim() ? { pa: form.bloodPressure.trim() } : {}),
      ...(form.respiratoryRate.trim() ? { respiratoryRate: Number(form.respiratoryRate) } : {}),
      ...(form.temperature.trim() ? { temp: Number(form.temperature) } : {}),
      ...(form.oxygenSaturation.trim() ? { spo2: Number(form.oxygenSaturation) } : {}),
      ...(form.consciousness.trim() ? { consciousness: form.consciousness } : {}),
      ...(hasMeasurement ? { recordedAt: new Date().toISOString() } : {}),
    };
    const previous = {
      at: episode.vitals.recordedAt ?? `Ingreso · ${episode.createdAt}`,
      vitals: episode.vitals,
      symptomChange: '',
      observations: episode.observations,
    };
    const updatedVitals = hasMeasurement ? nextVitals : episode.vitals;
    const nextEpisode: MvpEpisode = {
      ...episode,
      vitals: updatedVitals,
      symptoms: form.symptomChange.trim() || episode.symptoms,
      observations: form.observations.trim() || episode.observations,
      lastReassessmentAt: timestamp,
      needsReassessment: false,
      reassessmentHistory: [
        ...(episode.reassessmentHistory?.length ? episode.reassessmentHistory : [previous]),
        {
          at: timestamp,
          vitals: updatedVitals,
          symptomChange: form.symptomChange.trim(),
          observations: form.observations.trim(),
        },
      ].slice(-8),
    };
    dispatch({
      type: 'reassess',
      episode: nextEpisode,
      event: createEvent('Reevaluación registrada en demo', `${episode.id} · ${timestamp}`),
    });
    setNotice({ text: 'Reevaluación registrada solo en esta sesión. No se generó ni cambió una prioridad.' });
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Seguimiento de emergencias"
        title="Reevaluación"
        description="Registra cambios reportados, nuevas mediciones y observaciones. La prioridad existente no se recalcula aquí."
        actions={<Link className="mf-link-button" href="/cola">Volver a la cola <ArrowRight size={14} /></Link>}
      />

      {!demoMode && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e8d6a9] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#70581d]">
          <Info size={17} className="mt-0.5 shrink-0" />
          <p><strong>Reevaluación no conectada.</strong> La integración actual no tiene un endpoint para guardar cambios clínicos de un episodio ni para ejecutar una evaluación externa con las nuevas mediciones. La pantalla permanece en solo lectura; no se harán solicitudes con datos incompletos.</p>
        </div>
      )}
      {demoMode && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e8d6a9] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#70581d]">
          <Info size={17} className="mt-0.5 shrink-0" />
          <p><strong>Modo demo.</strong> Puedes probar el flujo de reevaluación; los cambios existen solo en memoria de esta sesión. No hay análisis de IA, fórmula de riesgo ni ajuste automático de prioridad.</p>
        </div>
      )}

      {notice && (
        <div role={notice.error ? 'alert' : 'status'} aria-live="polite" className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-5 ${notice.error ? 'border-[#e8c0bc] bg-[#fff3f1] text-[#872c28]' : 'border-[#b9dacb] bg-[#eff8f3] text-[#275c48]'}`}>
          {notice.error ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
          <p>{notice.text}</p>
        </div>
      )}

      {activeEpisodes.length === 0 ? (
        <Panel><EmptyState icon={Stethoscope} title="No hay episodios activos" detail="Los episodios abiertos aparecerán aquí para su seguimiento." /></Panel>
      ) : (
        <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(350px,0.8fr)]">
          <div className="space-y-4">
            <Panel title="Selecciona un episodio" detail="Solo se muestran episodios que aún no han sido marcados como atendidos.">
              <div className="grid gap-4 p-5 md:grid-cols-[minmax(240px,1fr)_minmax(260px,1fr)]">
                <label className="block text-xs font-bold">
                  Episodio
                  <select className={fieldClass} value={episodeId} onChange={(event) => selectEpisode(event.target.value)}>
                    {activeEpisodes.map((item) => {
                      const person = state.patients.find((record) => record.id === item.patientId);
                      return <option key={item.id} value={item.id}>{person?.name ?? 'Paciente'} · {item.id}</option>;
                    })}
                  </select>
                </label>
                {episode && patient ? (
                  <div className="rounded-lg border border-border bg-[#fafcfd] px-3.5 py-3">
                    <p className="text-xs font-extrabold">{patient.name} <span className="font-mono-ui text-[10px] font-medium text-muted-foreground">{patient.record}</span></p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{episode.reason}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StateBadge tone={episode.status === 'En atención' ? 'info' : 'warning'}>{episode.status}</StateBadge>
                      <PriorityBadge priority={episode.priority} />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">Selecciona un episodio disponible.</p>
                )}
              </div>
            </Panel>

            {episode && (
              <>
                <Panel title="Último registro" detail="No se realizan inferencias clínicas a partir de estos valores.">
                  <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3">
                    <Vital label="Frecuencia cardíaca" value={episode.vitals.fc} unit="lpm" />
                    <Vital label="Presión arterial" value={episode.vitals.pa} unit="mmHg" />
                    <Vital label="Frecuencia respiratoria" value={episode.vitals.respiratoryRate} unit="rpm" />
                    <Vital label="Temperatura" value={episode.vitals.temp} unit="°C" />
                    <Vital label="Saturación O₂" value={episode.vitals.spo2} unit="%" />
                    <Vital label="Conciencia" value={episode.vitals.consciousness} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> Último registro: {episode.lastReassessmentAt ?? episode.vitals.recordedAt ?? `Ingreso · ${episode.createdAt}`}</span>
                    <span>Ubicación: {episode.area}</span>
                  </div>
                </Panel>

                <form onSubmit={submit}>
                  <Panel title="Nueva reevaluación" detail="Los campos se dejan vacíos hasta ingresar una nueva observación. No se copian mediciones anteriores.">
                    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                      <Field label="Frecuencia cardíaca" unit="lpm">
                        <input className={fieldClass} disabled={!demoMode} type="number" min={20} max={250} value={form.heartRate} onChange={(event) => update('heartRate', event.target.value)} placeholder="No medida" />
                      </Field>
                      <Field label="Presión arterial" unit="mmHg">
                        <input className={fieldClass} disabled={!demoMode} pattern="\d{2,3}/\d{2,3}" value={form.bloodPressure} onChange={(event) => update('bloodPressure', event.target.value)} placeholder="Ej. 120/80" title="Formato sistólica/diastólica, por ejemplo 120/80." />
                      </Field>
                      <Field label="Frecuencia respiratoria" unit="rpm">
                        <input className={fieldClass} disabled={!demoMode} type="number" min={4} max={80} value={form.respiratoryRate} onChange={(event) => update('respiratoryRate', event.target.value)} placeholder="No medida" />
                      </Field>
                      <Field label="Temperatura" unit="°C">
                        <input className={fieldClass} disabled={!demoMode} type="number" min={30} max={43} step={0.1} value={form.temperature} onChange={(event) => update('temperature', event.target.value)} placeholder="No medida" />
                      </Field>
                      <Field label="Saturación de oxígeno" unit="%">
                        <input className={fieldClass} disabled={!demoMode} type="number" min={50} max={100} value={form.oxygenSaturation} onChange={(event) => update('oxygenSaturation', event.target.value)} placeholder="No medida" />
                      </Field>
                      <Field label="Estado de conciencia">
                        <select className={fieldClass} disabled={!demoMode} value={form.consciousness} onChange={(event) => update('consciousness', event.target.value)}>
                          <option value="">No observado</option>
                          <option value="Alerta">Alerta</option>
                          <option value="Responde a la voz">Responde a la voz</option>
                          <option value="Responde al estímulo">Responde al estímulo</option>
                          <option value="No responde">No responde</option>
                          <option value="Otro">Otro / no determinado</option>
                        </select>
                      </Field>
                      <div className="sm:col-span-2 xl:col-span-3">
                        <Field label="Cambios referidos desde la última evaluación">
                          <textarea className={`${fieldClass} min-h-[78px] resize-y`} disabled={!demoMode} maxLength={1000} value={form.symptomChange} onChange={(event) => update('symptomChange', event.target.value)} placeholder="Registrar cambios relatados por el paciente..." />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 xl:col-span-3">
                        <Field label="Observaciones del profesional">
                          <textarea className={`${fieldClass} min-h-[78px] resize-y`} disabled={!demoMode} maxLength={1000} value={form.observations} onChange={(event) => update('observations', event.target.value)} placeholder="Anotaciones descriptivas..." />
                        </Field>
                      </div>
                    </div>
                    <div className="flex flex-col-reverse gap-3 border-t border-border bg-[#fbfcfd] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-xl text-[10px] leading-5 text-muted-foreground">
                        Guardar esta nota no cambia la prioridad. Para solicitar o persistir una reevaluación externa hace falta un endpoint que acepte estas mediciones.
                      </p>
                      <ActionButton type="submit" icon={Save} disabled={!demoMode || saving}>
                        {saving ? 'Guardando…' : 'Guardar reevaluación de demo'}
                      </ActionButton>
                    </div>
                  </Panel>
                </form>
              </>
            )}
          </div>

          <aside className="space-y-4 2xl:sticky 2xl:top-5">
            {episode && (
              <Panel title="Prioridad y evaluación" detail="Sugerencia externa y decisión operativa se mantienen separadas.">
                <div className="space-y-4 p-5">
                  <PriorityPair label="Prioridad vigente" value={episode.priority} detail="Decisión operativa confirmada" />
                  <PriorityPair label="Sugerencia externa" value={episode.proposedPriority ?? null} detail={episode.prioritySource ?? 'No disponible'} />
                  <div className="rounded-lg border border-[#dce5eb] bg-[#f6f9fb] px-3 py-3">
                    <p className="text-[10px] font-bold text-foreground">Estado de evaluación</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StateBadge tone={episode.proposedPriority ? 'info' : 'neutral'}>{episode.triageStatus ?? 'Pendiente'}</StateBadge>
                      <span className="text-[10px] text-muted-foreground">{demoMode ? 'Muestra estática' : 'Sin reevaluación conectada'}</span>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                      {demoMode
                        ? 'El modo demo no ejecuta IA. No se simula una respuesta ni se estima una categoría.'
                        : 'El servicio no admite enviar las nuevas mediciones al evaluador externo.'}
                    </p>
                  </div>
                  <ActionButton
                    variant="secondary"
                    icon={Stethoscope}
                    disabled
                    className="w-full"
                    title="No existe una ruta de reevaluación que reciba las mediciones nuevas."
                  >
                    Solicitar reevaluación externa
                  </ActionButton>
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    La opción se habilitará cuando la integración permita enviar el episodio actualizado y guardar la respuesta.
                  </p>
                </div>
              </Panel>
            )}

            <Panel title="Historial de reevaluación" detail="Se conserva como parte del estado de la sesión de demo.">
              {!episode?.reassessmentHistory?.length ? (
                <EmptyState icon={History} title="Sin reevaluaciones registradas" detail="El registro inicial aparece arriba. Las nuevas notas se agregan al historial al guardarse." />
              ) : (
                <div className="divide-y divide-border">
                  {[...episode.reassessmentHistory].reverse().map((entry, index) => (
                    <div className="px-4 py-3" key={`${entry.at}-${index}`}>
                      <p className="font-mono-ui text-[10px] font-bold text-accent">{entry.at}</p>
                      {entry.symptomChange && <p className="mt-1 text-xs font-semibold">{entry.symptomChange}</p>}
                      {entry.observations && <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{entry.observations}</p>}
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        FC {entry.vitals.fc ?? '—'} · PA {entry.vitals.pa ?? '—'} · FR {entry.vitals.respiratoryRate ?? '—'} · T° {entry.vitals.temp ?? '—'} · SpO₂ {entry.vitals.spo2 ?? '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold">
      <span className="flex items-baseline justify-between gap-2">{label}{unit && <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>}</span>
      {children}
    </label>
  );
}

function Vital({ label, value, unit = '' }: { label: string; value?: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono-ui text-base font-semibold">{value === undefined || value === '' ? '—' : `${value}${unit ? ` ${unit}` : ''}`}</p>
    </div>
  );
}

function PriorityPair({ label, value, detail }: { label: string; value: MvpEpisode['priority']; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold">{label}</p>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</p>
      </div>
      <PriorityBadge priority={value} />
    </div>
  );
}
