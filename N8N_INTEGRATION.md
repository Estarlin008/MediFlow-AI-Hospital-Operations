# MediFlow AI · contrato de integración n8n

## Alcance del MVP

MediFlow AI separa la interfaz, los servicios de dominio y el transporte HTTP.
El modo `mock` es el modo seguro por defecto y no necesita red. El adaptador
`n8n` directo del frontend se conserva como compatibilidad de demostración, pero
no debe usarse para producción: los workflows clínicos reales deben invocarse
desde FastAPI, que guarda los secretos y valida la autorización.

La integración queda preparada para que n8n entregue resultados ya calculados.
MediFlow presenta y confirma prioridades; no calcula prioridades clínicas en el
frontend y no define reglas médicas.

## Modos y configuración

Copiar `.env.example` como referencia:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `VITE_DATA_SOURCE` | No | `mock` (predeterminado) o `n8n`. Un valor desconocido vuelve a `mock`. |
| `VITE_N8N_BASE_URL` | Solo `n8n` | URL pública base de n8n, sin slash final. |
| `VITE_N8N_TIMEOUT_MS` | No | Tiempo límite de cada solicitud; predeterminado `8000`. |
| `VITE_N8N_ROUTES_JSON` | No | JSON público para sobreescribir rutas conceptuales. |

En modo mock, la ausencia de `VITE_N8N_BASE_URL` es válida y no se intenta
hacer ninguna llamada HTTP. En modo n8n, la ausencia de la base URL se reporta
como error de configuración antes de enviar la solicitud.

## Contratos conceptuales

Los contratos tipados y sus validadores están en
`artifacts/mediflow-ai/src/domain/contracts.ts`.

- `Patient`: identidad, expediente, datos demográficos y antecedentes básicos.
- `EmergencyEpisode`: motivo, signos vitales, prioridad, estado y ubicación del
  episodio; no mezcla la identidad del paciente.
- `VitalSigns`: FC, PA, SpO₂, temperatura y fecha opcional de medición.
- `TriageResult`: prioridad recibida, episodio/paciente relacionados, fuente,
  estado de confirmación y marcas de tiempo.
- `Alert`, `Bed`, `ClinicalSummary`, `CareEncounter`, `ClinicalReport`,
  `AuditEvent` y `DashboardSummary`: salidas operativas separadas y tipadas.
- Catálogos únicos: prioridades `P1`–`P4`, estados clínicos, severidades,
  estados de cama, estados de triaje y tipos de evento de auditoría.

Las respuestas n8n se validan antes de llegar a la interfaz. Una respuesta con
campos faltantes no se acepta como válida.

## Rutas por defecto

Las rutas se pueden reemplazar con `VITE_N8N_ROUTES_JSON`. Las rutas por defecto
son:

| Clave | Método | Ruta | Entrada/salida |
| --- | --- | --- | --- |
| `registerPatient` | POST | `/webhook/mediflow/patients` | `RegisterPatientInput` → `Patient` |
| `runWorkflow` | POST | `/webhook/mediflow/workflows/:workflowId/run` | `{ workflowId }` → `WorkflowRunResult` |
| `receiveExternalTriage` | POST | `/webhook/mediflow/triage/:episodeId` | `{ episodeId }` → `TriageResult` |
| `patients` | GET | `/webhook/mediflow/patients` | `Patient[]` |
| `episodes` | GET | `/webhook/mediflow/episodes` | `EmergencyEpisode[]` |
| `triageQueue` | GET | `/webhook/mediflow/triage` | `TriageResult[]` |
| `dashboard` | GET | `/webhook/mediflow/dashboard` | `DashboardSummary` |
| `alerts` | GET | `/webhook/mediflow/alerts` | `Alert[]` |
| `beds` | GET | `/webhook/mediflow/beds` | `Bed[]` |
| `clinicalSummary` | GET | `/webhook/mediflow/patients/:patientId/summary` | `ClinicalSummary` |
| `care` | GET | `/webhook/mediflow/episodes/:episodeId/care` | `CareEncounter` |
| `reports` | GET | `/webhook/mediflow/reports` | `ClinicalReport[]` |
| `audit` | GET | `/webhook/mediflow/audit` | `AuditEvent[]` |
| `system` | GET | `/webhook/mediflow/system` | `SystemStatus[]` |

Las rutas con `:patientId`, `:episodeId` y `:workflowId` se codifican antes de
ser interpoladas.

## Errores

El cliente único (`IntegrationHttpClient`) añade `Accept`,
`X-MediFlow-Client`, `Content-Type` cuando corresponde y un timeout abortable.
Clasifica los fallos como:

- `configuration`: falta una configuración pública necesaria.
- `network`: no hubo conexión o el navegador rechazó la solicitud.
- `timeout`: n8n no respondió dentro del límite.
- `authentication`: n8n devolvió HTTP 401/403.
- `server`: n8n devolvió HTTP 5xx.
- `validation`: la respuesta tiene tipos o valores inválidos.
- `incomplete`: faltan campos requeridos del contrato.

La clasificación está disponible en `IntegrationError.code` y conserva la causa
original para logging controlado. No se silencian respuestas inválidas.

## Qué sigue siendo mock

En modo `mock`, los fixtures de pacientes, episodios, triaje, camas, alertas,
resúmenes clínicos, informes, auditoría y dashboard viven en
`src/data/mock-data.ts`. Los servicios mock los clonan para evitar mutaciones
entre pantallas. La UI conserva algunas vistas demostrativas basadas en esos
fixtures mientras las siguientes tareas consumen esta frontera de servicios.

El backend FastAPI vive en `artifacts/api-server`. Su cliente n8n usa
`N8N_BASE_URL`, `N8N_AUTH_HEADER_NAME` y `N8N_AUTH_HEADER_VALUE`, que deben
permanecer fuera del frontend. Las rutas clínicas establecidas por el backend
son `/api/consultations/{id}/process-report` y
`/api/consultations/{id}/triage`; sus respuestas se validan y los resultados
confirmados se persisten en PostgreSQL.

Esto no es una integración hospitalaria real: no hay autenticación, persistencia,
autorización por rol, cifrado extremo a extremo, reconciliación con HIS/LIS,
idempotencia de webhooks, firma de mensajes ni reglas clínicas implementadas.
