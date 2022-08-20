import { BiDiStream } from "./stream";
export * from "../common/stream";
export * from "../common/statusCodes";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "WS";

export interface Encoder<Req, Res, EncodedType> {
  fromReq: (req: Req) => EncodedType;
  toReq: (data: EncodedType) => Req;
  fromRes: (res: Res) => EncodedType;
  toRes: (data: EncodedType) => Res;
}

export interface Encoders<Req, Res> {
  isBinary: boolean;
  ws?: Encoder<Req, Res, WsData>;
  rest?: Encoder<Req, Res, string>;
}

export const JSON_ENCODER: Encoder<unknown, unknown, string> = {
  fromReq: (req: unknown) => JSON.stringify(req),
  toReq: (data: unknown) => JSON.parse(data as string),
  fromRes: (res: unknown) => JSON.stringify(res),
  toRes: (data: unknown) => JSON.parse(data as string),
};

export interface SimpleMeta {
  method: Method;
  url: string;
  uploads?: string[];
  encoders?: Encoders<unknown, unknown>;
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
  EndpointDescription<BiDiStream<Req, Res>, void, Closure, Meta>;
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

function describeEndpoint<Req, Res, Meta extends SimpleMeta>(
  meta: Meta
): EndpointDescription<Req, Res, unknown, Meta> {
  return Object.assign(
    async () => Promise.reject(new Error("Invalid Usage")),
    meta
  );
}

function rest<Req, Res, Meta extends SimpleMeta>(method: Method) {
  return (url: string, opts?: Omit<Meta, "method" | "url">) =>
    describeEndpoint<Req, Res, Meta>({ method, url, ...opts } as Meta);
}

export function get<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return rest<Req, Res, Meta>("GET")(url, opts);
}
export function post<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return rest<Req, Res, Meta>("POST")(url, opts);
}
export function put<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return rest<Req, Res, Meta>("PUT")(url, opts);
}
export function del<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return rest<Req, Res, Meta>("DELETE")(url, opts);
}
export function ws<Req, Res, Meta extends SimpleMeta>(
  url: string,
  opts?: Omit<Meta, "method" | "url">
) {
  return rest<BiDiStream<Req, Res>, void, Meta>("WS")(url, opts);
}
