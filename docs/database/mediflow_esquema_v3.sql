-- ============================================================
-- MediFlow IA - Esquema inicial para Supabase PostgreSQL
-- Version 3: recursos ampliados (camas, equipos, personal y areas)
-- ============================================================
-- IMPORTANTE:
-- 1) Diseñado para una instalación NUEVA, sin tablas de MediFlow.
-- 2) La validación inicial detiene el script si detecta tablas previas.
-- 3) No se crean usuarios, pacientes ni datos clínicos de prueba.
-- 4) Las transcripciones completas no se almacenan en este esquema.
-- 5) El esquema no calcula prioridades ni implementa reglas clínicas.
-- 6) Las categorías iniciales de recursos son un catálogo editable.
-- 7) RLS queda habilitado sin políticas públicas; FastAPI deberá aplicar
--    autenticación/autorización y conectarse de forma segura desde el servidor.
-- 8) No expongas credenciales de PostgreSQL ni claves privilegiadas en React.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'usuarios', 'sesiones_usuario', 'pacientes', 'tipos_recursos',
        'areas_atencion', 'recursos', 'camas', 'equipos_medicos',
        'personal_sanitario', 'consultas', 'datos_clinicos_consulta',
        'signos_vitales', 'informes_clinicos', 'evaluaciones_triaje',
        'cola_atencion', 'asignaciones_recursos', 'registros_auditoria',
        'recursos_medicos', 'asignaciones_recursos'
      )
  ) THEN
    RAISE EXCEPTION 'Ya existen tablas de MediFlow en public. Se detuvo el script para evitar mezclar esquemas. Revisa la base de datos antes de continuar.';
  END IF;
END $$;

-- 1. USUARIOS: cuentas que pueden iniciar sesión
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo VARCHAR(160) NOT NULL,
    correo_electronico VARCHAR(320) NOT NULL,
    hash_contrasena TEXT NOT NULL,
    rol VARCHAR(30) NOT NULL
      CHECK (rol IN ('ADMINISTRADOR', 'MEDICO', 'ENFERMERIA', 'RECEPCION')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_usuarios_correo_normalizado
  ON public.usuarios (LOWER(correo_electronico));
COMMENT ON TABLE public.usuarios IS 'Cuentas de acceso al sistema. El hash de la contraseña se genera en FastAPI, nunca se guarda la contraseña original.';

-- 2. SESIONES: renovación y revocación de sesiones
CREATE TABLE public.sesiones_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    hash_token_refresco TEXT NOT NULL UNIQUE,
    vence_en TIMESTAMPTZ NOT NULL,
    revocado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (vence_en > creado_en)
);
CREATE INDEX ix_sesiones_usuario_usuario_id ON public.sesiones_usuario(usuario_id);
CREATE INDEX ix_sesiones_usuario_vence_en ON public.sesiones_usuario(vence_en);

-- 3. PACIENTES: expediente administrativo
CREATE TABLE public.pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_expediente VARCHAR(80) NOT NULL UNIQUE,
    tipo_documento VARCHAR(60),
    numero_documento VARCHAR(100),
    nombre_completo VARCHAR(240) NOT NULL,
    fecha_nacimiento DATE,
    edad_referida SMALLINT,
    sexo_registrado VARCHAR(30) NOT NULL DEFAULT 'NO_ESPECIFICADO'
      CHECK (sexo_registrado IN ('FEMENINO', 'MASCULINO', 'INTERSEXUAL', 'OTRO', 'NO_ESPECIFICADO')),
    telefono_contacto VARCHAR(40),
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (edad_referida IS NULL OR edad_referida BETWEEN 0 AND 125),
    CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE)
);
CREATE INDEX ix_pacientes_nombre_normalizado ON public.pacientes (LOWER(nombre_completo));
CREATE INDEX ix_pacientes_creado_en ON public.pacientes (creado_en DESC);
CREATE UNIQUE INDEX uq_pacientes_documento_no_vacio
  ON public.pacientes (LOWER(tipo_documento), LOWER(numero_documento))
  WHERE tipo_documento IS NOT NULL AND numero_documento IS NOT NULL AND BTRIM(numero_documento) <> '';
