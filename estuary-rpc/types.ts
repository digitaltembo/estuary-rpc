import { Duplex } from "./stream";

/**
 * Method used to communicate over HTTP. Note that WS is categorically separate from the
 * others, which are simply treated directly as their HTTP methods
 * @group Endpoint Metadata
 */
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "WS";

/**
 * All endpoints in estuary-rpc are described by a type that extends SimpleMeta, meaning
 * at the very least that the method type and url must be defined for all of them
 * @group Endpoint Metadata
 */
export interface SimpleMeta extends OpenApiMeta {
  method?: Method;
  url?: string;
  transport?: Transport<unknown, unknown>;
  authentication?: Authentication;
}

/**
 * Estuary is built around asynchronous function calls - invoking them from the
 * client and defining them on the server. Each function call has both a request
 * type and a closure value relating to the transport of the data, and returns a
 * response type. Streaming data is treated a bit differently
 * @param Req The type of the data that defines the request
 * @param Res The type of the data that defines the response
 * @param Closure In the clientside instantiation of an endpoint, the closure is used
 * to pass additional information (such as a definition of timeout to use) to estuary-rpc-client
 * (the closure here is an instance of {@link estuary-rpc-client!ClientClosure}), while on the serverside
 * the closure is used to let estuary-rpc-server pass more information to your endpoint
 * definition (the closure here is an instance of {@link estuary-rpc-server!ApiContext}). In many cases
 * this will not be necessary, but the additional level of control can be useful.
 * @group Endpoints
 */
export type EndpointFn<Req, Res, Closure> = (
  input: Req,
  closure: Closure
) => Promise<Res>;

/**
 * An Endpoint is the fundamental unit upon which all of Estuary is built,
 * being a union of {@link EndpointFn} and whatever metadata you choose to describe your endpoint with
 * @param Req The type of the data that is sent from the client
 * @param Res The type of the data that is returned from the server
 * @param Closure The type of the data that is used to communicate information about the request to
 * estuary-rpc-client or from estuary-rpc-server to the server implementation
 * @param Meta The type of the metadata that is used to describe the endpoint. This should extend
 * {@link SimpleMeta}, although for this code it is not strictly necessary
 * @group Endpoints
 */
export type Endpoint<Req, Res, Closure, Meta> = EndpointFn<Req, Res, Closure> &
  Meta;

/**
 * WebSockets transmit either binary data or strings, so a {@link StreamEndpoint} ends up encoding
 * data as a WsData - and some parts of the code rely on simply knowing that we are using the correct one
 */
export type WsData = Uint8Array | string;
/**
 * A StreamingEndpoint is a specific type of endpoint that conceptually has Request and Response types
 * (representing the type of the data that is flowing from the client and from the server respectively),
 * but instead of taking in a Response and asynchronously returning a Response, it takes in a {@link Duplex} and
 * asynchronously returns a void when the communication channel is established. The client and server code
 * is then free to write messages to and read messages from the Duplex's streams.
 * @param Req The type of individual data messages that are sent from the client
 * @param Res The type of individual data messages that are returned from the server
 * @param Closure The type of the data that is used to communicate information about the request to
 * estuary-rpc-client or from estuary-rpc-server to the server implementation
 * @group Endpoints
 */
export type StreamEndpoint<Req, Res, Closure, Meta> = Endpoint<
  Duplex<Req, Res>,
  void,
  Closure,
  Meta
>;

/**
 * An Api type is effecitvely just an arbitrarily nested set of endpoints allowing for nice organization of
 * the interface over which estuary-rpc operates. To start using estuary-rpc, you may first define
 * your own ExampleApi type extending from this Api interface, and then define an exampleApiMetaDefition
 * of type ExampleApi<unknown, CustomMeta> (without a closure as the MetaDefinition is not used as a function).
 * Alternatively, you may just define your exampleApiMetaDefinition and use type inference and {@link ApiTypeOf}
 * to deduce your API type from that. That is, you may either explicitly or implicitly extend this Api.
 * From there, on the clientside a call to {@link estuary-rpc-client!createApiClient} will create an
 * ExampleApi<{@link estuary-rpc-client!FetchOpts}, Meta>,
 * while on the serverside a call to {@link estuary-rpc-server!createApiServer} will create an
 * ExampleApi<{@link estuary-rpc-server!ApiContext}, Meta>.
 *
 * @param Closure The type of the data that is used to communicate information about the request to
 * estuary-rpc-client or from estuary-rpc-server to the server implementation. This should be kept generic
 * in your extension of the Api type, so that your Meta description
 * @param Meta The type of the metadata that is used to describe the endpoint. This should extend
 * {@link SimpleMeta}, although for this code it is not strictly necessary
 * @example
 * ```ts
 * export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
 *   foo: FooService<Closure, Meta>;
 *   fileUpload: Endpoint<void, void, Closure, Meta>;
 * }
 *
 * export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
 *   simpleGet: Endpoint<number, number, Closure, Meta>;
 *   simpleStream: StreamEndpoint<string, boolean, Closure, Meta>;
 * }
 * ```
 */
