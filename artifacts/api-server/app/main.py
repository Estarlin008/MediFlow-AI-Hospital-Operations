import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api import auth, consultations, operations, patients, queue, resources
from app.api.resources import assignments_router
from app.core.config import get_settings
from app.db.session import engine

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("mediflow.api")

app = FastAPI(
    title="MediFlow API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)


@app.middleware("http")
async def request_safety_and_logging(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > 1_000_000:
        return JSONResponse(status_code=413, content={"detail": "Request body is too large."})
    response = await call_next(request)
    logger.info("request completed method=%s status=%s", request.method, response.status_code)
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, _exc: RequestValidationError):
    # Do not echo submitted names, symptoms, transcripts, or other PHI in 422 responses.
    return JSONResponse(
        status_code=422,
        content={"detail": "Request validation failed.", "errors": [
            {"location": [str(part) for part in error.get("loc", ())], "type": error.get("type", "value_error")}
            for error in _exc.errors()
        ]},
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(_request: Request, exc: SQLAlchemyError):
    logger.error("database operation failed type=%s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "A database operation failed."})


@app.get("/api/healthz", tags=["health"])
def healthz():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.warning("health check database unavailable")
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})
    return {"status": "ok", "database": "ok"}


for route_module in (auth, patients, consultations, queue, resources, operations):
    app.include_router(route_module.router, prefix="/api")
app.include_router(assignments_router, prefix="/api")
