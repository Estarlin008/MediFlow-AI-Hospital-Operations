# MediFlow AI

MediFlow AI is a hospital operations interface for patient intake, emergency
episodes, triage results, resources, and operational audit events. The repository
contains a React/Vite frontend and a FastAPI backend prepared for PostgreSQL on
Supabase and synchronous n8n workflows.

## Run

```bash
pnpm --filter @workspace/mediflow-ai run dev
```

The default frontend mode is `mock`; it does not require a backend,
`VITE_N8N_BASE_URL`, or credentials. For repository-wide checks:

```bash
pnpm --filter @workspace/mediflow-ai run typecheck
pnpm --filter @workspace/mediflow-ai run build
```

See [N8N_INTEGRATION.md](./N8N_INTEGRATION.md) for the integration contract,
configuration, routes, and limitations.

## Architecture

- `src/domain/contracts.ts` is the source of truth for typed clinical and
  operational contracts, catalog values, visual labels, and response schemas.
- `src/data/mock-data.ts` contains normalized, reusable demo fixtures.
- `src/services/hospital-service.ts` defines the domain service boundary and the
  n8n adapter.
- `src/services/mock-hospital.ts` provides the no-network demo adapter.
- `src/services/hospital.ts` selects the adapter from `VITE_DATA_SOURCE`.
- `src/integration/http-client.ts` is the only n8n transport client. Components
  do not call `fetch` or know n8n URLs.

The default frontend data source remains a demonstration mode. The backend is
the only component intended to access clinical PostgreSQL data or call n8n. The
application does not make clinical decisions, replace a hospital information
system, or claim a live hospital integration until those external services are
configured and verified.