export type Api<Closure, Meta> = {
  [key: string]: Api<Closure, Meta> | Endpoint<any, any, Closure, Meta>;
};

/**
 * Given a type Closure and endpoint type T extends Endpoint<A, B, unknown, Meta>, this defines the type
 *                                                  Endpoint<A, B, Closure, Meta>
 * @example
 * ```
 * type MyEndpoint<Closure> =
 *   EndpointWithClosure<typeof get<number, number, SimpleMeta>("url"), Closure, SimpleMeta>;
 * // is equivalent to the following, despite not having direct type access to the request and response types
 * type MyEndpoint<Closure> = Endpoint<number, number, Closure, SimpleMeta>
 * ```
 */
type EndpointWithClosure<T, Closure, Meta> = T extends Endpoint<
  infer Req,
  infer Res,
  unknown,
  Meta
>
  ? Endpoint<Req, Res, Closure, Meta>
  : never;

/**
 * Estuary-RPC at some points needs a type definition for your API, and at some points needs the metadata definition
 * This type will extract the type definition with a generic closure (as client and server side type definitions use
 * separate closures).
 * @param Closure new Closure Type
 * @param Meta The type of the metadata that is used to describe the endpoint. This should extend
 * {@link SimpleMeta}, although for this code it is not strictly necessary
 * @param T The type from which to extract the ApiType
 *
 * @example
 * ```ts
 * const myApiMetadata = { foo: get<number, number, SimpleMeta>("foo")};
 * type MyApiTypeOf<Closure> = ApiTypeOf<typeof myApiMetadata>;
 * const client = createApiClient(myApiMetadata) as MyApiTypeOf<ClientClosure>;
 * ```
 *
 */
export type ApiTypeOf<Closure, Meta, T extends Api<unknown, Meta>> = {
  [Prop in keyof T]: T[Prop] extends (...args: any) => any
    ? EndpointWithClosure<T[Prop], Closure, Meta>
    : ApiTypeOf<
        Closure,
        Meta,
        // Given T extends Api<unknown, Meta> and T[Prop] ! extends () => any, it MUST be the case
        // that T[Prop] extends Api<unknown, Meta> as well... not sure why typescript doesn't know this
        T[Prop] extends Api<unknown, Meta> ? T[Prop] : never
      >;
};

/**
 * The TransportType enum is used in the {@link Transport} object as the distinguishing factor
 * between different possible transports used to communicate the data
 * @group Endpoint Metadata
 * @category Transport
 */
export enum TransportType {
  /** See {@link JsonTransport} */
  JSON,
  /** See {@link UrlFormTransport} */
  URL_FORM_DATA,
  /** See {@link MultipartFormTransport} */
  MULTIPART_FORM_DATA,
  /** See {@link UnknownBinaryTransport} and {@link UknownStringTransport} */
  UNKNOWN,
}

/** Default query parameter key used for non-object request transmission
 * @group Endpoint Metadata
 * @category Transport
 */
export const URL_FORM_DATA_KEY = "_es_data";

/**
 * JSON transport is the default {@link Transport} for all methods except GET. For a Streaming WS connection,
 * it implies encoding the request/response data as JSON strings and transmitting them as text
 * packets, for regular HTTP connections it implies sending application/json data in the request body
 * @group Endpoint Metadata
 * @category Transport
 */
export type JsonTransport = { transportType: TransportType.JSON };

/**
 * UrlFormTransport is a {@link Transport} that will encode request values in the queryString, by
 * default encoding the values in the request object in JSON. If the request is of a primitive
 * non-object type, it will be encoded with the {@link URL_FORM_DATA_KEY} - that is, a request
 * of \{"foo": "bar"\} will become `?foo=%20bar%20`, but a request of "foo" will become
 * `?_es_data=%20foo%20`. If you don't want JSON-encoded values, set rawStrings
 * to true. Default transport used with the "GET" method
 * @group Endpoint Metadata
 * @category Transport
 */
