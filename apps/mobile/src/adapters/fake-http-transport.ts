import type { HttpRequest, HttpTransport } from "../services/api/http-transport";

export type FakeAnswer = Response | "network-error" | "never";

export interface FakeHttpTransport {
  readonly transport: HttpTransport;
  /** Answers in order; when the queue is empty, every request fails as without network. */
  enqueue(...answers: readonly FakeAnswer[]): void;
  requests(): readonly HttpRequest[];
}

const JSON_TYPE = "application/json";

/** A JSON answer as the API sends it. */
export function jsonAnswer(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? JSON_TYPE : "application/problem+json", ...headers },
  });
}

export function emptyAnswer(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

function never(signal: AbortSignal): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      reject(new Error("aborted"));
    });
  });
}

/** Test double of the transport: a queue of answers and the requests it got. */
export function createFakeHttpTransport(): FakeHttpTransport {
  const queue = { value: [] as readonly FakeAnswer[] };
  const sent = { value: [] as readonly HttpRequest[] };
  return {
    transport: (request) => {
      sent.value = [...sent.value, request];
      const [answer = "network-error", ...rest] = queue.value;
      queue.value = rest;
      if (answer === "network-error") return Promise.reject(new Error("network down"));
      if (answer === "never") return never(request.signal);
      return Promise.resolve(answer);
    },
    enqueue: (...answers) => {
      queue.value = [...queue.value, ...answers];
    },
    requests: () => sent.value,
  };
}