COMMENT ON COLUMN public.pacientes.numero_expediente IS 'Identificador generado por el backend; no depende de que el usuario lo introduzca en el formulario.';

-- 4. TIPOS DE RECURSOS: catálogo extensible de clases de activos físicos
CREATE TABLE public.tipos_recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    permite_asignacion BOOLEAN NOT NULL DEFAULT TRUE,
    requiere_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos de configuración del catálogo, no son pacientes ni datos clínicos.
INSERT INTO public.tipos_recursos (codigo, nombre, descripcion, permite_asignacion, requiere_mantenimiento)
VALUES
 ('CAMA', 'Cama', 'Camas hospitalarias y camas de observación.', TRUE, FALSE),
 ('EQUIPO_MEDICO', 'Equipo médico', 'Equipos utilizados en la atención clínica.', TRUE, TRUE),
 ('EQUIPO_LABORATORIO', 'Equipo de laboratorio', 'Equipos de análisis y laboratorio clínico.', TRUE, TRUE),
 ('EQUIPO_DIAGNOSTICO', 'Equipo de diagnóstico', 'Equipos para pruebas e imágenes diagnósticas.', TRUE, TRUE),
 ('MOBILIARIO', 'Mobiliario', 'Mobiliario clínico u hospitalario inventariable.', TRUE, FALSE),
 ('OTRO', 'Otro recurso físico', 'Otros activos físicos configurados por el hospital.', TRUE, FALSE);

-- 5. AREAS DE ATENCION: ubicaciones/unidades, no activos físicos
CREATE TABLE public.areas_atencion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(80) NOT NULL UNIQUE,
    nombre VARCHAR(160) NOT NULL,
    tipo_area VARCHAR(40) NOT NULL
      CHECK (tipo_area IN ('URGENCIAS', 'LABORATORIO', 'ANALISIS_CLINICOS', 'IMAGENES', 'HOSPITALIZACION', 'UCI', 'CONSULTORIO', 'CIRUGIA', 'FARMACIA', 'OTRA')),
    area_padre_id UUID REFERENCES public.areas_atencion(id) ON DELETE RESTRICT,
    capacidad INTEGER CHECK (capacidad IS NULL OR capacidad > 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'OPERATIVA'
      CHECK (estado IN ('OPERATIVA', 'CERRADA', 'MANTENIMIENTO', 'INACTIVA')),
    descripcion TEXT,
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (area_padre_id IS NULL OR area_padre_id <> id)
);
CREATE INDEX ix_areas_atencion_tipo_estado ON public.areas_atencion(tipo_area, estado);
CREATE INDEX ix_areas_atencion_padre ON public.areas_atencion(area_padre_id);

-- 6. RECURSOS: activos físicos inventariables; equipos y camas comparten lo básico
CREATE TABLE public.recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(80) NOT NULL UNIQUE,
    tipo_recurso_id UUID NOT NULL REFERENCES public.tipos_recursos(id) ON DELETE RESTRICT,
    nombre VARCHAR(160) NOT NULL,
    descripcion TEXT,
    area_id UUID REFERENCES public.areas_atencion(id) ON DELETE RESTRICT,
    estado_operativo VARCHAR(30) NOT NULL DEFAULT 'DISPONIBLE'
      CHECK (estado_operativo IN ('DISPONIBLE', 'NO_DISPONIBLE', 'MANTENIMIENTO', 'INACTIVO')),
    observaciones TEXT,
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_recursos_tipo_estado ON public.recursos(tipo_recurso_id, estado_operativo);
CREATE INDEX ix_recursos_area ON public.recursos(area_id);
CREATE INDEX ix_recursos_nombre_normalizado ON public.recursos(LOWER(nombre));
COMMENT ON TABLE public.recursos IS 'Registro común de activos físicos. Las ubicaciones se modelan en areas_atencion y el personal en personal_sanitario.';
COMMENT ON COLUMN public.recursos.estado_operativo IS 'Estado operativo guardado. El estado ASIGNADO/EN_USO se calculará según las asignaciones activas en el backend, evitando estados contradictorios.';