export type UrlFormTransport = {
  transportType: TransportType.URL_FORM_DATA;
  /** set rawStrings to not JSON-encode values in the request object - is not necessarily typesafe! */
  rawStrings?: boolean;
};
/**
 * The MultipartFormTransport is a {@link Transport} that will encode request values in
 * multipart/form-data, and should be used for any file transmission. Note that file
 * transmission is a bit of a special case, with the representation of the data not possible to be the same.
 * On the frontend, a file is of File type, an instance of Blob, which does not exist in Node. For this purpose
 * it is advised to describe a file part of a Request object as of {@link CommonFile} type, and cast it as a File
 * on the frontend and a {@link SimpleFile} on the backend.
 * Like {@link UrlFormTransport}, if the request is of a primitive non-object type, it will be encoded as a value
 * in a field of name "_es_data"
 * @group Endpoint Metadata
 * @category Transport
 */
export type MultipartFormTransport = {
  transportType: TransportType.MULTIPART_FORM_DATA;
  /** If this is true, the server will write incoming data to a temporary file instead of trying to store it
   * in a string - meaning that this should be used for large files, and potentially for binary files */
  persist?: boolean;
  /** Like {@link UrlFormTransport}, by default this encodes non-file values as JSON objects - but unlike url-form
   * encoding where the URL ends up a bit ugly, there are not many downsides to this fact. Nevertheless, you
   * may pass rawStrings: true to skip the JSON encoding.
   */
  rawStrings?: boolean;
};

/**
 * Build your own {@link Transport}! Must provide definitions for encoding and decoding the Req and Res types
 * to Uint8Array.
 * @group Endpoint Metadata
 * @category Transport
 */
export type UnknownBinaryTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: true;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};
/**
 * Build your own {@link Transport}! Must provide definitions for encoding and decoding the Req and Res types
 * to string.
 * @group Endpoint Metadata
 * @category Transport
 */
export type UknownStringTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: false | undefined;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};

/**
 * Interface for defining methods for encoding values to a given type. See also {@link Decoder}
 * @param Req Request type that needs encoding
 * @param Res Response type that needs encoding
 * @group Endpoint Metadata
 * @category Transport
 */
export interface Encoder<Req, Res, EncodedType> {
  req: (req: Req) => EncodedType;
  res: (res: Res) => EncodedType;
}
/**
 * Interface for defining methods for decoding values from a given type. See also {@link Encoder}
 * @param Req Request type that needs encoding
 * @param Res Response type that needs encoding
 * @group Endpoint Metadata
 * @category Transport
 */
export interface Decoder<Req, Res, EncodedType> {
  req: (data: EncodedType) => Req;
  res: (data: EncodedType) => Res;
}

/**
 * All endpoints must have associated metadata that either explicitly or implicitly defines the
 * manner in which the request and response data is encoded for network communication between the
 * client and the server - and this is the type of that metadata
 * @group Endpoint Metadata
 * @category Transport
 */
export type Transport<Req, Res> =
  | JsonTransport
  | UrlFormTransport
  | MultipartFormTransport
  | UnknownBinaryTransport<Req, Res>
  | UknownStringTransport<Req, Res>;

/**
 * Metadata used in the generation of OpenAPI spec via the {@link createOpenApiSpec} method. This is
 * part of the {@link SimpleMeta} interface which can be a part of your Endpoint definitions
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export interface OpenApiMeta {
  /** Summary text for describing the endpoint */
  summary?: string;
  /** Detailed description text for the endpoint */
  description?: string;
  /** Example (request) => response pair. estuary-rpc will use this both as the appropriate example
   * fields within the OpenApi spec and will dynamically analyze the types to form a guess at what
   * their description should be
   */
  example?: [reqBody: unknown, resBody: unknown];
  /** Schema definition for the Request object, overriding a guess formed in the example if provided.
   * If the endpoint uses {@link UrlFormTransport}, this will be converted into the appropriate property list
   */
  reqSchema?: Schema;
  /** Schema definition for the Request object, overriding a guess formed in the example if provided */
  resSchema?: Schema;
  /** Generic swagger JSON to extend the endpoint definition with, overriding everything else from this
   * endpoint definition.
   * [Allowable fields defined here.](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#schemaObject)
   */
  swagger?: Record<string, unknown>;
}
/**
 * The Schema type defines the type of Schema that OpenApi expects if you want
 * to use the {@link createOpenApiSpec} method and be very precise about the types in use
 * (see {@link OpenApiMeta} for other manners of accomplishing this goal).
 * All types may have an `id` defined, which is used to extract out common types across the
 * entire API.
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export type Schema =
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | ArraySchema
  | ObjectSchema;
/**
 * {@link Schema} of a boolean type
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export type BooleanSchema = {
  type: "boolean";
  id?: string;
  example?: boolean;
};
/**
 * {@link Schema} of a numeric type
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export type NumberSchema = {
  type: "number";
  id?: string;
  example?: number;
  /** minimum value of the number, used only for OpenAPI documentation */
  minimum?: number;
  /** maximum value of the number, used only for OpenAPI documentation */
  maximum?: number;
  /** List of allowable values, used only for OpenAPI documentation */
  enum?: number[];
};
/**
 * {@link Schema} of a string type
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export type StringSchema = {
  type: "string";
  format?: "binary";
  id?: string;
  example?: string;
  enum?: string[];
};
/**
 * {@link Schema} of an Array type
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export type ArraySchema = {
  type: "array";
  id?: string;
  /** Type of the values in the array - OpenAPI does not support multiple array types */
  items?: Schema;
  /** Minimum number of items, used only for OpenAPI documentation */
  minItems?: number;
  /** Maximum number of items, used only for OpenAPI documentation */
  maxItems?: number;
};
/**
 * {@link Schema} of an Object type
 * @group Endpoint Metadata
 * @category OpenAPI
 */
