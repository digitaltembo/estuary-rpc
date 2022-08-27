import { IncomingMessage, ServerResponse, RequestListener } from "http";
import { Duplex } from "stream";

import { Authentication, SimpleMeta } from "estuary-rpc";

/**
 * Base of the "Closure" value passed to all endpoint definitions, providing additional context about the caller
 * @group Server
 */
export type BaseApiContext = {
  /** Helper function for responding with arbitrary messages and statuses (status ignored for WS comms) */
  respond: (status: number, message: string) => void;
  /** Helper function for responding with a standardized BAD_REQUEST object with a default message */
  badRequest: (message?: string) => void;
  /** Helper function for responding with a standardized INTERNAL_SERVER_ERROR object with a default message */
  internalServerError: (message?: string) => void;
  /** Parsed authentication data sent with the request */
  authentication?: Authentication;
  /** The raw underlying http IncomingMessage */
  req: IncomingMessage;
};

/**
 * All REST calls will additionall get a ServerResponse object, should they choose to use it
 * @group Server */
export type RestApiContext = BaseApiContext & {
  res: ServerResponse;
};
/**
 * All WS calls will additionally get a Duplex represnting the stream to the client.
 * Note that this is NOT the same type as {@link estuary-rpc!Duplex}
 * @group Server
 */
export type WsApiContext = BaseApiContext & {
  socket: Duplex;
};
/** "Closure" value passed to all endpoint definitions providing additional context about the caller @group Server */
export type ApiContext = RestApiContext | WsApiContext;

/**
 * Middleware type to be executed immediately before endpoint execution
 * @param apiContext IncomingMessage from 'http'
 * @param meta ServerResponse from 'http'
 * @returns Promise<boolean> which, if it resolves to false, the endpoint processing does not continue
 * (In that case, the middleware should take care of responding to the client )
 * @group Server
 */
export type Middleware<Meta> = (
  apiContext: ApiContext,
  meta: Meta
) => Promise<boolean>;

/**
 * Middleware type to be executed before endpoint execution on all incoming messages
 * @param req IncomingMessage from 'http'
 * @param res ServerResponse from 'http'
 * @returns Promise<boolean> which, if it resolves to false, the endpoint processing does not continue
 * (In that case, the middleware should take care of responding to the client )
 * @group Server
 */
export type RestMiddleware = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<boolean>;

/**
 * With StaticFileOpts, you can set up things such that
 * 1. If a request comes in prefixed by urlRoot, oa request comes in NOT prefixed by apiPrefixes
 * 2. the static file at fileRoot/<req path without urlRoot> will be served
 * 3. If there is no such file there, fileRoot/defaultFile will be served with HTTP CODE defaultCode
 *
 * It is not a particularly efficient file server, but it should do the job in a pinch
 * @group Server
 */
export type StaticFileOpts = {
  /**
   * File to serve if no static file exists at the expected path, specified as relative to the file root
   * @defaultValue "404.html"
   */
  defaultFile?: string;
  /**
   * {@link estuary-rpc!HTTP_STATUS_CODES | HTTP Status Code} to respond with when no file found
   * @defaultValue 404 (Not Found)
   */
  defaultCode?: number;
  /**
   * prefixes that should be served by the object returned from {@link createApiServer} instead of a static file
   * server
   */
  apiPrefixes?: string[];
  /**
   * Root from which to look for static files
   * @defaultValue "./static/"
   */
  fileRoot?: string;
  /**
   * Root of requests that will result in static files being served
   * @defaultValue ""
   */
  urlRoot?: string;
};

/**
 * Options passed to {@link createApiServer} for running your server
 * @params Meta The custom Metadata type
 * @group Server
 */
export type ServerOpts<Meta extends SimpleMeta> = {
  /** Port number your server is bound to */
  port: number;
  /** Middlewares to execute before executing REST endpoints, using only data available in the IncomingMessage */
  restMiddleware?: RestMiddleware[];
  /** Midlewares to execute while executing all endpoints, using a complet {@link ApiContext} and Metadata definition */
  middlewares?: Middleware<Meta>[];
  /** See {@link StaticFileOpts} for usage around serving staticfiles in common patterns */
  staticFiles?: StaticFileOpts;
  /** Method to take in authentication data and return whether the user is allowed */
  authenticate?: (authentication: Authentication) => boolean;
  /**
   * Default Authentication metadata (as in, if \{type: "bearer", token: ""\} is provided, estuary-rpc-server
   * will attempt to extract a bearer token from all requests, and only allow requests to complete if that token
   * results in the authenticate method passes, or unless the metadata specifically assigns authentication for
   * a given endpoint to null)
   * */
  defaultAuthentication?: Authentication;
};

/** Simple callback type for defining a WebSocket endpoint @group Server */
export type WsListener = (request: IncomingMessage, socket: Duplex) => void;
/** Collection of REST endpoints defined as simple callbacks @group Server */
export type RestEndpoints = { [methodId: string]: RequestListener };
/** Collection of WebSocket endpoints defined as simple callbacks @group Server */
export type WsEndpoints = { [methodId: string]: WsListener };