-- 7. CAMAS: atributos exclusivos de las camas
CREATE TABLE public.camas (
    recurso_id UUID PRIMARY KEY REFERENCES public.recursos(id) ON DELETE RESTRICT,
    tipo_cama VARCHAR(40) NOT NULL DEFAULT 'ESTANDAR'
      CHECK (tipo_cama IN ('ESTANDAR', 'OBSERVACION', 'PEDIATRICA', 'CUIDADOS_INTENSIVOS', 'OTRA')),
    requiere_oxigeno BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones_clinicas TEXT
);

-- 8. EQUIPOS MEDICOS Y DE LABORATORIO: atributos propios del equipo
CREATE TABLE public.equipos_medicos (
    recurso_id UUID PRIMARY KEY REFERENCES public.recursos(id) ON DELETE RESTRICT,
    fabricante VARCHAR(120),
    modelo VARCHAR(120),
    numero_serie VARCHAR(160),
    fecha_adquisicion DATE,
    requiere_calibracion BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_proximo_mantenimiento DATE,
    fecha_proxima_calibracion DATE,
    observaciones_tecnicas TEXT
);
CREATE UNIQUE INDEX uq_equipos_numero_serie_no_vacio
  ON public.equipos_medicos (LOWER(numero_serie))
  WHERE numero_serie IS NOT NULL AND BTRIM(numero_serie) <> '';

-- 9. PERSONAL SANITARIO: personas y datos profesionales, separado de activos físicos
CREATE TABLE public.personal_sanitario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_personal VARCHAR(80) NOT NULL UNIQUE,
    usuario_id UUID UNIQUE REFERENCES public.usuarios(id) ON DELETE SET NULL,
    nombre_completo VARCHAR(200) NOT NULL,
    tipo_personal VARCHAR(50) NOT NULL
      CHECK (tipo_personal IN ('MEDICO', 'ENFERMERIA', 'AUXILIAR_ENFERMERIA', 'TECNICO', 'LABORATORISTA', 'RADIOLOGIA', 'OTRO')),
    especialidad VARCHAR(120),
    area_id UUID REFERENCES public.areas_atencion(id) ON DELETE SET NULL,
    turno VARCHAR(80),
    estado_laboral VARCHAR(30) NOT NULL DEFAULT 'ACTIVO'
      CHECK (estado_laboral IN ('ACTIVO', 'FUERA_DE_TURNO', 'LICENCIA', 'INACTIVO')),
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_personal_tipo_estado ON public.personal_sanitario(tipo_personal, estado_laboral);
CREATE INDEX ix_personal_area ON public.personal_sanitario(area_id);
COMMENT ON TABLE public.personal_sanitario IS 'Perfiles profesionales, como médicos, enfermeras, auxiliares y técnicos. No se trata como equipo físico.';
COMMENT ON COLUMN public.personal_sanitario.usuario_id IS 'Enlace opcional a la cuenta de acceso; registrar una persona no crea automáticamente un usuario.';

