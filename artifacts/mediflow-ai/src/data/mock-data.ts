export type PatientStatus = 'En atención' | 'En espera' | 'Observación' | 'Alta';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export type Patient = {
  id: string;
  record: string;
  name: string;
  age: number;
  sex: 'F' | 'M';
  blood: string;
  allergies: string[];
  chronic: string[];
  medications: string[];
  status: PatientStatus;
  lastVisit: string;
  phone: string;
};

export type Episode = {
  id: string;
  patientId: string;
  reason: string;
  vitals: { fc: number; pa: string; spo2: number; temp: number };
  priority: Priority;
  status: 'En espera' | 'En atención' | 'Observación' | 'Completado';
  area: string;
  doctor: string;
  bed: string;
  wait: string;
  observations: string;
  createdAt: string;
};

export const patients: Patient[] = [
  { id: 'pt-1048', record: 'MF-240184', name: 'Valentina Ríos', age: 42, sex: 'F', blood: 'O+', allergies: ['Penicilina'], chronic: ['Asma'], medications: ['Salbutamol inhalado'], status: 'En atención', lastVisit: 'Hoy, 08:42', phone: '55 2840 1192' },
  { id: 'pt-1051', record: 'MF-240207', name: 'Jorge Mendoza', age: 67, sex: 'M', blood: 'A-', allergies: ['Ninguna conocida'], chronic: ['Hipertensión', 'Diabetes II'], medications: ['Losartán', 'Metformina'], status: 'En espera', lastVisit: 'Hoy, 09:18', phone: '55 3108 4471' },
  { id: 'pt-1056', record: 'MF-240219', name: 'Camila Torres', age: 29, sex: 'F', blood: 'B+', allergies: ['Ibuprofeno'], chronic: ['Ninguno'], medications: ['Ninguno'], status: 'Observación', lastVisit: 'Ayer, 23:05', phone: '55 8241 6059' },
  { id: 'pt-1062', record: 'MF-240234', name: 'Mateo Salgado', age: 8, sex: 'M', blood: 'O-', allergies: ['Nueces'], chronic: ['Ninguno'], medications: ['Ninguno'], status: 'En espera', lastVisit: 'Hoy, 09:36', phone: '55 1984 0336' },
  { id: 'pt-1066', record: 'MF-240241', name: 'Ana Lucía Peña', age: 54, sex: 'F', blood: 'AB+', allergies: ['Ninguna conocida'], chronic: ['Migraña'], medications: ['Sumatriptán'], status: 'Alta', lastVisit: '12 jun, 16:20', phone: '55 4520 7811' },
  { id: 'pt-1070', record: 'MF-240255', name: 'Rafael Ibarra', age: 36, sex: 'M', blood: 'A+', allergies: ['Sulfas'], chronic: ['Ninguno'], medications: ['Ninguno'], status: 'En atención', lastVisit: 'Hoy, 07:54', phone: '55 6712 0049' },
  { id: 'pt-1073', record: 'MF-240260', name: 'Sofía Navarro', age: 73, sex: 'F', blood: 'O+', allergies: ['Ninguna conocida'], chronic: ['EPOC'], medications: ['Tiotropio'], status: 'Observación', lastVisit: 'Hoy, 06:22', phone: '55 2261 1180' },
];

export const episodes: Episode[] = [
  { id: 'ep-8821', patientId: 'pt-1048', reason: 'Dificultad respiratoria progresiva', vitals: { fc: 112, pa: '148/92', spo2: 91, temp: 37.8 }, priority: 'P1', status: 'En atención', area: 'Emergencias · Cubículo 03', doctor: 'Dra. Elisa Montero', bed: 'E-03', wait: '04 min', observations: 'Crisis asmática probable. Refiere opresión torácica desde las 07:55.', createdAt: '08:42' },
  { id: 'ep-8824', patientId: 'pt-1051', reason: 'Dolor torácico y mareo', vitals: { fc: 98, pa: '165/101', spo2: 96, temp: 36.9 }, priority: 'P2', status: 'En espera', area: 'Triaje · Sala A', doctor: 'Sin asignar', bed: 'Pendiente', wait: '18 min', observations: 'Dolor irradiado a brazo izquierdo. ECG solicitado.', createdAt: '09:18' },
  { id: 'ep-8827', patientId: 'pt-1056', reason: 'Laceración profunda en mano derecha', vitals: { fc: 82, pa: '121/78', spo2: 99, temp: 36.7 }, priority: 'P3', status: 'Observación', area: 'Procedimientos · Box 02', doctor: 'Dr. Iván Prieto', bed: 'P-02', wait: '—', observations: 'Sutura realizada. Vigilar sangrado durante 30 min.', createdAt: '23:05' },
  { id: 'ep-8830', patientId: 'pt-1062', reason: 'Fiebre alta y vómito', vitals: { fc: 124, pa: '98/61', spo2: 97, temp: 39.4 }, priority: 'P2', status: 'En espera', area: 'Pediatría · Sala B', doctor: 'Sin asignar', bed: 'Pendiente', wait: '27 min', observations: 'Acompañado por madre. Tolerancia oral disminuida.', createdAt: '09:36' },
  { id: 'ep-8832', patientId: 'pt-1070', reason: 'Trauma por accidente vial', vitals: { fc: 104, pa: '132/86', spo2: 94, temp: 37.1 }, priority: 'P1', status: 'En atención', area: 'Trauma · Cubículo 01', doctor: 'Dr. Andrés Cota', bed: 'T-01', wait: '00 min', observations: 'Ingreso en ambulancia. Se activa protocolo trauma.', createdAt: '07:54' },
  { id: 'ep-8835', patientId: 'pt-1073', reason: 'Exacerbación de EPOC', vitals: { fc: 106, pa: '139/84', spo2: 89, temp: 37.2 }, priority: 'P2', status: 'Observación', area: 'Emergencias · Cubículo 07', doctor: 'Dra. Elisa Montero', bed: 'E-07', wait: '—', observations: 'Oxígeno a 2 L/min. Revalorar saturación en 15 min.', createdAt: '06:22' },
];

