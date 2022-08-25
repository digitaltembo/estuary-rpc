import { IncomingMessage, Server } from "http";
import { Duplex as Socket } from "stream";
import { createHash } from "crypto";
import { TextDecoder } from "util";

import {
  Duplex,
  EndpointDescription,
  SimpleMeta,
  Transport,
  TransportType,
} from "estuary-rpc";

import {
  createErrorHandlers,
  DEFAULT_NOT_FOUND,
  DEFAULT_UNAUTHORIZED,
  errorResponse,
} from "./errors";
import { getUrl, methodId } from "./middleware";
import { ApiContext, ServerOpts, WsEndpoints } from "./types";
import {
  parseDataFrame,
  sendBinaryFrame,
  sendCloseFrame,
  sendPongFrame,
  sendTextFrame,
  WsOpCode,
} from "./wsDataFrame";
import { isAuthenticated } from "./authentication";

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
  const transport = (meta.transport || {
    transportType: TransportType.JSON,
  }) as Transport<Req, Res>;
  const sendRes = (res: Res, socket: Socket) => {
    if (transport.transportType === TransportType.UNKNOWN) {
      if (transport.isBinary) {
        sendBinaryFrame(socket, transport.encode.res(res) as Uint8Array);
      } else {
        sendTextFrame(socket, transport.encode.res(res) as string);
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
            if (transport.transportType === TransportType.UNKNOWN) {
              client.write(transport.decode.req(strBuffer));
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
            transport.transportType === TransportType.UNKNOWN &&
            transport.isBinary
          ) {
            try {
              client.write(transport.decode.req(buffer));
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
    const [proceed, auth] = isAuthenticated(
      request,
      meta.authentication || serverOpts.defaultAuthentication,
      serverOpts.authenticate
    );
    if (!proceed) {
      sendCloseFrame(socket, errorResponse(DEFAULT_UNAUTHORIZED));
    }

    const apiContext = {
      respond,
      badRequest,
      internalServerError,
      req: request,
      socket,
      authentication: auth,
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

    const endpoint =
      wsEndpoints[
        methodId({
          method: "WS",
          url: getUrl(req)?.pathname?.slice(1) ?? "",
        })
      ];
    if (endpoint) {
      endpoint(req, socket);
    } else {
      sendCloseFrame(socket, errorResponse(DEFAULT_NOT_FOUND));
      socket.end();
    }
  });
}