-- 10. CONSULTAS: episodios de atención
CREATE TABLE public.consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    profesional_responsable_id UUID REFERENCES public.personal_sanitario(id) ON DELETE SET NULL,
    area_id UUID REFERENCES public.areas_atencion(id) ON DELETE RESTRICT,
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_CURSO'
      CHECK (estado IN ('BORRADOR', 'EN_CURSO', 'PENDIENTE_REVISION', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA')),
    motivo_consulta TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmado_en TIMESTAMPTZ
);
CREATE INDEX ix_consultas_paciente ON public.consultas(paciente_id);
CREATE INDEX ix_consultas_profesional ON public.consultas(profesional_responsable_id);
CREATE INDEX ix_consultas_area_estado ON public.consultas(area_id, estado);
CREATE INDEX ix_consultas_estado_fecha ON public.consultas(estado, creado_en DESC);

-- 11. DATOS CLINICOS ESTRUCTURADOS: no guardar la transcripción íntegra
CREATE TABLE public.datos_clinicos_consulta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL UNIQUE REFERENCES public.consultas(id) ON DELETE CASCADE,
    tiempo_evolucion TEXT,
    sintomas_y_relato TEXT NOT NULL,
    antecedentes_relevantes TEXT,
    alergias_informadas TEXT,
    medicamentos_actuales TEXT,
    otros_datos JSONB NOT NULL DEFAULT '{}'::JSONB,
    idioma VARCHAR(10) NOT NULL DEFAULT 'es',
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(otros_datos) = 'object')
);

-- 12. SIGNOS VITALES: puede haber múltiples mediciones por consulta
CREATE TABLE public.signos_vitales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas(id) ON DELETE CASCADE,
    registrado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    presion_sistolica SMALLINT,
    presion_diastolica SMALLINT,
    frecuencia_cardiaca NUMERIC(7,2),
    frecuencia_respiratoria NUMERIC(7,2),
    temperatura_c NUMERIC(5,2),
    saturacion_oxigeno NUMERIC(5,2),
    peso_kg NUMERIC(7,2),
    estatura_cm NUMERIC(6,2),
    estado_conciencia VARCHAR(60),
    observacion_inicial TEXT,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (presion_sistolica IS NULL OR presion_sistolica > 0),
    CHECK (presion_diastolica IS NULL OR presion_diastolica > 0),
    CHECK (frecuencia_cardiaca IS NULL OR frecuencia_cardiaca >= 0),
    CHECK (frecuencia_respiratoria IS NULL OR frecuencia_respiratoria >= 0),
    CHECK (temperatura_c IS NULL OR temperatura_c >= 0),
    CHECK (saturacion_oxigeno IS NULL OR saturacion_oxigeno BETWEEN 0 AND 100),
    CHECK (peso_kg IS NULL OR peso_kg > 0),
    CHECK (estatura_cm IS NULL OR estatura_cm > 0)
);
CREATE INDEX ix_signos_vitales_consulta_fecha ON public.signos_vitales(consulta_id, registrado_en DESC);

-- 13. INFORMES CLINICOS: historial de versiones y revisión profesional
CREATE TABLE public.informes_clinicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL CHECK (version > 0),
    datos_informe JSONB NOT NULL CHECK (jsonb_typeof(datos_informe) = 'object'),
    estado_revision VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_REVISION'
      CHECK (estado_revision IN ('BORRADOR', 'PENDIENTE_REVISION', 'CONFIRMADO', 'RECHAZADO')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    confirmado_en TIMESTAMPTZ,
    UNIQUE (consulta_id, version)
);
CREATE INDEX ix_informes_consulta_version ON public.informes_clinicos(consulta_id, version DESC);
CREATE INDEX ix_informes_estado ON public.informes_clinicos(estado_revision);

