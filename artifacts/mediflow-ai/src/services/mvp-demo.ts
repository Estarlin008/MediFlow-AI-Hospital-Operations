import type { IntakeForm, MvpEpisode, MvpPatient } from '@/mvp/types';

let demoSequence = 1;

function currentTime() {
  return new Date().toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function createDemoRegistration(form: IntakeForm): {
  patient: MvpPatient;
  episode: MvpEpisode;
} {
  const suffix = String(demoSequence++).padStart(3, '0');
  const patientId = `demo-patient-${suffix}`;
  const episodeId = `demo-episode-${suffix}`;
  const time = currentTime();
  const age = form.age.trim() ? Number(form.age) : null;
  const allergyList = form.allergies
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    patient: {
      id: patientId,
      record: `MF-DEMO-${suffix}`,
      name: form.name.trim(),
      age,
      sex: form.sex,
      blood: 'No registrado',
      allergies: allergyList,
      chronic: form.relevantHistory.trim()
        ? [form.relevantHistory.trim()]
        : [],
      medications: [],
      status: 'En espera',
      lastVisit: `Hoy, ${time}`,
      phone: form.phone.trim() || 'No registrado',
      identityType: form.identityType,
      identityNumber: form.identityNumber.trim() || undefined,
      birthDate: form.birthDate || undefined,
      relevantHistory: form.relevantHistory.trim() || undefined,
    },
    episode: {
      id: episodeId,
      patientId,
      reason: form.reason.trim(),
      symptoms: form.symptoms.trim(),
      duration: form.duration.trim() || undefined,
      vitals: {
        fc: form.heartRate.trim() ? Number(form.heartRate) : undefined,
        pa: form.bloodPressure.trim() || undefined,
        spo2: form.oxygenSaturation.trim() ? Number(form.oxygenSaturation) : undefined,
        temp: form.temperature.trim() ? Number(form.temperature) : undefined,
        respiratoryRate: form.respiratoryRate.trim()
          ? Number(form.respiratoryRate)
          : undefined,
        consciousness: form.consciousness || undefined,
        recordedAt: new Date().toISOString(),
      },
      priority: null,
      status: 'En espera',
      area: 'Por asignar',
      doctor: 'Sin asignar',
      bed: 'Sin asignar',
      wait: '00 min',
      observations: form.symptoms.trim(),
      createdAt: time,
      needsReassessment: false,
      prioritySource: undefined,
      triageStatus: 'No disponible',
    },
  };
}
