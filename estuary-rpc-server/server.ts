import { Api, Endpoint, SimpleMeta, Duplex, ApiTypeOf } from "estuary-rpc";

import { ApiContext, RestEndpoints, ServerOpts, WsEndpoints } from "./types";
import { methodId } from "./middleware";
import { createRestServer, restEndpoint } from "./rest";
import { createWsServer, wsEndpoint } from "./ws";

function flattenApi<T extends Api<unknown, Meta>, Meta extends SimpleMeta>(
  api: ApiTypeOf<ApiContext, unknown, T>,
  apiMeta: ApiTypeOf<unknown, Meta, T>,
  serverOpts: ServerOpts<Meta>
): [RestEndpoints, WsEndpoints] {
  const restEndpoints: RestEndpoints = {};
  const wsEndpoints: WsEndpoints = {};

  Object.keys(apiMeta).forEach((apiName: string) => {
    if (typeof apiMeta[apiName] === "function") {
      const meta = apiMeta[apiName] as Meta;
      if (meta.method === "WS") {
        wsEndpoints[methodId(meta)] = wsEndpoint(
          api[apiName] as Endpoint<
            Duplex<unknown, unknown>,
            void,
            ApiContext,
            unknown
          >,
          meta,
          serverOpts
        );
      } else {
        restEndpoints[methodId(meta)] = restEndpoint(
          api[apiName] as Endpoint<unknown, unknown, ApiContext, unknown>,
          meta,
          serverOpts
        );
      }
    } else {
      const [childRest, childWs] = flattenApi(
        api[apiName] as any,
        apiMeta[apiName] as any,
        serverOpts
      );
      Object.assign(restEndpoints, childRest);
      Object.assign(wsEndpoints, childWs);
    }
  });
  return [restEndpoints, wsEndpoints];
}

/**
 * createApiServer is the primary method through which your server code will interact with estuary-rpc.
 * Calling it will set up and start an 'http' server that listens for HTTP and WS connections and appropriately
 * forwards data to your endpoint implementations, taking into account underlying transport encodeings,
 * authentication tokens, and the wonkiness of dealing with WebSockets
 * @param api Your API definition, the collection of all the endpoint implementations
 * @param description Your API Metadata definition, defined in common code with your client
 * @param serverOpts options for configuring the server
 * * @example
 * ```ts
 * // Common Code
 * export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
 *   foo: FooService<Closure, Meta>;
 *   fileUpload: Endpoint<void, void, Closure, Meta>;
 * }
 *
 * export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
 *   emptyPost: Endpoint<void, void, Closure, Meta>;
 *   simpleGet: Endpoint<number, number, Closure, Meta>;
 *   simpleStream: StreamDesc<string, boolean, Closure, Meta>;
 * }
 *
 * export const exampleApiMeta: ExampleApi<never, ExampleMeta> = {
 *   foo: {
 *     emptyPost: post("foo/emptyPost"),
 *     simpleGet: get("foo/simpleGet", { authentication: "bearer", token: "" }),
 *     simpleStream: ws("foo/simpleStream"),
 *   },
 *   fileUpload: post("fileUpload", { uploads: ["someFile.txt"] }),
 * };
 *
 * // Server Code
 * const server: ExampleApi<ApiContext, unknown> = {
 *   foo: {
 *     emptyPost: async () => {
 *       console.log("got post");
 *     },
 *     simpleGet: async (num: number) => 4,
 *     simpleStream: async ({ server }: Duplex<string, boolean>) => {
 *       server.on("message", (input: string) => {
 *         console.log("Got message", input);
 *         server.write(input === "foo");
 *       });
 *     },
 *   } as FooService<ApiContext, unknown>,
 *
 *   fileUpload: (_1: void, _2: ApiContext) => {
 *     return null;
 *   },
 * };
 * ```
 * @group Server
 */
export function createApiServer<
  Meta extends SimpleMeta,
  T extends Api<unknown, Meta>
>(
  api: ApiTypeOf<ApiContext, unknown, T>,
  apiMeta: ApiTypeOf<unknown, Meta, T>,
  serverOpts: ServerOpts<Meta>
) {
  const [restEndpoints, wsEndpoints] = flattenApi(api, apiMeta, serverOpts);

  const server = createRestServer(restEndpoints, serverOpts);
  createWsServer(server, wsEndpoints, serverOpts);
  server.listen(serverOpts.port);

  console.log("Listening on :", serverOpts.port);
}

export * from "estuary-rpc";
export * from "./errors";
export * from "./middleware";
export * from "./multipart";
export * from "./rest";
export * from "./types";
export * from "./ws";