-- 14. EVALUACIONES DE TRIAJE: almacena resultados futuros del workflow
CREATE TABLE public.evaluaciones_triaje (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas(id) ON DELETE RESTRICT,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
      CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'REQUIERE_REVISION', 'FALLIDO')),
    prioridad VARCHAR(35)
      CHECK (prioridad IS NULL OR prioridad IN ('P1', 'P2', 'P3', 'P4', 'INFORMACION_INSUFICIENTE')),
    alertas_rojas_detectadas BOOLEAN NOT NULL DEFAULT FALSE,
    alertas_rojas JSONB NOT NULL DEFAULT '[]'::JSONB,
    sintomas_relevantes JSONB NOT NULL DEFAULT '[]'::JSONB,
    informacion_faltante JSONB NOT NULL DEFAULT '[]'::JSONB,
    motivo TEXT,
    revisado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    revisado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(alertas_rojas) IN ('array', 'object')),
    CHECK (jsonb_typeof(sintomas_relevantes) IN ('array', 'object')),
    CHECK (jsonb_typeof(informacion_faltante) IN ('array', 'object'))
);
CREATE INDEX ix_triaje_consulta_fecha ON public.evaluaciones_triaje(consulta_id, creado_en DESC);
CREATE INDEX ix_triaje_prioridad ON public.evaluaciones_triaje(prioridad);
CREATE INDEX ix_triaje_estado ON public.evaluaciones_triaje(estado);
COMMENT ON TABLE public.evaluaciones_triaje IS 'La tabla almacena resultados cuando n8n se haya migrado, afinado y validado. No calcula prioridades clínicas.';

-- 15. COLA DE ATENCION
CREATE TABLE public.cola_atencion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas(id) ON DELETE RESTRICT,
    prioridad VARCHAR(35)
      CHECK (prioridad IS NULL OR prioridad IN ('P1', 'P2', 'P3', 'P4', 'INFORMACION_INSUFICIENTE')),
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_ESPERA'
      CHECK (estado IN ('EN_ESPERA', 'LLAMADO', 'EN_ATENCION', 'COMPLETADO', 'CANCELADO')),
    ingresado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    llamado_en TIMESTAMPTZ,
    finalizado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_cola_estado_prioridad_fecha ON public.cola_atencion(estado, prioridad, ingresado_en);
CREATE UNIQUE INDEX uq_cola_consulta_activa ON public.cola_atencion(consulta_id)
  WHERE estado IN ('EN_ESPERA', 'LLAMADO', 'EN_ATENCION');

-- 16. ASIGNACIONES DE ACTIVOS FISICOS A CONSULTAS (no personal ni áreas)
CREATE TABLE public.asignaciones_recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurso_id UUID NOT NULL REFERENCES public.recursos(id) ON DELETE RESTRICT,
    consulta_id UUID NOT NULL REFERENCES public.consultas(id) ON DELETE RESTRICT,
    asignado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    liberado_en TIMESTAMPTZ,
    CHECK (liberado_en IS NULL OR liberado_en >= asignado_en)
);
CREATE INDEX ix_asignaciones_recurso_fecha ON public.asignaciones_recursos(recurso_id, asignado_en DESC);
CREATE INDEX ix_asignaciones_consulta ON public.asignaciones_recursos(consulta_id);
CREATE UNIQUE INDEX uq_recurso_una_asignacion_activa ON public.asignaciones_recursos(recurso_id)
  WHERE liberado_en IS NULL;

CREATE OR REPLACE FUNCTION public.mediflow_validar_asignacion_recurso()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_estado VARCHAR(30);
    v_permite BOOLEAN;
BEGIN
    IF NEW.liberado_en IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT r.estado_operativo, t.permite_asignacion
      INTO v_estado, v_permite
      FROM public.recursos r
      JOIN public.tipos_recursos t ON t.id = r.tipo_recurso_id
     WHERE r.id = NEW.recurso_id
     FOR UPDATE OF r;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El recurso indicado no existe.';
    END IF;
    IF NOT v_permite THEN
        RAISE EXCEPTION 'Este tipo de recurso no permite asignación a consultas.';
    END IF;
    IF v_estado IN ('NO_DISPONIBLE', 'MANTENIMIENTO', 'INACTIVO') THEN
        RAISE EXCEPTION 'No se puede asignar un recurso no disponible, en mantenimiento o inactivo.';
    END IF;

    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_asignacion_recurso
