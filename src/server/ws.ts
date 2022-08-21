import { IncomingMessage, Server } from "http";
import { Duplex } from "stream";
import { createHash } from "crypto";
import { TextDecoder } from "util";

import {
  BiDiStream,
  Encoders,
  EndpointDescription,
  JSON_ENCODER,
  SimpleMeta,
  WsData,
} from "../common/api";
import {
  createErrorHandlers,
  DEFAULT_NOT_FOUND,
  errorResponse,
} from "./errors";
import { methodId } from "./middleware";
import { ApiContext, ServerOpts, WsEndpoints } from "./types";
import {
  parseDataFrame,
  sendBinaryFrame,
  sendCloseFrame,
  sendPongFrame,
  sendTextFrame,
  WsOpCode,
} from "./wsDataFrame";

/**
 * Upgrade Response
 *
 * The Http Server must respond to a Connection: Upgrade request with the following HTTPish headers
 * in order to signal to the client that it can handle websocket connections
 *
 * Technically there are extensions and subprotocols that could also be referenced here
 */
function upgradeConnection(req: IncomingMessage, socket: Duplex) {
  const clientKey = req.headers["sec-websocket-key"];
  const reponseHeaders = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    `Sec-WebSocket-Accept: ${createHash("sha1")
      .update(clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64")}`,
    "Connection: Upgrade",
    "\r\n",
  ].join("\r\n");
  socket.write(reponseHeaders);
}

const decoder = new TextDecoder();

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
  const encoders =
    (meta.encoders as Encoders<Req, Res>) ??
    ({
      isBinary: false,
      ws: JSON_ENCODER,
    } as Encoders<Req, Res>);

  const sendRes = encoders.isBinary
    ? (res: Res, socket: Duplex) => {
        sendBinaryFrame(socket, encoders.ws?.fromRes(res) as Uint8Array);
      }
    : (res: Res, socket: Duplex) => {
        sendTextFrame(socket, (encoders.ws?.fromRes(res) as string) ?? "");
      };

  return async (request: IncomingMessage, socket: Duplex) => {
    const bidi = new BiDiStream<Req, Res>();
    const client = bidi.client;

    socket.on("close", client.close);
    socket.on("error", client.error);

    let strBuffer = "";

    let bufOffset = 0;
    let buffer = new Uint8Array(2048);

    socket.on("data", (data: Buffer) => {
      const parsedFrame = parseDataFrame(data);

      if (parsedFrame.opCode === WsOpCode.PING) {
        sendPongFrame(socket, parsedFrame);
        return;
      } else if (parsedFrame.opCode === WsOpCode.CONNECTION_CLOSE) {
        socket.end();
      } else if (parsedFrame.opCode === WsOpCode.TEXT) {
        strBuffer += decoder.decode(parsedFrame.payload);
        if (parsedFrame.fin) {
          client.write(encoders.ws?.toReq(strBuffer) as Req);
          strBuffer = "";
        }
      } else if (parsedFrame.opCode === WsOpCode.BINARY) {
        // somewhat efficiently grow the underlying buffer
        if (parsedFrame.payloadLen + bufOffset > buffer.length) {
          let newSize = buffer.length * 2;
          while (parsedFrame.payloadLen + bufOffset > newSize) {
            newSize *= 2;
          }

          const newBuffer = new Uint8Array(newSize);
          newBuffer.set(buffer);
          buffer = newBuffer;
        }
        buffer.set(parsedFrame.payload, bufOffset);
        bufOffset += parsedFrame.payloadLen;

        if (parsedFrame.fin) {
          client.write(encoders.ws?.toReq(buffer as WsData) as Req);
          bufOffset = 0;
        }
      }
    });

    client.addListener({
      onMessage: (res: Res) => {
        sendRes(res, socket);
      },
      onError: (error) => {
        console.error(error.message);
      },
      onClose: () => {
        sendCloseFrame(socket);
      },
    });

    const respond = (_: number, message?: string) => {
      sendTextFrame(socket, message ?? "");
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
  _: ServerOpts<Meta>
) {
  server.on("upgrade", (req, socket: Duplex) => {
    upgradeConnection(req, socket);

    const endpoint =
      wsEndpoints[methodId({ method: "WS", url: req.url?.slice(1) ?? "" })];
    if (endpoint) {
      endpoint(req, socket);
    } else {
      socket.write(errorResponse(DEFAULT_NOT_FOUND));
      socket.end();
    }
  });
}
