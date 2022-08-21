import {
  ServerResponse,
  IncomingMessage,
  createServer,
  RequestListener,
} from "http";
import { URL } from "url";
import {
  EndpointDescription,
  SimpleMeta,
  Transport,
  TransportType,
} from "../common/api";
import HTTP_STATUS_CODES from "../common/statusCodes";
import {
  createErrorHandlers,
  DEFAULT_NOT_FOUND,
  errorResponse,
} from "./errors";
import { automaticMiddleware, getUrl, incomingMethodId } from "./middleware";
import { ApiContext, ServerOpts } from "./types";

export const restResponse =
  (res: ServerResponse) => (status: number, message?: string) => {
    res
      .writeHead(status, {
        "Content-Length": Buffer.byteLength(message ?? ""),
        "Content-Type": "application/json",
      })
      .end(message);
  };

export async function parseIncoming<Req, Res>(
  incoming: IncomingMessage,
  transport: Transport<Req, Res>,
  url?: URL
): Promise<Req | null> {
  if (transport.transportType === TransportType.URL_FORM_DATA) {
    const requestRecord: Record<string, unknown> = {};
    for (const [key, value] of url?.searchParams ?? []) {
      requestRecord[key] = JSON.parse(value);
    }
    // pinky swear Req looks like Record<string, unknown>;
    return requestRecord as Req;
  } else
    return new Promise<string>((resolve, reject) => {
      let body = "";
      incoming.on("data", (chunk: string) => {
        body += chunk;
      });
      incoming.on("end", () => resolve(body));
      incoming.on("error", reject);
    }).then((bodyStr: string) => {
      if (transport.transportType === TransportType.UNKNOWN) {
        return transport.decode.req(bodyStr);
      }
      if (bodyStr === undefined || bodyStr === "") {
        // how to gracefully handle this if we don't know whether req is nullable?
        return null;
      }
      return JSON.parse(bodyStr);
    });
}

export function restEndpoint<Req, Res, Meta extends SimpleMeta>(
  endpoint: EndpointDescription<Req, Res, ApiContext, unknown>,
  meta: Meta,
  serverOpts: ServerOpts<Meta>
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const respond = restResponse(res);
    const success = (response?: Res) =>
      response == null
        ? res.writeHead(HTTP_STATUS_CODES.NO_CONTENT).end()
        : respond(HTTP_STATUS_CODES.OK, JSON.stringify(response));
    const { badRequest, internalServerError } = createErrorHandlers(respond);

    try {
      const url = getUrl(req);
      const body: Req | null = await parseIncoming<Req, Res>(
        req,
        meta.transport as Transport<Req, Res>,
        url
      );
      const apiContext: ApiContext = {
        badRequest,
        internalServerError,
        respond,
        req,
        res,
        url,
      };

      if (serverOpts.middlewares) {
        for (const middleware of serverOpts.middlewares) {
          if (!(await middleware(apiContext, meta))) {
            return;
          }
        }
      }
      await endpoint(body as Req, apiContext)
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

export function createRestServer<Meta extends SimpleMeta>(
  restEndpoints: { [methodId: string]: RequestListener },
  serverOpts: ServerOpts<Meta>
) {
  const restMiddleware = automaticMiddleware(serverOpts);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    for (const middleware of restMiddleware) {
      if (!(await middleware(req, res))) {
        return;
      }
    }
    const endpoint = restEndpoints[incomingMethodId(req)];
    if (endpoint) {
      endpoint(req, res);
    } else {
      restResponse(res)(
        HTTP_STATUS_CODES.NOT_FOUND,
        errorResponse(DEFAULT_NOT_FOUND)
      );
    }
  });
}
