import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActionButton, fieldClass } from './components';
import { createEvent, useMvpStore } from './state';
import type { MvpArea, MvpBed, MvpDoctor } from './types';

export type ResourceKind = 'doctor' | 'bed' | 'area';

type ResourceForm = {
  kind: ResourceKind;
  id: string;
  name: string;
  detail: string;
  area: string;
  shift: string;
  capacity: string;
  status: 'available' | 'unavailable';
  observations: string;
};

const typeLabels: Record<ResourceKind, string> = {
  doctor: 'médico',
  bed: 'cama',
  area: 'área de atención',
};

function blankForm(kind: ResourceKind, firstAvailableArea = ''): ResourceForm {
  return {
    kind,
    id: '',
    name: '',
    detail: '',
    area: firstAvailableArea,
    shift: '',
    capacity: '1',
    status: 'available',
    observations: '',
  };
}

function normalizeId(value: string) {
  return value.trim().toLocaleUpperCase('es-BO');
}

function normalizeName(value: string) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-BO');
}

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase('es-BO')).join('');
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-xs font-semibold text-foreground">
      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ResourceCreateDialog({
  open,
  initialKind,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  initialKind: ResourceKind;
  onOpenChange: (open: boolean) => void;
  onCreated: (kind: ResourceKind, id: string) => void;
}) {
  const { state, dispatch, demoMode } = useMvpStore();
  const firstAvailableArea = state.areas.find((area) => area.isAvailable)?.name ?? '';
  const [form, setForm] = useState(() => blankForm(initialKind, firstAvailableArea));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(blankForm(initialKind, firstAvailableArea));
    setFormError('');
  }, [open, initialKind]);

  const allIds = [
    ...state.beds.map((resource) => resource.id),
    ...state.doctors.map((resource) => resource.id),
    ...state.areas.map((resource) => resource.id),
  ];
  const duplicateId = Boolean(
    form.id.trim() && allIds.some((id) => normalizeId(id) === normalizeId(form.id)),
  );
  const duplicateAreaName = form.kind === 'area' && Boolean(
    form.name.trim() &&
    state.areas.some((area) => normalizeName(area.name) === normalizeName(form.name)),
  );
  const availableAreas = state.areas.filter((area) => area.isAvailable);

  function closeDialog() {
    setForm(blankForm(initialKind, firstAvailableArea));
    setFormError('');
    onOpenChange(false);
  }

  function updateForm<K extends keyof ResourceForm>(key: K, value: ResourceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  }

  function changeKind(kind: ResourceKind) {
    setForm(blankForm(kind, firstAvailableArea));
    setFormError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = normalizeId(form.id);
    const errors: string[] = [];

    if (!demoMode) {
      setFormError('La API actual no ofrece una operación para guardar recursos. No se envió ningún cambio.');
      return;
    }
    if (!id) errors.push('Ingresa el identificador del recurso.');
    else if (!/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(id)) {
      errors.push('Usa un identificador de hasta 32 caracteres: letras, números, punto, guion o guion bajo.');
    } else if (duplicateId) {
      errors.push('Ese identificador ya está registrado en otro recurso.');
    }
    if (form.kind === 'doctor' && !form.name.trim()) errors.push('Ingresa el nombre del médico.');
    if (form.kind === 'doctor' && !form.detail.trim()) errors.push('Ingresa la especialidad del médico.');
    if (form.kind === 'bed' && !form.area) errors.push('Selecciona un área disponible para la cama.');
    if (form.kind === 'bed' && !form.detail.trim()) errors.push('Ingresa el tipo de cama.');
    if (form.kind === 'area' && !form.name.trim()) errors.push('Ingresa el nombre del área.');
    if (form.kind === 'area' && duplicateAreaName) errors.push('Ya existe un área con ese nombre.');
    if (form.kind === 'area' && !form.detail.trim()) errors.push('Indica el tipo de atención del área.');
    const capacity = Number(form.capacity);
    if (form.kind === 'area' && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) {
      errors.push('La capacidad debe ser un número entero entre 1 y 500.');
    }
    if (errors.length) {
      setFormError(errors.join(' '));
      return;
    }

    const event = createEvent(
      'Recurso agregado en demo',
      `${typeLabels[form.kind]} ${id}`,
    );
    if (form.kind === 'doctor') {
      const doctor: MvpDoctor = {
        id,
        name: form.name.trim(),
        role: form.detail.trim(),
        initials: initialsFromName(form.name),
        shift: form.shift.trim() || 'Turno no informado',
        status: 'En turno',
        patients: 0,
        availability: form.status === 'available' ? 'Disponible' : 'No disponible',
        observations: form.observations.trim() || undefined,
      };
      dispatch({ type: 'add-doctor', doctor, event });
    } else if (form.kind === 'bed') {
      const bed: MvpBed = {
        id,
        area: form.area,
        type: form.detail.trim(),
        status: form.status === 'available' ? 'Libre' : 'Limpieza',
        patient: '—',
        since: '—',
        acuity: '—',
        observations: form.observations.trim() || undefined,
      };
      dispatch({ type: 'add-bed', bed, event });
    } else {
      const area: MvpArea = {
        id,
        name: form.name.trim(),
        attentionType: form.detail.trim(),
        used: 0,
        total: capacity,
        note: 'Área agregada durante la demostración',
        color: 'teal',
        isAvailable: form.status === 'available',
        observations: form.observations.trim() || undefined,
      };
      dispatch({ type: 'add-area', area, event });
    }

    onCreated(form.kind, id);
    closeDialog();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : closeDialog()}>
      <DialogContent className="max-w-xl border-border bg-white p-0 sm:rounded-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-accent">Inventario de recursos</p>
          <DialogTitle className="mt-1 text-lg font-extrabold tracking-[-0.03em]">Agregar recurso</DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Registra el recurso y su estado inicial. Los cambios de demostración se mantienen solo en esta sesión.
          </DialogDescription>
        </DialogHeader>

        {!demoMode ? (
          <div className="space-y-4 px-6 py-5">
            <div role="status" className="rounded-xl border border-[#e8d6a9] bg-[#fffaf0] p-4 text-xs leading-5 text-[#70581d]">
              <strong>No disponible en la API actual.</strong> El servicio permite consultar camas, pero no expone operaciones para crear médicos, camas o áreas. No se guardará ningún recurso hasta que se agregue una operación de alta al backend.
            </div>
            <DialogFooter>
              <ActionButton variant="secondary" onClick={closeDialog}>Cerrar</ActionButton>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4 px-6 py-5" noValidate onSubmit={submit}>
            <FormField label="Tipo de recurso *">
              <select
                className={fieldClass}
                value={form.kind}
                onChange={(event) => changeKind(event.target.value as ResourceKind)}
              >
                <option value="doctor">Médico</option>
                <option value="bed">Cama</option>
                <option value="area">Área de atención</option>
              </select>
            </FormField>

            <FormField
              label="Identificador *"
              hint="Único entre todos los recursos"
            >
              <input
                className={fieldClass}
                value={form.id}
                onChange={(event) => updateForm('id', event.target.value.toUpperCase())}
                placeholder={form.kind === 'doctor' ? 'MED-07' : form.kind === 'bed' ? 'E-15' : 'AREA-TRIAGE'}
                maxLength={32}
                autoComplete="off"
                aria-invalid={duplicateId}
                aria-describedby={duplicateId ? 'resource-id-error' : undefined}
                required
              />
              {duplicateId && <span id="resource-id-error" className="mt-1 block text-[10px] font-semibold text-[#a3312c]">Ese identificador ya existe.</span>}
            </FormField>

            {form.kind === 'doctor' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nombre del médico *">
                  <input className={fieldClass} value={form.name} onChange={(event) => updateForm('name', event.target.value)} maxLength={120} autoComplete="name" required />
                </FormField>
                <FormField label="Especialidad *">
                  <input className={fieldClass} value={form.detail} onChange={(event) => updateForm('detail', event.target.value)} maxLength={80} placeholder="Urgencias, trauma…" required />
                </FormField>
                <FormField label="Turno" hint="Opcional">
                  <input className={fieldClass} value={form.shift} onChange={(event) => updateForm('shift', event.target.value)} maxLength={60} placeholder="Ej. 07:00–15:00" />
                </FormField>
              </div>
            )}

            {form.kind === 'bed' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Área de atención *">
                  <select className={fieldClass} value={form.area} onChange={(event) => updateForm('area', event.target.value)} required>
                    <option value="">Selecciona un área…</option>
                    {availableAreas.map((area) => <option key={area.id} value={area.name}>{area.name}</option>)}
                  </select>
                  {availableAreas.length === 0 && <span className="mt-1 block text-[10px] text-[#8a641c]">Agrega primero un área disponible.</span>}
                </FormField>
                <FormField label="Tipo de cama *">
                  <input className={fieldClass} value={form.detail} onChange={(event) => updateForm('detail', event.target.value)} maxLength={80} placeholder="Estándar, monitorizada…" required />
                </FormField>
              </div>
            )}

            {form.kind === 'area' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Nombre del área *">
                    <input
                      className={fieldClass}
                      value={form.name}
                      onChange={(event) => updateForm('name', event.target.value)}
                      maxLength={80}
                      aria-invalid={duplicateAreaName}
                      aria-describedby={duplicateAreaName ? 'resource-area-error' : undefined}
                      required
                    />
                    {duplicateAreaName && <span id="resource-area-error" className="mt-1 block text-[10px] font-semibold text-[#a3312c]">Ya existe un área con ese nombre.</span>}
                  </FormField>
                  <FormField label="Tipo de atención *">
                    <input className={fieldClass} value={form.detail} onChange={(event) => updateForm('detail', event.target.value)} maxLength={80} placeholder="Urgencias, trauma…" required />
                  </FormField>
                  <FormField label="Capacidad *" hint="Espacios disponibles">
                    <input className={fieldClass} type="number" min={1} max={500} step={1} inputMode="numeric" value={form.capacity} onChange={(event) => updateForm('capacity', event.target.value)} required />
                  </FormField>
                </div>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Estado inicial *">
                <select className={fieldClass} value={form.status} onChange={(event) => updateForm('status', event.target.value as ResourceForm['status'])}>
                  <option value="available">Disponible</option>
                  <option value="unavailable">No disponible</option>
                </select>
              </FormField>
              <FormField label="Observaciones" hint="Opcional">
                <textarea className={`${fieldClass} min-h-10 resize-y`} rows={2} value={form.observations} onChange={(event) => updateForm('observations', event.target.value)} maxLength={300} placeholder="Información adicional…" />
              </FormField>
            </div>

            {formError && <p role="alert" className="rounded-lg border border-[#e7b8b3] bg-[#fff4f2] px-3 py-2 text-xs leading-5 text-[#952e29]">{formError}</p>}

            <DialogFooter className="border-t border-border pt-4">
              <ActionButton variant="secondary" onClick={closeDialog}>Cancelar</ActionButton>
              <ActionButton type="submit" icon={Plus}>Registrar recurso</ActionButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
