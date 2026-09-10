import { z } from 'zod';

import { integrationConfig } from './config';

export type IntegrationErrorCode =
  | 'configuration'
  | 'network'
  | 'timeout'
  | 'validation'
  | 'incomplete'
  | 'authentication'
  | 'server';

export class IntegrationError extends Error {
  readonly name = 'IntegrationError';

  constructor(
    message: string,
    readonly code: IntegrationErrorCode,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type IntegrationRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

function extractServerMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) return payload.trim().slice(0, 240);
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error', 'title']) {
      if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
    }
  }
  return 'El servicio de integración rechazó la solicitud.';
}

function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return Promise.resolve(null);
  const contentType = response.headers.get('content-type') ?? '';
  return response.text().then((text) => {
    if (!text.trim()) return null;
    if (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  });
}

function classifyValidationError(error: z.ZodError): IntegrationError {
  const incomplete = error.issues.some(
    (issue) => issue.code === 'invalid_type' && issue.received === 'undefined',
  );
  return new IntegrationError(
    incomplete
      ? 'La respuesta de n8n está incompleta y no cumple el contrato esperado.'
      : 'La respuesta de n8n tiene datos inválidos.',
    incomplete ? 'incomplete' : 'validation',
    undefined,
    error,
  );
}

export class IntegrationHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl = integrationConfig.n8nBaseUrl, timeoutMs = integrationConfig.requestTimeoutMs) {
    if (!baseUrl) {
      throw new IntegrationError(
        'VITE_N8N_BASE_URL es obligatorio cuando VITE_DATA_SOURCE=n8n.',
        'configuration',
      );
    }
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: IntegrationRequest = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          'X-MediFlow-Client': 'mediflow-ai',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
      });
      const payload = await parseResponseBody(response);

      if (!response.ok) {
        const code: IntegrationErrorCode =
          response.status === 401 || response.status === 403
            ? 'authentication'
            : response.status >= 500
              ? 'server'
              : 'validation';
        throw new IntegrationError(
          extractServerMessage(payload),
          code,
          response.status,
          payload,
        );
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw classifyValidationError(parsed.error);
      return parsed.data;
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      if (isAbortError(error)) {
        throw new IntegrationError(
          `La solicitud a n8n superó el tiempo límite de ${this.timeoutMs} ms.`,
          'timeout',
          undefined,
          error,
        );
      }
      throw new IntegrationError(
        'No fue posible conectar con n8n. Verifica la URL pública y la disponibilidad del workflow.',
        'network',
        undefined,
        error,
      );
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