export const beds = [
  { id: 'E-01', area: 'Emergencias', type: 'Monitorizada', status: 'Ocupada', patient: 'Rafael Ibarra', since: '07:54', acuity: 'P1' },
  { id: 'E-02', area: 'Emergencias', type: 'Monitorizada', status: 'Libre', patient: '—', since: '—', acuity: '—' },
  { id: 'E-03', area: 'Emergencias', type: 'Monitorizada', status: 'Ocupada', patient: 'Valentina Ríos', since: '08:48', acuity: 'P1' },
  { id: 'E-04', area: 'Emergencias', type: 'Monitorizada', status: 'Limpieza', patient: '—', since: '09:12', acuity: '—' },
  { id: 'T-01', area: 'Trauma', type: 'Crítica', status: 'Ocupada', patient: 'Mateo Salgado', since: '08:01', acuity: 'P1' },
  { id: 'T-02', area: 'Trauma', type: 'Crítica', status: 'Libre', patient: '—', since: '—', acuity: '—' },
  { id: 'H-12', area: 'Hospitalización', type: 'Estándar', status: 'Ocupada', patient: 'Sofía Navarro', since: '06:44', acuity: 'P2' },
  { id: 'H-13', area: 'Hospitalización', type: 'Estándar', status: 'Reservada', patient: 'Jorge Mendoza', since: '—', acuity: 'P2' },
  { id: 'UCI-04', area: 'UCI', type: 'Ventilada', status: 'Ocupada', patient: 'Paciente reservado', since: 'Ayer', acuity: 'P1' },
];

export const areas = [
  { name: 'Emergencias', used: 8, total: 12, note: '2 monitorizadas libres', color: 'teal' },
  { name: 'Hospitalización', used: 31, total: 40, note: '7 camas disponibles', color: 'navy' },
  { name: 'UCI', used: 7, total: 8, note: '1 cama crítica libre', color: 'amber' },
  { name: 'Pediatría', used: 9, total: 14, note: '5 camas disponibles', color: 'blue' },
];

export const operatingRooms = [
  { id: 'QX-01', procedure: 'Colecistectomía laparoscópica', doctor: 'Dr. Bruno Leal', time: '10:30', status: 'Preparación' },
  { id: 'QX-02', procedure: '—', doctor: '—', time: '—', status: 'Disponible' },
  { id: 'QX-03', procedure: 'Artroplastia de rodilla', doctor: 'Dra. Teresa Valle', time: '13:00', status: 'Programado' },
];

export const ambulances = [
  { id: 'AMB-07', plate: 'MX-47-AC', crew: 'S. Zamora · L. Vera', status: 'En base', location: 'Base Norte', eta: '—' },
  { id: 'AMB-12', plate: 'MX-12-KL', crew: 'M. Salas · N. Gil', status: 'En ruta', location: 'Av. Reforma 224', eta: '08 min' },
  { id: 'AMB-04', plate: 'MX-04-RP', crew: 'A. Pardo · C. Soto', status: 'En traslado', location: 'Hospital Central', eta: 'Arribo 11 min' },
  { id: 'AMB-19', plate: 'MX-19-FQ', crew: 'J. Cano · E. Ruiz', status: 'Mantenimiento', location: 'Taller', eta: '—' },
];

export const staff = [
  { id: 'st-01', name: 'Elisa Montero', role: 'Urgencias', initials: 'EM', shift: '07:00 — 15:00', status: 'En turno', patients: 4 },
  { id: 'st-02', name: 'Andrés Cota', role: 'Trauma', initials: 'AC', shift: '07:00 — 19:00', status: 'En turno', patients: 3 },
  { id: 'st-03', name: 'Iván Prieto', role: 'Cirugía', initials: 'IP', shift: '09:00 — 17:00', status: 'En turno', patients: 2 },
  { id: 'st-04', name: 'Teresa Valle', role: 'Traumatología', initials: 'TV', shift: '08:00 — 16:00', status: 'En quirófano', patients: 1 },
  { id: 'st-05', name: 'Mariana Solís', role: 'Enfermería jefe', initials: 'MS', shift: '07:00 — 15:00', status: 'En turno', patients: 12 },
  { id: 'st-06', name: 'Bruno Leal', role: 'Cirugía general', initials: 'BL', shift: '10:00 — 18:00', status: 'Próximo turno', patients: 0 },
];

