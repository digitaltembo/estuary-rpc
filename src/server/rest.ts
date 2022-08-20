import {
  ServerResponse,
  IncomingMessage,
  createServer,
  RequestListener,
} from "http";
import {
  Encoders,
  EndpointDescription,
  JSON_ENCODER,
  SimpleMeta,
} from "../common/api";
import HTTP_STATUS_CODES from "../common/statusCodes";
import {
  createErrorHandlers,
  DEFAULT_NOT_FOUND,
  errorResponse,
} from "./errors";
import { automaticMiddleware, methodId } from "./middleware";
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

export function createRestServer<Meta extends SimpleMeta>(
  restEndpoints: { [methodId: string]: RequestListener },
  serverOpts: ServerOpts<Meta>
) {
  const restMiddleware = automaticMiddleware(serverOpts);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
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
  });
}