BEFORE INSERT OR UPDATE OF recurso_id, liberado_en
ON public.asignaciones_recursos
FOR EACH ROW EXECUTE FUNCTION public.mediflow_validar_asignacion_recurso();
COMMENT ON TABLE public.asignaciones_recursos IS 'Asignaciones de camas/equipos/activos a consultas. Las asignaciones de personal se gestionan por su vínculo profesional con la consulta.';

-- 17. REGISTROS DE AUDITORIA
CREATE TABLE public.registros_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    tipo_entidad VARCHAR(80) NOT NULL,
    entidad_id UUID,
    metadatos JSONB NOT NULL DEFAULT '{}'::JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(metadatos) = 'object')
);
CREATE INDEX ix_auditoria_usuario_fecha ON public.registros_auditoria(usuario_id, creado_en DESC);
CREATE INDEX ix_auditoria_entidad_fecha ON public.registros_auditoria(tipo_entidad, entidad_id, creado_en DESC);
COMMENT ON TABLE public.registros_auditoria IS 'No registrar contraseñas, tokens, transcripciones ni contenido clínico sensible en los metadatos.';

-- Verificar que los detalles correspondan al tipo de recurso declarado.
CREATE OR REPLACE FUNCTION public.mediflow_validar_tipo_detalle_recurso()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_codigo VARCHAR(50);
BEGIN
    SELECT t.codigo INTO v_codigo
      FROM public.recursos r
      JOIN public.tipos_recursos t ON t.id = r.tipo_recurso_id
     WHERE r.id = NEW.recurso_id;

    IF NOT FOUND OR NOT (v_codigo = ANY(string_to_array(TG_ARGV[0], ','))) THEN
        RAISE EXCEPTION 'El tipo del recurso no coincide con el detalle específico registrado.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_detalle_cama
BEFORE INSERT OR UPDATE OF recurso_id ON public.camas
FOR EACH ROW EXECUTE FUNCTION public.mediflow_validar_tipo_detalle_recurso('CAMA');
CREATE TRIGGER trg_validar_detalle_equipo
BEFORE INSERT OR UPDATE OF recurso_id ON public.equipos_medicos
FOR EACH ROW EXECUTE FUNCTION public.mediflow_validar_tipo_detalle_recurso('EQUIPO_MEDICO,EQUIPO_LABORATORIO,EQUIPO_DIAGNOSTICO');

-- Actualización automática de fechas de modificación.
CREATE OR REPLACE FUNCTION public.mediflow_actualizar_fecha_modificacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_usuarios_actualizado_en BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_tipos_recursos_actualizado_en BEFORE UPDATE ON public.tipos_recursos
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_areas_atencion_actualizado_en BEFORE UPDATE ON public.areas_atencion
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_recursos_actualizado_en BEFORE UPDATE ON public.recursos
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_personal_actualizado_en BEFORE UPDATE ON public.personal_sanitario
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_pacientes_actualizado_en BEFORE UPDATE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_consultas_actualizado_en BEFORE UPDATE ON public.consultas
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();
CREATE TRIGGER trg_datos_clinicos_actualizado_en BEFORE UPDATE ON public.datos_clinicos_consulta
FOR EACH ROW EXECUTE FUNCTION public.mediflow_actualizar_fecha_modificacion();

-- Habilitar RLS sin abrir acceso por la API pública de Supabase.
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos_medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_sanitario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datos_clinicos_consulta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signos_vitales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informes_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_triaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cola_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_auditoria ENABLE ROW LEVEL SECURITY;

COMMIT;

-- VERIFICACION POSTERIOR (ejecutar solo despues de crear el esquema):
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'usuarios', 'sesiones_usuario', 'pacientes', 'tipos_recursos',
--     'areas_atencion', 'recursos', 'camas', 'equipos_medicos',
--     'personal_sanitario', 'consultas', 'datos_clinicos_consulta',
--     'signos_vitales', 'informes_clinicos', 'evaluaciones_triaje',
--     'cola_atencion', 'asignaciones_recursos', 'registros_auditoria'
--   )
-- ORDER BY table_name;
