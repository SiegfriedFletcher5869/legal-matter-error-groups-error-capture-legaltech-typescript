import { errorsCapture } from "./infrai_errors";
import { captureMatterFailure } from "./matter_error_service";

const result = await captureMatterFailure({ capture: errorsCapture }, {
  matterId: "MAT-2026-0142",
  workflow: "signed_document_delivery",
  operation: "deliver_signed_engagement_letter",
  message: "Signed engagement letter delivery failed",
  exception: "DeliveryError: client portal delivery was rejected",
  deliveryChannel: "client_portal"
});

console.log(JSON.stringify({ captured: true, result }, null, 2));
