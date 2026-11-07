import { createServer } from "node:http";
import { ZodError } from "zod";
import { errorsCapture, InfraiError } from "./infrai_errors";
import { captureMatterFailure, matterFailureSchema } from "./matter_error_service";

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/matter-errors") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const failure = matterFailureSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await captureMatterFailure({ capture: errorsCapture }, failure);
    send(response, 202, { captured: true, result });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid matter failure", details: error.message });
      return;
    }
    if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message
      });
      return;
    }
    send(response, 502, { error: "Error capture did not complete" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Matter error intake listening on http://localhost:${port}`));
