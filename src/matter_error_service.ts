import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { ExceptionPayload } from "./infrai_errors";

export const matterFailureSchema = z.object({
  matterId: z.string().min(1),
  workflow: z.enum(["matter_intake", "signed_document_delivery", "deadline_follow_up"]),
  operation: z.string().min(1),
  message: z.string().min(1),
  exception: z.string().min(1),
  deliveryChannel: z.enum(["email", "client_portal"]).optional(),
  deadline: z.string().datetime().optional()
});

export type MatterFailure = z.infer<typeof matterFailureSchema>;

export type ErrorCapture = {
  capture(payload: ExceptionPayload, idempotencyKey: string): Promise<unknown>;
};

export function groupFingerprint(failure: MatterFailure): string[] {
  return ["legaltech", failure.workflow, failure.operation];
}

export function captureMatterFailure(client: ErrorCapture, failure: MatterFailure) {
  const eventId = randomUUID();
  const payload: ExceptionPayload = {
    title: `${failure.workflow}: ${failure.operation} failed`,
    message: failure.message,
    level: "error",
    fingerprint: groupFingerprint(failure),
    exception: failure.exception,
    context: {
      matterId: failure.matterId,
      workflow: failure.workflow,
      operation: failure.operation,
      deliveryChannel: failure.deliveryChannel,
      deadline: failure.deadline,
      eventId
    }
  };
  const idempotencyKey = createHash("sha256")
    .update(`${failure.matterId}:${failure.workflow}:${failure.operation}:${eventId}`)
    .digest("hex");
  return client.capture(payload, idempotencyKey);
}
