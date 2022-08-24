import { Duplex } from "./stream";

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
// files passed from client are Blob types, which doesn't exist on the serverside
// files interpretted on the server are Simplefiles
export type CommonBlob = unknown;

export type SimpleFile = {
  name?: string;
  contentType?: string;
  content: string;
};

// If encoding a non-object in url_form_data, give it a name
export const URL_FORM_DATA_KEY = "_es_data";

// Default transport used
export type JsonTransport = { transportType: TransportType.JSON };

// Encode request values in the queryString, with most values still JSON encoded and put there
export type UrlFormTransport = {
  transportType: TransportType.URL_FORM_DATA;
  // set this to true to treat it as a Record<string, string> instead of trying to parse as JSON
  rawStrings?: boolean;
};
// Encode request values in multipart/form-data, should be used for any file transmission
export type MultipartFormTransport = {
  transportType: TransportType.MULTIPART_FORM_DATA;
  // set true to persist data to disk instead of just parsing it after the fact
  persist?: boolean;
  // set this to true to treat it as a Record<string, string> instead of trying to parse as JSON
  rawStrings?: boolean;
};
// Build your own Transport! Must provide definitions for encoding and decoding the Req and Res types
// to Uint8Array.
export type UnknownBinaryTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: true;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};
// Build your own Transport! Must provide definitions for encoding and decoding the Req and Res types
// to string.
export type UknownStringTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: false | undefined;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};

export type Transport<Req, Res> =
  | JsonTransport
  | UrlFormTransport // Req must be something like <Record, unknown>
  | MultipartFormTransport // Req must be something like Record<string, string | CommonBlob>
  | UnknownBinaryTransport<Req, Res>
  | UknownStringTransport<Req, Res>;

type BooleanSchema = {
  type: "boolean";
  id?: string;
  example?: boolean;
};
type NumberSchema = {
  type: "number";
  id?: string;
  example?: number;
  minimum?: number;
  maximum?: number;
  enum?: number[];
};
type StringSchema = {
  type: "string";
  format?: "binary";
  id?: string;
  example?: string;
  enum?: string[];
};
type ArraySchema = {
  type: "array";
  id?: string;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
};
type ObjectSchema = {
  type: "object";
  id?: string;
  properties?: { [key: string]: Schema };
};

export type Schema =
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | ArraySchema
  | ObjectSchema;

export type BasicAuth = {
  type: "basic";
  username: string;
  password: string;
};
export type BearerAuth = {
  type: "bearer";
  token: string;
};

export type HeaderAuth = {
  type: "header";
  keyPair: [string, string] | [string];
};
export type QueryAuth = {
  type: "query";
  keyPair: [string, string] | [string];
};
export type CookieAuth = {
  type: "cookie";
  keyPair: [string, string] | [string];
};
export type Authentication = (
  | BasicAuth
  | BearerAuth
  | HeaderAuth
  | QueryAuth
  | CookieAuth
) & {
  scopes?: string[];
};

export interface SimpleMeta {
  method: Method;
  url: string;
  transport?: Transport<unknown, unknown>;
  authentication?: Authentication;

  // Used for OpenAPI docs
  example?: [reqBody: unknown, resBody: unknown];
  reqSchema?: Schema;
  resSchema?: Schema;
  summary?: string;
  description?: string;
  swagger?: Record<string, unknown>;
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
