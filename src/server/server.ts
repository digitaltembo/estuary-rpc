import { RequestListener } from "http";

import { Api, EndpointDescription, SimpleMeta } from "../common/api";
import { BiDiStream } from "../common/stream";
import { ApiContext, RestEndpoints, ServerOpts, WsEndpoints } from "./types";
import { methodId } from "./middleware";
import { createRestServer, restEndpoint } from "./rest";
import { createWsServer, wsEndpoint } from "./ws";

function flattenApi<Meta extends SimpleMeta>(
  api: Api<ApiContext, unknown>,
  apiMeta: Api<unknown, Meta>,
  serverOpts: ServerOpts<Meta>
): [RestEndpoints, WsEndpoints] {
  const restEndpoints: RestEndpoints = {};
  const wsEndpoints: WsEndpoints = {};

  Object.keys(apiMeta).forEach((apiName: string) => {
    if (typeof apiMeta[apiName] === "function") {
      const meta = apiMeta[apiName] as Meta;
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

export function createApiServer<Meta extends SimpleMeta>(
  api: Api<ApiContext, unknown>,
  description: Api<unknown, Meta>,
  serverOpts: ServerOpts<Meta>
) {
  const [restEndpoints, wsEndpoints] = flattenApi(api, description, serverOpts);

  const server = createRestServer(restEndpoints, serverOpts);
  createWsServer(server, wsEndpoints, serverOpts);
  server.listen(serverOpts.port);

  console.log("Listening on :", serverOpts.port);
}

export * from "../common/stream";
export * as HTTP_STATUS_CODES from "../common/statusCodes";
export * from "../common/api";
export * from "./errors";
export * from "./middleware";
export * from "./rest";
export * from "./types";
export * from "./ws";
