# MediFlow API

Backend FastAPI para MediFlow IA. La aplicación usa PostgreSQL administrado por
Supabase a través de `DATABASE_URL`; el navegador no se conecta directamente a
Supabase ni contiene secretos de base de datos o n8n.

## Desarrollo local

Desde la raíz del repositorio:

```powershell
uv sync
$env:PYTHONPATH = "artifacts/api-server"
uv run --directory artifacts/api-server alembic upgrade head
uv run --directory artifacts/api-server uvicorn app.main:app --reload --port 8000
```

Configura las variables de `artifacts/api-server/.env.example` en el entorno
del backend. `DATABASE_URL` debe ser la cadena PostgreSQL copiada del proyecto
correcto de Supabase; no la guardes en Git ni la imprimas en logs.

Para crear el primer usuario administrador:

```powershell
$env:PYTHONPATH = "artifacts/api-server"
uv run --directory artifacts/api-server python -m app.cli create-user `
  --email admin@example.com --full-name "Administrador inicial" --role ADMIN
```

El comando solicita la contraseña de forma interactiva y no crea credenciales
predeterminadas.

## Estado de verificación

- La migración inicial `20261015_0001` crea el esquema MediFlow completo y fue
  validada generando SQL PostgreSQL offline.
- La importación de FastAPI y el registro de rutas se verifican sin conectar a
  una base real.
- La conexión real con Supabase y las llamadas reales a n8n quedan pendientes
  hasta configurar secretos válidos del entorno.
