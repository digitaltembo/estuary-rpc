import { Duplex } from "./stream";
import { SimpleMeta, Method, TransportType, Endpoint } from "./types";
export * from "./types";
export * from "./stream";
export * from "./openApi";
export * from "./statusCodes";

/**
 * Curried method to generate an {@link Endpoint} from a url, a {@link Transport}, and opts (extendible, but
 * at least {@link SimpleMeta}
 * @param method REST or WS method for communicating wth server
 * @returns Endpoint definition
 * @group Endpoint Metadata
 * @category Metadata Definition
 */
function endpoint<Req, Res, Meta extends SimpleMeta>(method: Method) {
  return (
    url: string,
    defaultTransport: TransportType.JSON | TransportType.URL_FORM_DATA,
    opts?: Omit<Meta, "method" | "url">
  ): Endpoint<Req, Res, unknown, Meta> => {
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
/**
 * Describes a HTTP GET request with {@link UrlFormTransport} encoding unless overridden by opts
 * @param url URL at which the endpoint is accessed
 * @param opts Additional metadata
 * @returns Endpoint definition
 * @group Endpoint Metadata
 * @category Metadata Definition
 */
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
/**
 * Describes a HTTP POST request with {@link JsonTransport} encoding unless overridden by opts
 * @param url URL at which the endpoint is accessed
 * @param opts Additional metadata
 * @returns Endpoint definition
 * @group Endpoint Metadata
 * @category Metadata Definition
 */
export function post<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("POST")(url, TransportType.JSON, opts);
}

/**
 * Describes a HTTP PUT request with {@link JsonTransport} encoding unless overridden by opts
 * @param url URL at which the endpoint is accessed
 * @param opts Additional metadata
 * @returns Endpoint definition
 * @group Endpoint Metadata
 * @category Metadata Definition
 */
export function put<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("PUT")(url, TransportType.JSON, opts);
}
/**
 * Describes a HTTP DELETE request with {@link JsonTransport} encoding unless overridden by opts
 * @param url URL at which the endpoint is accessed
 * @param opts Additional metadata
 * @returns Endpoint definition
 * @group Endpoint Metadata
 * @category Metadata Definition
 */
export function del<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("DELETE")(url, TransportType.JSON, opts);
}

/**
 * Describes a WebSocket connection with {@link JsonTransport} encoding of Req and Res objects
 * over a {@link Duplex} stream.
 * @param url URL at which the endpoint is accessed
 * @param opts Additional metadata
 * @returns Endpoint definition
 * @group Endpoint Metadata
 * @category Metadata Definition
 */
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
