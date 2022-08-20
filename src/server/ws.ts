import { IncomingMessage, Server } from "http";
import { Duplex } from "stream";

import {
  BiDiStream,
  Encoders,
  EndpointDescription,
  JSON_ENCODER,
  SimpleMeta,
} from "../common/api";
import {
  createErrorHandlers,
  DEFAULT_NOT_FOUND,
  errorResponse,
} from "./errors";
import { methodId } from "./middleware";
import { ApiContext, ServerOpts, WsEndpoints } from "./types";

export const WEBSOCKET_HEADER = [
  "HTTP/1.1 101 Web Socket Protocol Handshake",
  "Upgrade: WebSocket",
  "Connection: Upgrade",
  "",
  "",
].join("\r\n");

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

export function createWsServer<Meta extends SimpleMeta>(
  server: Server,
  wsEndpoints: WsEndpoints,
  serverOpts: ServerOpts<Meta>
) {
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
}
