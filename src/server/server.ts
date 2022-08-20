import {
  IncomingMessage,
  RequestListener,
  ServerResponse,
  createServer,
} from "http";
import WebSocket, { Server as WebSocketServer } from "ws";

import {
  Api,
  Encoders,
  EndpointDescription,
  JSON_ENCODER,
  SimpleMeta,
} from "../common/api";
import HTTP_STATUS_CODES from "../common/statusCodes";
import Stream, { BiDiStream } from "../common/stream";

export * from "../common/stream";
export * from "../common/statusCodes";
export * from "../common/api";

export const DEFAULT_BAD_REQUEST = "Bad Request";
export const DEFAULT_INTERNAL_SERVER_ERROR = "Internal Server Error";
export const DEFAULT_NOT_FOUND = "Page Not Found";

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
  ws: WebSocket;
};
export type ApiContext = RestApiContext | WsApiContext;

export type Middleware<Meta> = (
  apiContext: ApiContext,
  meta: Meta
) => Promise<boolean>;
export type ServerOpts<Meta extends SimpleMeta> = {
  port: number;
  middlewares?: Middleware<Meta>[];
};

function createErrorHandlers(
  respond: (status: number, message?: string) => void
) {
  return {
    badRequest: (message?: string) =>
      respond(
        HTTP_STATUS_CODES.BAD_REQUEST,
        errorResponse(message || DEFAULT_BAD_REQUEST)
      ),
    internalServerError: (message?: string) =>
      respond(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        errorResponse(message ?? DEFAULT_INTERNAL_SERVER_ERROR)
      ),
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

    const body: Req = await new Promise<string>((resolve, reject) => {
      let body = "";
      req.on("readable", (chunk: string) => {
        body += chunk;
      });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    }).then((bodyStr: string) => {
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

  return async (socket: WebSocket, request: IncomingMessage) => {
    const bidi = new BiDiStream<Req, Res>();
    const client = bidi.client;

    socket.on("message", async (rawMessage: WebSocket.Data) => {
      client.write(encoders.ws?.toReq(rawMessage) as Req);
    });
    socket.on("close", client.close);
    socket.on("error", client.error);

    client.addListener({
      onMessage: (res: Res) => {
        socket.send(encoders.ws.fromRes(res));
      },
      onError: (error) => {
        console.error(error.message);
        internalServerError(error.message);
        socket.close();
      },
      onClose: socket.close,
    });
    const respond = (_: number, message: string) => {
      socket.send(message);
    };
    const { badRequest, internalServerError } = createErrorHandlers(respond);

    bidi.closeClient();
    const apiContext = {
      respond,
      badRequest,
      internalServerError,
      req: request,
      ws: socket,
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
type WSListener = (socket: WebSocket, request: IncomingMessage) => void;
type FlatApi = [
  { [methodId: string]: RequestListener },
  { [methodId: string]: WSListener }
];

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
      const [childRest, childWs] = flattenApi(api, apiMeta, serverOpts);
      Object.assign(childRest, restEndpoints);
    }
  });
  return [restEndpoints, wsEndpoints];
}

export function createApiServer<Meta extends SimpleMeta>(
  api: Api<ApiContext, unknown>,
  description: Api<unknown, Meta>,
  serverOpts: ServerOpts<Meta>
) {
  const [restEndpoints, wsEndpoints] = flattenApi(api, description, serverOpts);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const endpoint =
      restEndpoints[methodId({ method: req.method, url: req.url })];
    if (endpoint) {
      endpoint(req, res);
    } else {
      restResponse(res)(
        HTTP_STATUS_CODES.NOT_FOUND,
        errorResponse(DEFAULT_NOT_FOUND)
      );
    }
  });

  const ws = new WebSocketServer(server);
  ws.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const endpoint =
      wsEndpoints[methodId({ method: req.method, url: req.url })];
    if (endpoint) {
      endpoint(ws, req);
    } else {
      ws.write(errorResponse(DEFAULT_NOT_FOUND));
      ws.close();
    }
  });

  server.listen(serverOpts.port);
}