export const labs = [
  { id: 'LAB-7782', patient: 'Jorge Mendoza', record: 'MF-240207', study: 'Biometría hemática + Troponina', requested: '09:22', status: 'En proceso', result: '—', urgency: 'Urgente' },
  { id: 'LAB-7776', patient: 'Valentina Ríos', record: 'MF-240184', study: 'Gasometría arterial', requested: '08:56', status: 'Listo', result: 'Ver resultado', urgency: 'Urgente' },
  { id: 'LAB-7771', patient: 'Camila Torres', record: 'MF-240219', study: 'Perfil de coagulación', requested: '23:18', status: 'Listo', result: 'Ver resultado', urgency: 'Rutina' },
  { id: 'LAB-7764', patient: 'Sofía Navarro', record: 'MF-240260', study: 'Electrolitos séricos', requested: '06:45', status: 'Listo', result: 'Ver resultado', urgency: 'Urgente' },
  { id: 'LAB-7750', patient: 'Ana Lucía Peña', record: 'MF-240241', study: 'Química sanguínea', requested: '12 jun, 14:10', status: 'Validado', result: 'Ver resultado', urgency: 'Rutina' },
];

export const pharmacy = [
  { id: 'med-01', name: 'Salbutamol 100 mcg / dosis', presentation: 'Inhalador · 200 dosis', stock: 18, minimum: 10, location: 'Estante A-03', status: 'Disponible' },
  { id: 'med-02', name: 'Ceftriaxona 1 g', presentation: 'Frasco ámpula', stock: 7, minimum: 12, location: 'Refrigerador B-01', status: 'Reabastecer' },
  { id: 'med-03', name: 'Metformina 850 mg', presentation: 'Caja · 30 tabletas', stock: 46, minimum: 20, location: 'Estante C-02', status: 'Disponible' },
  { id: 'med-04', name: 'Adrenalina 1 mg/ml', presentation: 'Ampolleta · 1 ml', stock: 4, minimum: 8, location: 'Carro rojo 02', status: 'Crítico' },
  { id: 'med-05', name: 'Paracetamol 1 g IV', presentation: 'Bolsa · 100 ml', stock: 32, minimum: 15, location: 'Estante A-11', status: 'Disponible' },
];

export const workflows = [
  { id: 'wf-01', name: 'Ingreso de paciente → Triaje', source: 'Registro recepción', target: 'Cola de triaje', status: 'Activo', runs: 148, last: 'Hace 2 min' },
  { id: 'wf-02', name: 'Resultado laboratorio → Expediente', source: 'Sistema LIS', target: 'Historial clínico', status: 'Activo', runs: 87, last: 'Hace 6 min' },
  { id: 'wf-03', name: 'Cama liberada → Alertar recepción', source: 'Gestor de camas', target: 'Canal operaciones', status: 'Activo', runs: 32, last: 'Hace 18 min' },
  { id: 'wf-04', name: 'Alta → Resumen de atención', source: 'Módulo médico', target: 'Expediente + correo', status: 'Pausado', runs: 19, last: 'Ayer, 17:42' },
];

export const auditEvents = [
  { id: 'AU-9218', time: '09:42:18', actor: 'Sistema n8n', action: 'Prioridad recibida', detail: 'EP-8830 · Mateo Salgado · P2', kind: 'Integración' },
  { id: 'AU-9217', time: '09:40:05', actor: 'Mariana Solís', action: 'Cama asignada', detail: 'H-13 → Jorge Mendoza', kind: 'Operación' },
  { id: 'AU-9216', time: '09:36:44', actor: 'Recepción 02', action: 'Paciente registrado', detail: 'Mateo Salgado · MF-240234', kind: 'Acceso' },
  { id: 'AU-9215', time: '09:31:12', actor: 'Laboratorio', action: 'Resultado validado', detail: 'LAB-7776 · Gasometría arterial', kind: 'Clínico' },
  { id: 'AU-9214', time: '09:28:49', actor: 'Dra. Elisa Montero', action: 'Episodio actualizado', detail: 'EP-8821 · Observaciones médicas', kind: 'Clínico' },
  { id: 'AU-9213', time: '09:21:32', actor: 'Sistema n8n', action: 'Webhook procesado', detail: 'Resultado LIS #7781', kind: 'Integración' },
];

export const alerts = [
  { id: 'al-01', tone: 'critical', title: 'Saturación crítica', detail: 'Sofía Navarro · Cubículo E-07', time: 'Hace 4 min' },
  { id: 'al-02', tone: 'warning', title: 'Stock bajo', detail: 'Ceftriaxona 1 g · 7 unidades', time: 'Hace 12 min' },
  { id: 'al-03', tone: 'info', title: 'Ambulancia en ruta', detail: 'AMB-12 · Arribo estimado 8 min', time: 'Hace 16 min' },
];