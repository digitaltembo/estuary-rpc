import { IncomingMessage, ServerResponse, RequestListener } from "http";
import { Duplex } from "stream";
import { URL } from "url";
import { SimpleMeta } from "../common/api";

export type BaseApiContext = {
  respond: (status: number, message: string) => void;
  badRequest: (message?: string) => void;
  internalServerError: (message?: string) => void;
  url?: URL;
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

export type ServerOpts<Meta extends SimpleMeta> = {
  port: number;
  restMiddleware?: RestMiddleware[];
  middlewares?: Middleware<Meta>[];
  // If defined, only respond to requests on the following prefixes (ignored by static definition, if provided)
  servePrefixes?: {
    // otherwise, serve the static file at defaultFile
    defaultFile: string;
    prefixes: string[];
  };
  staticFiles?: {
    // path to the static files
    fileRoot: string;
    // url on which to serve them, defaults to /static/
    urlRoot?: string;
  };
};

export type WsListener = (request: IncomingMessage, socket: Duplex) => void;
export type RestEndpoints = { [methodId: string]: RequestListener };
export type WsEndpoints = { [methodId: string]: WsListener };
