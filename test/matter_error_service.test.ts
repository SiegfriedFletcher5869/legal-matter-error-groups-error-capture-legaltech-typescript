import assert from "node:assert/strict";
import test from "node:test";
import type { ExceptionPayload } from "../src/infrai_errors";
import { captureMatterFailure } from "../src/matter_error_service";

test("same delivery operation groups across matters while context stays distinct", async () => {
  const calls: Array<{ payload: ExceptionPayload; key: string }> = [];
  const client = {
    async capture(payload: ExceptionPayload, key: string) {
      calls.push({ payload, key });
      return { accepted: true };
    }
  };

  for (const matterId of ["MAT-101", "MAT-202"]) {
    await captureMatterFailure(client, {
      matterId,
      workflow: "signed_document_delivery",
      operation: "deliver_signed_engagement_letter",
      message: "Delivery failed",
      exception: "DeliveryError: portal rejected delivery",
      deliveryChannel: "client_portal"
    });
  }

  assert.deepEqual(calls[0]?.payload.fingerprint, calls[1]?.payload.fingerprint);
  assert.equal(calls[0]?.payload.context.matterId, "MAT-101");
  assert.equal(calls[1]?.payload.context.matterId, "MAT-202");
  assert.notEqual(calls[0]?.key, calls[1]?.key);
});
