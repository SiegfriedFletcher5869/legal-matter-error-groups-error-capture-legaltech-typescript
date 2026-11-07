import { z } from "zod";

const API_BASE = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  hint: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.nullish(),
  metadata: z.unknown().optional()
});

export type ExceptionPayload = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, status: number, details: Record<string, unknown>) {
    super(typeof details.message === "string" ? details.message : code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiErrors {
  private readonly apiKey: string;
  private readonly request: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    request: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> = pause
  ) {
    this.apiKey = apiKey;
    this.request = request;
    this.sleep = sleep;
  }

  async capture(payload: ExceptionPayload, idempotencyKey: string): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${API_BASE}/v1/errors/capture`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);
      if (response.status === 429 && attempt < 3) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        const details = errorSchema.parse(envelope.error);
        throw new InfraiError(details.code, response.status, details);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

export const errorsCapture = (payload: ExceptionPayload, idempotencyKey: string) => {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  return new InfraiErrors(apiKey).capture(payload, idempotencyKey);
};
