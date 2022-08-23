import { Duplex } from "./stream";
import {
  SimpleMeta,
  Method,
  TransportType,
  EndpointDescription,
} from "./types";
export * from "./types";
export * from "./stream";
export * from "./openApi";

export * as HTTP_STATUS_CODES from "./statusCodes";

function endpoint<Req, Res, Meta extends SimpleMeta>(method: Method) {
  return (
    url: string,
    defaultTransport: TransportType.JSON | TransportType.URL_FORM_DATA,
    opts?: Omit<Meta, "method" | "url">
  ): EndpointDescription<Req, Res, unknown, Meta> => {
    return Object.assign(
      async () => Promise.reject(new Error("Invalid Usage")),
      {
        method,
        url,
        // default to encoding every request/response with JSON
        transport: { transportType: defaultTransport },
        ...opts,
      } as Meta
    );
  };
}

export function get<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("GET")(
    url,
    TransportType.URL_FORM_DATA,
    opts
  );
}
export function post<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("POST")(url, TransportType.JSON, opts);
}
export function put<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("PUT")(url, TransportType.JSON, opts);
}
export function del<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("DELETE")(url, TransportType.JSON, opts);
}
export function ws<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Duplex<Req, Res>, void, Meta>("WS")(
    url,
    TransportType.JSON,
    opts
  );
}
