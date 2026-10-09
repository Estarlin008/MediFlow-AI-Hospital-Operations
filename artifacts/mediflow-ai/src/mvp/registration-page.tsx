import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, Link } from 'wouter';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ClipboardPlus,
  Info,
  Search,
  UserRound,
  UserRoundPlus,
} from 'lucide-react';
import { ActionButton, EmptyState, PageHeading, Panel, PriorityBadge, StateBadge, fieldClass } from './components';
import { createEvent, useMvpStore } from './state';
import { createDemoRegistration } from '@/services/mvp-demo';
import { hospitalService } from '@/services/hospital';
import type { IntakeForm, MvpPatient } from './types';

const initialForm: IntakeForm = {
  identityType: 'Carnet de identidad',
  identityNumber: '',
  name: '',
  age: '',
  birthDate: '',
  sex: 'No especificado',
  phone: '',
  reason: '',
  symptoms: '',
  duration: '',
  relevantHistory: '',
  allergies: '',
  heartRate: '',
  bloodPressure: '',
  respiratoryRate: '',
  temperature: '',
  oxygenSaturation: '',
  consciousness: '',
};

function ageFromBirthDate(date: string) {
  if (!date) return null;
  const born = new Date(`${date}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) years -= 1;
  return years >= 0 && years <= 130 ? years : null;
}

function displayAge(patient: MvpPatient) {
  return patient.age === null ? 'Edad no informada' : `${patient.age} años`;
}

export function RegistrationPage() {
  const { state, dispatch, demoMode } = useMvpStore();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<IntakeForm>(initialForm);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const age = form.age.trim() ? Number(form.age) : ageFromBirthDate(form.birthDate);

  const visiblePatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return state.patients
      .filter((patient) =>
        !query ||
        patient.name.toLowerCase().includes(query) ||
        patient.record.toLowerCase().includes(query) ||
        (patient.identityNumber ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [state.patients, search]);
  const latestEpisodes = state.episodes.slice(0, 5);
  const patientById = new Map(state.patients.map((patient) => [patient.id, patient]));

  function update<K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (notice?.kind === 'error') setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (form.birthDate && ageFromBirthDate(form.birthDate) === null) {
      setNotice({ kind: 'error', text: 'La fecha de nacimiento no es válida.' });
      return;
    }
    if (!form.age.trim() && age === null) {
      setNotice({ kind: 'error', text: 'Ingresa una edad o una fecha de nacimiento válida.' });
      return;
    }
    if (!demoMode && (age === null || (form.sex !== 'F' && form.sex !== 'M'))) {
      setNotice({
        kind: 'error',
        text: 'La API actual exige edad y sexo F/M para crear el perfil. No cambies un dato clínico desconocido por una suposición; usa el modo de demostración para revisar el formulario.',
      });
      return;
    }
    if (form.identityNumber.trim() && state.patients.some(
      (patient) => patient.identityNumber?.toLowerCase() === form.identityNumber.trim().toLowerCase(),
    )) {
      setNotice({ kind: 'error', text: 'Ya existe un paciente con ese número de documento en los datos cargados.' });
      return;
    }

    setSaving(true);
    try {
      if (demoMode) {
        const result = createDemoRegistration({ ...form, age: age === null ? '' : String(age) });
        dispatch({
          type: 'register-demo',
          patient: result.patient,
          episode: result.episode,
          event: createEvent('Registro de demostración', `${result.patient.name} · episodio ${result.episode.id}`),
        });
        setNotice({
          kind: 'success',
          text: 'Registro de demostración creado. El episodio está en espera y no tiene una prioridad asignada ni una evaluación de IA.',
        });
        setForm(initialForm);
        setLocation('/cola');
      } else {
        const saved = await hospitalService.registerPatient({
          name: form.name.trim(),
          age: age as number,
          sex: form.sex as 'F' | 'M',
          phone: form.phone.trim(),
        });
        dispatch({ type: 'register-live', patient: { ...saved, sex: saved.sex ?? 'No especificado' } });
        setNotice({
          kind: 'info',
          text: 'La API confirmó el perfil demográfico. La API actual no acepta el motivo, síntomas, signos vitales ni creación de episodios, por lo que esos datos no se guardaron ni el paciente se agregó a la cola.',
        });
        setForm(initialForm);
      }
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? `No se pudo completar el registro: ${error.message}` : 'No se pudo completar el registro.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading
        eyebrow="Ingreso de pacientes"
        title="Registro de paciente"
        description="Captura la identificación y los datos del episodio de emergencia. La prioridad no se calcula ni se completa automáticamente."
        actions={<Link className="mf-link-button" href="/cola">Abrir cola de espera <ArrowRight size={14} /></Link>}
      />

      {!demoMode && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e8d6a9] bg-[#fffaf0] px-4 py-3 text-xs leading-5 text-[#70581d]">
          <Info size={17} className="mt-0.5 shrink-0" />
          <p><strong className="font-bold">Alcance de la API actual:</strong> puede guardar solo nombre, edad, sexo y teléfono. No tiene un contrato para enviar el motivo, síntomas, signos vitales y crear el episodio completo. Esos campos no se transmitirán ni aparecerán como guardados.</p>
        </div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-5 ${
            notice.kind === 'success'
              ? 'border-[#b9dacb] bg-[#eff8f3] text-[#275c48]'
              : notice.kind === 'error'
                ? 'border-[#e8c0bc] bg-[#fff3f1] text-[#872c28]'
                : 'border-[#c7d8e6] bg-[#f2f7fb] text-[#36556e]'
          }`}
        >
          {notice.kind === 'error' ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : <Info size={17} className="mt-0.5 shrink-0" />}
          <p>{notice.text}</p>
        </div>
      )}

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <form onSubmit={submit} className="space-y-4">
          <Panel title="Identificación" detail="Los campos marcados con * son necesarios para continuar. Registra solo información disponible.">
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Tipo de documento">
                <select className={fieldClass} value={form.identityType} onChange={(e) => update('identityType', e.target.value)}>
                  <option>Carnet de identidad</option>
                  <option>Pasaporte</option>
                  <option>Otro documento</option>
                  <option>Sin documento</option>
                </select>
              </Field>
              <Field label="Número de documento" hint="Opcional">
                <input className={fieldClass} value={form.identityNumber} onChange={(e) => update('identityNumber', e.target.value)} placeholder="No obligatorio" autoComplete="off" />
              </Field>
              <Field label="Nombre completo *">
                <input className={fieldClass} value={form.name} onChange={(e) => update('name', e.target.value)} required minLength={2} maxLength={120} autoComplete="name" placeholder="Nombre y apellidos" />
              </Field>
              <Field label="Fecha de nacimiento" hint="Formato según tu navegador · o ingresa la edad">
                <input className={fieldClass} lang="es-BO" type="date" value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Edad" hint="Años cumplidos">
                <input className={fieldClass} type="number" min={0} max={130} step={1} value={form.age} onChange={(e) => update('age', e.target.value)} inputMode="numeric" placeholder="Solo si se conoce" />
              </Field>
              <Field label="Sexo registrado" hint={demoMode ? 'No especificado también es válido' : 'La API actual acepta F o M'}>
                <select className={fieldClass} value={form.sex} onChange={(e) => update('sex', e.target.value as IntakeForm['sex'])}>
                  <option value="No especificado">No especificado</option>
                  <option value="F">F</option>
                  <option value="M">M</option>
                </select>
              </Field>
              <Field label="Teléfono de contacto" hint="Opcional">
                <input className={fieldClass} type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" maxLength={40} placeholder="+591 ..." />
              </Field>
            </div>
          </Panel>

          <Panel title="Motivo de consulta" detail="Describe lo que la persona refiere, sin inferir diagnósticos.">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Motivo de consulta *">
                <input className={fieldClass} required maxLength={180} value={form.reason} onChange={(e) => update('reason', e.target.value)} placeholder="En palabras del paciente" />
              </Field>
              <Field label="Tiempo de evolución" hint="Opcional">
                <input className={fieldClass} maxLength={80} value={form.duration} onChange={(e) => update('duration', e.target.value)} placeholder="Ej. desde hace 2 horas" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Síntomas y relato *" hint="Usa lenguaje descriptivo; evita conclusiones diagnósticas.">
                  <textarea className={`${fieldClass} min-h-[92px] resize-y`} required maxLength={1500} value={form.symptoms} onChange={(e) => update('symptoms', e.target.value)} placeholder="Qué siente, cuándo comenzó y qué cambios refiere..." />
                </Field>
              </div>
              <Field label="Antecedentes relevantes" hint="Opcional">
                <textarea className={`${fieldClass} min-h-[78px] resize-y`} maxLength={500} value={form.relevantHistory} onChange={(e) => update('relevantHistory', e.target.value)} placeholder="Condiciones previas declaradas..." />
              </Field>
              <Field label="Alergias informadas" hint="Deja vacío si no se preguntó">
                <textarea className={`${fieldClass} min-h-[78px] resize-y`} maxLength={300} value={form.allergies} onChange={(e) => update('allergies', e.target.value)} placeholder="Separadas por coma" />
              </Field>
            </div>
          </Panel>

          <Panel title="Signos vitales y observación inicial" detail="Registra mediciones observadas. Los campos vacíos se conservan como no disponibles; no se completan con valores estimados.">
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Frecuencia cardíaca" hint="latidos/min">
                <input className={fieldClass} type="number" min={20} max={250} value={form.heartRate} onChange={(e) => update('heartRate', e.target.value)} placeholder="No registrada" />
              </Field>
              <Field label="Presión arterial" hint="mmHg">
                <input className={fieldClass} value={form.bloodPressure} onChange={(e) => update('bloodPressure', e.target.value)} pattern="\d{2,3}/\d{2,3}" placeholder="Ej. 120/80" title="Usa formato sistólica/diastólica, por ejemplo 120/80." />
              </Field>
              <Field label="Frecuencia respiratoria" hint="respiraciones/min">
                <input className={fieldClass} type="number" min={4} max={80} value={form.respiratoryRate} onChange={(e) => update('respiratoryRate', e.target.value)} placeholder="No registrada" />
              </Field>
              <Field label="Temperatura" hint="°C">
                <input className={fieldClass} type="number" min={30} max={43} step={0.1} value={form.temperature} onChange={(e) => update('temperature', e.target.value)} placeholder="No registrada" />
              </Field>
              <Field label="Saturación de oxígeno" hint="%">
                <input className={fieldClass} type="number" min={50} max={100} value={form.oxygenSaturation} onChange={(e) => update('oxygenSaturation', e.target.value)} placeholder="No registrada" />
              </Field>
              <Field label="Estado de conciencia" hint="Observación descriptiva">
                <select className={fieldClass} value={form.consciousness} onChange={(e) => update('consciousness', e.target.value)}>
                  <option value="">No registrado</option>
                  <option value="Alerta">Alerta</option>
                  <option value="Responde a la voz">Responde a la voz</option>
                  <option value="Responde al estímulo">Responde al estímulo</option>
                  <option value="No responde">No responde</option>
                  <option value="Otro">Otro / no determinado</option>
                </select>
              </Field>
            </div>
          </Panel>

          <div className="flex flex-col-reverse gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-[11px] leading-5 text-muted-foreground">
              {demoMode
                ? 'En esta sesión de demostración se creará un episodio pendiente. No se ejecuta IA, no se determina prioridad y los cambios no se conservan al cerrar la pestaña.'
                : 'La integración solo recibirá los datos demográficos soportados por el endpoint actual. Los datos clínicos de este formulario no se transmitirán.'}
            </p>
            <ActionButton type="submit" icon={UserRoundPlus} disabled={saving || state.loading} className="shrink-0">
              {saving ? 'Guardando…' : demoMode ? 'Crear registro de demo' : 'Guardar perfil con API'}
            </ActionButton>
          </div>
        </form>

        <aside className="space-y-4 2xl:sticky 2xl:top-5">
          <Panel title="Datos de la fuente" detail={demoMode ? 'Los siguientes registros son ficticios y sirven solo para recorrer la interfaz.' : 'Registros cargados desde los endpoints configurados.'}>
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pacientes cargados</span>
                <strong className="font-mono-ui">{state.patients.length}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Episodios en cola</span>
                <strong className="font-mono-ui">{state.episodes.filter((episode) => episode.status !== 'Atendido').length}</strong>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Evaluación automática</span>
                <StateBadge tone={demoMode ? 'warning' : 'info'}>{demoMode ? 'No conectada en demo' : 'Endpoint disponible'}</StateBadge>
              </div>
              {demoMode && (
                <p className="rounded-lg bg-[#f2f6f8] px-3 py-2 text-[10px] leading-4 text-muted-foreground">
                  Los ejemplos de clasificación del sistema son datos estáticos y no provienen de una ejecución real de n8n.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Pacientes registrados" detail="Busca por nombre, código de registro o documento.">
            <div className="border-b border-border px-4 py-3">
              <label className="relative block">
                <span className="sr-only">Buscar paciente</span>
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input className={`${fieldClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, código o documento" />
              </label>
            </div>
            {visiblePatients.length === 0 ? (
              <EmptyState icon={UserRound} title="No se encontraron pacientes" detail="Prueba con otro nombre o número de registro." />
            ) : (
              <div className="divide-y divide-border">
                {visiblePatients.map((patient) => (
                  <div key={patient.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef4f6] text-xs font-extrabold text-primary">
                      {patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{patient.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{patient.record} · {displayAge(patient)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocation(`/cola?patient=${encodeURIComponent(patient.id)}`)}
                      className="mf-icon-button"
                      aria-label={`Ver episodios de ${patient.name}`}
                      title="Ver episodios"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Episodios recientes" detail="La prioridad vigente permanece separada de la sugerencia externa.">
            {latestEpisodes.length === 0 ? (
              <EmptyState icon={ClipboardPlus} title="Sin episodios" detail="Los registros con episodio aparecerán aquí." />
            ) : (
              <div className="divide-y divide-border">
                {latestEpisodes.map((episode) => (
                  <Link key={episode.id} href={`/cola?episode=${episode.id}`} className="block px-4 py-3 transition hover:bg-[#fafcfd]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{patientById.get(episode.patientId)?.name ?? 'Paciente'}</p>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">{episode.reason}</p>
                      </div>
                      <PriorityBadge priority={episode.priority} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 text-xs font-bold text-foreground">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        {hint && <span className="text-[10px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
