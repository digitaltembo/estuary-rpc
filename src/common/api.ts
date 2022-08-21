import { Duplex } from "./stream";
export * from "./stream";
export * as HTTP_STATUS_CODES from "./statusCodes";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "WS";

export interface Encoder<Req, Res, EncodedType> {
  req: (req: Req) => EncodedType;
  res: (res: Res) => EncodedType;
}
export interface Decoder<Req, Res, EncodedType> {
  req: (data: EncodedType) => Req;
  res: (data: EncodedType) => Res;
}

export enum TransportType {
  JSON,
  URL_FORM_DATA,
  MULTIPART_FORM_DATA,
  UNKNOWN,
}
export type JsonTransport = { transportType: TransportType.JSON };
export type UrlFormTransport = { transportType: TransportType.URL_FORM_DATA };
export type UnknownBinaryTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: true;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};
export type UknownStringTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: false | undefined;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};

export type Transport<Req, Res> =
  | JsonTransport
  | UrlFormTransport
  | UnknownBinaryTransport<Req, Res>
  | UknownStringTransport<Req, Res>;

export interface SimpleMeta {
  method: Method;
  url: string;
  transport: Transport<unknown, unknown>;
}

// An Endpoint is the method implementation of a particular call
export type Endpoint<Req, Res, Closure> = (
  input: Req,
  closure: Closure
) => Promise<Res>;
// An EndpointDescription contains both the method implementation and the metadata around a particular endpoint
export type EndpointDescription<Req, Res, Closure, Meta> = Endpoint<
  Req,
  Res,
  Closure
> &
  Meta;
export type EndDesc<Req, Res, Closure, Meta> = EndpointDescription<
  Req,
  Res,
  Closure,
  Meta
>;

export type WsData = Uint8Array | string;
export type StreamEndpointDescription<Req, Res, Closure, Meta> =
  EndpointDescription<Duplex<Req, Res>, void, Closure, Meta>;
export type StreamDesc<Req, Res, Closure, Meta> = StreamEndpointDescription<
  Req,
  Res,
  Closure,
  Meta
>;

export interface Api<Closure, Meta> {
  [key: string]:
    | Api<Closure, Meta>
    | EndpointDescription<any, any, Closure, Meta>;
}

function endpoint<Req, Res, Meta extends SimpleMeta>(method: Method) {
  return (
    url: string,
    opts?: Omit<Meta, "method" | "url">
  ): EndpointDescription<Req, Res, unknown, Meta> => {
    return Object.assign(
      async () => Promise.reject(new Error("Invalid Usage")),
      {
        method,
        url,
        // default to encoding every request/response with JSON
        transport: { transportType: TransportType.JSON },
        ...opts,
      } as Meta
    );
  };
}

export function get<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("GET")(url, opts);
}
export function post<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("POST")(url, opts);
}
export function put<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("PUT")(url, opts);
}
export function del<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Req, Res, Meta>("DELETE")(url, opts);
}
export function ws<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return endpoint<Duplex<Req, Res>, void, Meta>("WS")(url, opts);
}
