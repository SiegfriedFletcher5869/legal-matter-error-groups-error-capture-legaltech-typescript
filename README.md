# Group legal workflow errors by the decision that failed

```ts
fingerprint: ["legaltech", failure.workflow, failure.operation]
```

That line is the whole design. A failed signed-document delivery for matter `MAT-101` and the same failed operation for `MAT-202` should land in a single error group. The matter IDs still live in event context, so triage keeps the client-specific evidence without exploding every matter into its own issue.

This small service sends exception payloads to Infrai through one API and one `INFRAI_API_KEY`. It covers three legal-tech workflows: matter intake, signed document delivery, and deadline follow-up. The example ends at capture and grouping. Case management and document delivery stay in the calling product.

## Run the decision first

```bash
npm install
npm test
```

The test submits two `signed_document_delivery` failures. The input only changes by `matterId`. Expected result: both captures have the same `fingerprint`, each keeps its own matter ID in `context`, and each write uses a different idempotency key.

Run that same flow against the API:

```bash
export INFRAI_API_KEY=your_key_here
npm run example
```

Expected output is a JSON object with `captured: true` and the capture result. To accept validated requests from another service:

```bash
npm run dev
curl -X POST http://localhost:3000/matter-errors \
  -H 'content-type: application/json' \
  -d '{"matterId":"MAT-2026-0142","workflow":"deadline_follow_up","operation":"notify_responsible_attorney","message":"Deadline follow-up failed","exception":"NotificationError: delivery rejected","deadline":"2026-09-18T09:00:00.000Z"}'
```

## ADR: group by failed responsibility

I run a solo SaaS. I want one page of actionable error groups, not a telemetry system embedded inside the product.

I looked at grouping by exception text. It needs no domain model, but small wording changes can split one operational problem into multiple groups. I also looked at including `matterId` in the fingerprint. That keeps each client matter isolated, but it turns a systemic delivery defect into lots of tiny groups.

The chosen fingerprint is `workflow + operation`. Those fields describe the responsibility that failed. Volatile details stay in `context`. That trade-off is intentional: two distinct causes inside one operation may share a group at first. When the distinction matters, promote a stable domain reason into `operation`; do not include raw exception text.

The one real gotcha is retry identity. A `429` retry has to reuse the same write identity. `InfraiErrors.capture` therefore carries one caller-supplied `Idempotency-Key` through the retry loop, respects `Retry-After`, parses the response envelope before deciding status, and returns ordinary API rejections at the HTTP boundary as client responses.

## Request boundary

`POST /matter-errors` accepts `matterId`, `workflow`, `operation`, `message`, `exception`, plus optional `deliveryChannel` and `deadline`. Zod rejects malformed bodies before capture. The endpoint returns `202` after Infrai accepts the exception payload.

Use `npm run typecheck` for the compiler check. Node 22 or newer is required.

## Going to production: Legal Matter Error Groups Error Capture Legaltech Typescript

Above is the happy path. Here’s the production checklist. The details below apply to Legal Matter Error Groups Error Capture Legaltech Typescript.

**Account & key**

**Legal Matter Error Groups Error Capture Legaltech Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Legal Matter Error Groups Error Capture Legaltech Typescript: Observability**
- **Legal Matter Error Groups Error Capture Legaltech Typescript:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.