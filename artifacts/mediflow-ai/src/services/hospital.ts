import { integrationConfig } from '@/integration/config';
import { createMockHospitalService, systemServices } from './mock-hospital';
import { createN8nHospitalService, type HospitalService } from './hospital-service';

export const hospitalService: HospitalService =
  integrationConfig.dataSource === 'n8n'
    ? createN8nHospitalService()
    : createMockHospitalService();

export { systemServices };

export const registerPatient = (input: Parameters<HospitalService['registerPatient']>[0]) =>
  hospitalService.registerPatient(input);
export const runWorkflow = (workflowId: string) => hospitalService.runWorkflow(workflowId);
export const receiveExternalTriage = (episodeId: string) =>
  hospitalService.receiveExternalTriage({ episodeId });
