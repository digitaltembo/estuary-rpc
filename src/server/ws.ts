import { IncomingMessage, Server } from "http";
import { Duplex as Socket } from "stream";
import { createHash } from "crypto";
import { TextDecoder } from "util";

import {
  Duplex,
  EndpointDescription,
  SimpleMeta,
  TransportType,
  UknownStringTransport,
  UnknownBinaryTransport,
} from "../common/api";
import {
  createErrorHandlers,
  DEFAULT_NOT_FOUND,
  errorResponse,
} from "./errors";
import { incomingMethodId } from "./middleware";
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
function upgradeConnection(req: IncomingMessage, socket: Socket) {
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
  endpoint: EndpointDescription<Duplex<Req, Res>, void, ApiContext, unknown>,
  meta: Meta,
  serverOpts: ServerOpts<Meta>
) {
  const sendRes = (res: Res, socket: Socket) => {
    if (meta.transport.transportType === TransportType.UNKNOWN) {
      if (meta.transport.isBinary) {
        sendBinaryFrame(
          socket,
          (meta.transport as UnknownBinaryTransport<Req, Res>).encode.res(
            res
          ) as Uint8Array
        );
      } else {
        sendTextFrame(
          socket,
          (meta.transport as UknownStringTransport<Req, Res>).encode.res(
            res
          ) as string
        );
      }
    } else {
      sendTextFrame(socket, JSON.stringify(res));
    }
  };

  return async (request: IncomingMessage, socket: Socket) => {
    const duplex = new Duplex<Req, Res>();
    const client = duplex.client;

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
          try {
            if (meta.transport.transportType === TransportType.UNKNOWN) {
              client.write(meta.transport.decode.req(strBuffer) as Req);
            } else {
              client.write(JSON.parse(strBuffer) as Req);
            }
          } catch (err) {
            console.error(
              `Error: unable to parse string WS data ${strBuffer}`,
              err
            );
          }
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
          if (
            meta.transport.transportType === TransportType.UNKNOWN &&
            meta.transport.isBinary
          ) {
            try {
              client.write(meta.transport.decode.req(buffer) as Req);
            } catch (err) {
              console.error("Unable to encode WS data", err);
            }
          }
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

    duplex.closeClient();
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
    endpoint(duplex, apiContext);
  };
}

export function createWsServer<Meta extends SimpleMeta>(
  server: Server,
  wsEndpoints: WsEndpoints,
  _: ServerOpts<Meta>
) {
  server.on("upgrade", (req, socket: Socket) => {
    upgradeConnection(req, socket);

    const endpoint = wsEndpoints[incomingMethodId(req)];
    if (endpoint) {
      endpoint(req, socket);
    } else {
      socket.write(errorResponse(DEFAULT_NOT_FOUND));
      socket.end();
    }
  });
}
