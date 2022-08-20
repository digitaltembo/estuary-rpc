import {
  IncomingMessage,
  RequestListener,
  ServerResponse,
  createServer,
} from "http";

import {
  Api,
  Encoders,
  EndpointDescription,
  JSON_ENCODER,
  SimpleMeta,
  BiDiStream,
} from "estuary-rpc";
import { Duplex } from "stream";
import path from "path";
import fs from "fs/promises";

export const HTTP_STATUS_CODES = {
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  CONTENT_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_CONTENT: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
};

export const DEFAULT_BAD_REQUEST = "Bad Request";
export const DEFAULT_INTERNAL_SERVER_ERROR = "Internal Server Error";
export const DEFAULT_NOT_FOUND = "Page Not Found";

const WEBSOCKET_HEADER = [
  "HTTP/1.1 101 Web Socket Protocol Handshake",
  "Upgrade: WebSocket",
  "Connection: Upgrade",
  "",
  "",
].join("\r\n");

export type ErrorResponse = {
  status: "error";
  message: string;
};

export function errorResponse(message: string) {
  return JSON.stringify({
    status: "error",
    message,
  });
}
export type BaseApiContext = {
  respond: (status: number, message: string) => void;
  badRequest: (message?: string) => void;
  internalServerError: (message?: string) => void;

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

type WSListener = (request: IncomingMessage, socket: Duplex) => void;
type FlatApi = [
  { [methodId: string]: RequestListener },
  { [methodId: string]: WSListener }
];

function createErrorHandlers(
  respond: (status: number, message?: string) => void
) {
  return {
    badRequest: (message?: string) =>
      respond(400, errorResponse(message || DEFAULT_BAD_REQUEST)),
    internalServerError: (message?: string) =>
      respond(500, errorResponse(message ?? DEFAULT_INTERNAL_SERVER_ERROR)),
  };
}

const restResponse =
  (res: ServerResponse) => (status: number, message?: string) => {
    res
      .writeHead(status, {
        "Content-Length": Buffer.byteLength(message ?? ""),
        "Content-Type": "application/json",
      })
      .end(message);
  };

export function restEndpoint<Req, Res, Meta extends SimpleMeta>(
  endpoint: EndpointDescription<Req, Res, ApiContext, unknown>,
  meta: Meta,
  serverOpts: ServerOpts<Meta>
) {
  const encoders = (meta.encoders as Encoders<Req, Res>) ?? {
    isBinary: false,
    rest: JSON_ENCODER,
  };
  return async (req: IncomingMessage, res: ServerResponse) => {
    const respond = restResponse(res);
    const success = (response?: Res) =>
      response == null
        ? res.writeHead(HTTP_STATUS_CODES.NO_CONTENT).end()
        : respond(HTTP_STATUS_CODES.OK, encoders.rest?.fromRes(response));
    const { badRequest, internalServerError } = createErrorHandlers(respond);

    try {
      const body: Req = await new Promise<string>((resolve, reject) => {
        let body = "";
        req.on("data", (chunk: string) => {
          body += chunk;
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
      }).then((bodyStr: string) => {
        if (bodyStr === undefined || bodyStr === "") {
          return undefined;
        }
        if (encoders.rest) {
          return encoders.rest.toReq(bodyStr) as Req;
        }
        throw new Error("TODO needs encoder");
      });
      const apiContext: ApiContext = {
        badRequest,
        internalServerError,
        respond,
        req,
        res,
      };

      if (serverOpts.middlewares) {
        for (const middleware of serverOpts.middlewares) {
          if (!(await middleware(apiContext, meta))) {
            return;
          }
        }
      }
      await endpoint(body, apiContext)
        .then(success)
        .catch((error) => {
          internalServerError();
        });
    } catch (err) {
      internalServerError(err.message);
      return;
    }
  };
}

export function wsEndpoint<Req, Res, Meta extends SimpleMeta>(
  endpoint: EndpointDescription<
    BiDiStream<Req, Res>,
    void,
    ApiContext,
    unknown
  >,
  meta: Meta,
  serverOpts: ServerOpts<Meta>
) {
  const encoders = (meta.encoders as Encoders<Req, Res>) ?? {
    isBinary: false,
    ws: JSON_ENCODER,
  };

  return async (request: IncomingMessage, socket: Duplex) => {
    const bidi = new BiDiStream<Req, Res>();
    const client = bidi.client;

    socket.on("data", async (rawMessage: Buffer) => {
      client.write(encoders.ws?.toReq(rawMessage.toString()) as Req);
    });
    socket.on("close", client.close);
    socket.on("error", client.error);

    client.addListener({
      onMessage: (res: Res) => {
        socket.write(encoders.ws.fromRes(res));
      },
      onError: (error) => {
        console.error(error.message);
        internalServerError(error.message);
        socket.end();
      },
      onClose: socket.end,
    });
    const respond = (_: number, message: string) => {
      socket.write(message);
    };
    const { badRequest, internalServerError } = createErrorHandlers(respond);

    bidi.closeClient();
    const apiContext = {
      respond,
      badRequest,
      internalServerError,
      req: request,
      socket,
    };

    if (serverOpts.middlewares) {
      for (const middleware of serverOpts.middlewares) {
        if (!(await middleware(apiContext, meta))) {
          return;
        }
      }
    }
    endpoint(bidi, apiContext);
  };
}

function methodId(meta: { method: string; url: string }) {
  return `${meta.method}:${meta.url}`;
}

function flattenApi<Meta extends SimpleMeta>(
  api: Api<ApiContext, unknown>,
  apiMeta: Api<unknown, Meta>,
  serverOpts: ServerOpts<Meta>
): FlatApi {
  const restEndpoints: { [methodId: string]: RequestListener } = {};
  const wsEndpoints: { [methodId: string]: WSListener } = {};

  Object.keys(apiMeta).forEach((apiName: string) => {
    if (typeof apiMeta[apiName] === "function") {
      const meta = apiMeta[apiName] as Meta;
      const endpoint = api[apiName];
      if (meta.method === "WS") {
        wsEndpoints[methodId(meta)] = wsEndpoint(
          api[apiName] as EndpointDescription<
            BiDiStream<unknown, unknown>,
            void,
            ApiContext,
            unknown
          >,
          meta,
          serverOpts
        );
      } else {
        restEndpoints[methodId(meta)] = restEndpoint(
          api[apiName] as EndpointDescription<
            unknown,
            unknown,
            ApiContext,
            unknown
          >,
          meta,
          serverOpts
        );
      }
    } else {
      const [childRest, childWs] = flattenApi(
        api[apiName] as Api<ApiContext, unknown>,
        apiMeta[apiName] as Api<unknown, Meta>,
        serverOpts
      );
      Object.assign(restEndpoints, childRest);
      Object.assign(wsEndpoints, childWs);
    }
  });
  return [restEndpoints, wsEndpoints];
}

const MIME_TYPES = {
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".jpeg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

export const serveStatic = async (
  _: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  notFoundPath?: string
) => {
  const extname = String(path.extname(filePath)).toLowerCase();

  const contentType = MIME_TYPES[extname] ?? "application/octet-stream";

  fs.readFile(filePath)
    .then((content) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    })
    .catch((error) => {
      if (error.code === "ENOENT") {
        const emptyNotFound = () => {
          res.writeHead(HTTP_STATUS_CODES.NOT_FOUND, {
            "Content-Type": "application/json",
          });
          res.end(errorResponse(DEFAULT_NOT_FOUND), "utf-8");
        };
        if (notFoundPath) {
          fs.readFile(notFoundPath)
            .then((content) => {
              res.writeHead(HTTP_STATUS_CODES.NOT_FOUND, {
                "Content-Type": "text/html",
              });
              res.end(content, "utf-8");
            })
            .catch(emptyNotFound);
        } else {
          emptyNotFound();
        }
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(errorResponse(DEFAULT_INTERNAL_SERVER_ERROR), "utf-8");
      }
    });
};
export const staticFileMiddleware =
  (fileRoot: string = ".", urlRoot: string = "/static/") =>
  async (req: IncomingMessage, res: ServerResponse) => {
    const filePath = path.join(fileRoot, req.url.slice(urlRoot.length));
    if (!req.url.startsWith(urlRoot)) {
      return true;
    }

    await serveStatic(req, res, filePath, path.join(fileRoot, "404.html"));
    return false;
  };

export const prefixFilterMiddleware =
  (defaultFile: string, ...prefixes: string[]) =>
  async (req: IncomingMessage, res: ServerResponse) => {
    if (prefixes.some((prefix) => req.url.startsWith(prefix))) {
      return true;
    }
    await serveStatic(req, res, defaultFile);
    return false;
  };

export function createApiServer<Meta extends SimpleMeta>(
  api: Api<ApiContext, unknown>,
  description: Api<unknown, Meta>,
  serverOpts: ServerOpts<Meta>
) {
  const [restEndpoints, wsEndpoints] = flattenApi(api, description, serverOpts);

  const restMiddleware = [
    ...(serverOpts.staticFiles
      ? [
          staticFileMiddleware(
            serverOpts.staticFiles.fileRoot,
            serverOpts.staticFiles.urlRoot
          ),
        ]
      : []),
    ...(serverOpts.servePrefixes
      ? [
          prefixFilterMiddleware(
            serverOpts.servePrefixes.defaultFile,
            ...serverOpts.servePrefixes.prefixes
          ),
        ]
      : []),
    ...(serverOpts.restMiddleware || []),
  ];
  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const incomingMethodId = methodId({
        method: req.method,
        url: req.url.slice(1),
      });

      for (const middleware of restMiddleware) {
        if (!(await middleware(req, res))) {
          return;
        }
      }
      const endpoint = restEndpoints[incomingMethodId];
      if (endpoint) {
        endpoint(req, res);
      } else {
        restResponse(res)(
          HTTP_STATUS_CODES.NOT_FOUND,
          errorResponse(DEFAULT_NOT_FOUND)
        );
      }
    }
  );

  server.on("upgrade", (req, socket: Duplex) => {
    socket.write(WEBSOCKET_HEADER);

    const endpoint =
      wsEndpoints[methodId({ method: req.method, url: req.url })];
    if (endpoint) {
      endpoint(req, socket);
    } else {
      socket.write(errorResponse(DEFAULT_NOT_FOUND));
      socket.end();
    }
  });

  server.listen(serverOpts.port);
  console.log("Listening on :", serverOpts.port);
}
