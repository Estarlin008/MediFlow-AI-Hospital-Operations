# MediFlow AI

Interfaz de operación hospitalaria con frontend React y backend FastAPI preparado para PostgreSQL en Supabase e integración n8n.

## Run & Operate

- `pnpm --filter @workspace/mediflow-ai run dev` — run the web artifact
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run dev` — legacy Express artifact; the clinical API runs with the FastAPI commands in `artifacts/api-server/README.md`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React + Vite + Tailwind CSS
- Validation: Zod

## Where things live

- `artifacts/mediflow-ai/src/domain/contracts.ts` — contratos, catálogos y schemas de dominio.
- `artifacts/mediflow-ai/src/data/mock-data.ts` — fixtures demo normalizados.
- `artifacts/mediflow-ai/src/services/hospital.ts` — selección de adaptador por modo.
- `artifacts/mediflow-ai/src/integration/` — configuración pública y cliente HTTP n8n.
- `N8N_INTEGRATION.md` — rutas, payloads, errores y límites del MVP.

## Architecture decisions

- El modo `mock` es el valor predeterminado y no requiere URL, backend ni credenciales.
- El transporte n8n está aislado en un único cliente con timeout y validación Zod.
- Las prioridades y reglas clínicas llegan como resultado externo; el frontend no las calcula.
- Las variables `VITE_*` son públicas y nunca deben contener secretos.
- El frontend mantiene un modo `mock` seguro para demostraciones.
- El backend FastAPI es la frontera autorizada para PostgreSQL y n8n; el navegador no debe contener secretos.
- Las altas y cambios en modo demo solo viven en el estado de la sesión; no presentarlos como guardados permanentemente.

## Integraciones pendientes

- Backend y base de datos: existe una implementación FastAPI inicial y una migración de esquema; la conexión real a Supabase aún requiere secretos válidos.
- IA clínica y reconocimiento de voz: no están conectados al flujo completo; no indicar que hubo análisis clínico o transcripción real.
- n8n: la integración configurada no cubre el flujo completo; las altas de médicos, camas y áreas aún no tienen una operación de guardado.

## Product

Monitoreo operativo, pacientes, emergencias, triaje externo, recursos, automatizaciones y auditoría en una interfaz demo.

## User preferences

Sin preferencias persistentes registradas.

## Gotchas

- Para trabajar sin red usa `VITE_DATA_SOURCE=mock`.
- Para activar n8n define también `VITE_N8N_BASE_URL`; las rutas se sobreescriben con `VITE_N8N_ROUTES_JSON`.
- No agregar credenciales a variables `VITE_*`, porque quedan expuestas en el navegador.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
