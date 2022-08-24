import { IncomingMessage, ServerResponse, RequestListener } from "http";
import { Duplex } from "stream";
import { Authentication, SimpleMeta } from "../common/api";

export type BaseApiContext = {
  respond: (status: number, message: string) => void;
  badRequest: (message?: string) => void;
  internalServerError: (message?: string) => void;

  authentication?: Authentication;
  req: IncomingMessage;
};

export type RestApiContext = BaseApiContext & {
  res: ServerResponse;
};
export type WsApiContext = BaseApiContext & {
  socket: Duplex;
};
export type ApiContext = RestApiContext | WsApiContext;

export type Middleware<Meta> = (
  apiContext: ApiContext,
  meta: Meta
) => Promise<boolean>;

export type RestMiddleware = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<boolean>;

// with static files, you can set things up so that
// * If a request comes in prefixed by urlRoot, or
//      a request comes in NOT prefixed by apiPrefixes
// * the static file at fileRoot/<req path without urlRoot> will be served
// * If there is no such file there, fileRoot/defaultFile will be served with HTTP CODE defaultCode
export type StaticFileOpts = {
  defaultFile?: string;
  defaultCode?: number;
  apiPrefixes?: string[];
  fileRoot?: string;
  urlRoot?: string;
};

export type ServerOpts<Meta extends SimpleMeta> = {
  port: number;
  restMiddleware?: RestMiddleware[];
  middlewares?: Middleware<Meta>[];
  // If defined, only respond to requests on the following prefixes (ignored by static definition, if provided)
  staticFiles?: StaticFileOpts;

  authenticate?: (authentication: Authentication) => boolean;
  defaultAuthentication?: Authentication;
};

export type WsListener = (request: IncomingMessage, socket: Duplex) => void;
export type RestEndpoints = { [methodId: string]: RequestListener };
export type WsEndpoints = { [methodId: string]: WsListener };