export type ObjectSchema = {
  type: "object";
  id?: string;
  /** nesting of types within the object */
  properties?: { [key: string]: Schema };
};

/**
 * Authentication is used in two different ways: on one hand, it is used as the metadata describing an endpoint,
 * telling the server that it should enforce a type of authentication on the endpoint. On the other hand, an
 * object of type Authentication is passed by the client representing the secret the client wants to use,
 * estuary-rpc-client encodes that Authentication, estuary-rpc-server decodes that Authentication, and that object
 * is then passed to a function that is passed through the {@link estuary-rpc-server!ServerOpts} to
 * {@link estuary-rpc-server!createApiServer} on the serverside.
 *
 * Meaning basically that in the Metadata use case, the usernames/passwords/secrets need to have defined string values,
 * but nothing actually happens with those, you can leave them as an empty string - but on the serverside you
 * should define the `authenticate` function that takes in a populated Authentication object
 * @group Authentication
 */
export type Authentication = (
  | BasicAuth
  | BearerAuth
  | HeaderAuth
  | QueryAuth
  | CookieAuth
) & {
  /** All Authentications can be associated with a list of scopes. This might be used to mark an endpoint as needing
   * superuser access, or similar authentication blocks
   */
  scopes?: string[];
};

/**
 * {@link Authentication} that is encoded for HTTP Basic Auth, that is by first encoding
 * `${username}:${password} into Base64, and then passing the header
 * `Authentication: Basic <Base64 Encoding>` to the server
 * Not possible for WebSocket authentication from the browser, due to browser WebSocket connections not being
 * able to pass arbitrary headers
 * @group Authentication
 */
export type BasicAuth = {
  type: "basic";
  username?: string;
  password?: string;
};
/**
 * {@link Authentication} that is encoded for HTTP Bearer Auth, that is by passing the header
 * `Authentication: Bearer <token>`
 * to the server. This is most commonly used for [JWT](https://jwt.io/)-based authentication
 * Not possible for WebSocket authentication from the browser, due to browser WebSocket connections not being
 * able to pass arbitrary headers
 * @group Authentication
 */
export type BearerAuth = {
  type: "bearer";
  token?: string;
};

/**
 * {@link Authentication} that gets encoded into an arbitrary cookie.
 * Not possible for WebSocket authentication from the browser, due to browser WebSocket connections not being
 * able to pass arbitrary headers.
 * `{type:"header", keyPair: ["X-My-Auth", "My Secret"]}` would be encoded as the header value
 * ```
 * X-My-Auth:My Secret
 * ```
 * @group Authentication
 */
export type HeaderAuth = {
  type: "header";
  keyPair: [string, string] | [string];
};

/**
 * {@link Authentication} that gets encoded into an arbitrary query string
 * `{type:"header", keyPair: ["myAuth", "My Secret"]}` would be encoded as the query string ?myAuth=My Secret
 * @group Authentication
 */
export type QueryAuth = {
  type: "query";
  keyPair: [string, string] | [string];
};
/**
 * {@link Authentication} that gets encoded into an arbitrary cookie.
 * Clientside cookie management is outside of the scope of estuary-rpc, the client will assume that the
 * cookie has been correctly set and not pass additional authentication metadata. KeyPair works the same
 * as it does in {@link HeaderAuth} and {@link QueryAuth}
 * @group Authentication
 */
export type CookieAuth = {
  type: "cookie";
  keyPair: [string, string] | [string];
};

/**
 * See {@link MultipartFormTransport} - files are encoded differently on client and server, and so for
 * type compatibility across applications it is recommended to use this type.
 * @group Endpoint Metadata
 * @category Transport
 */
export type CommonFile = unknown;

/**
 * See {@link MultipartFormTransport} - this is the representation that multipart forms will take on the server
 * side
 * @group Endpoint Metadata
 * @category Transport
 */
export type SimpleFile = {
  name?: string;
  filePath?: string;
  contentType?: string;
  content: string;
};
