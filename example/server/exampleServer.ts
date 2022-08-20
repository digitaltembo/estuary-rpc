import { BiDiStream } from "../../src/common/stream";
import { ApiContext, createApiServer } from "../../src/server/server";
import {
  ExampleApi,
  exampleApiMeta,
  FooService,
  ExampleMeta,
} from "../common/exampleApi";

const server: ExampleApi<ApiContext, unknown> = {
  foo: {
    emptyPost: async () => {
      console.log("got post");
    },
    simpleGet: async (num: number) => 4,
    simpleStream: async ({ server }: BiDiStream<string, boolean>) => {
      server.on("message", (input: string) => {
        console.log("Got message", input);
        server.write(input === "foo");
      });
    },
  } as FooService<ApiContext, unknown>,

  fileUpload: (_1: void, _2: ApiContext) => {
    return null;
  },
};

async function dumbAuth(
  { req, internalServerError }: ApiContext,
  { method, needsAuth }: ExampleMeta
) {
  if (needsAuth) {
    if (method === "WS" && false) {
      internalServerError();
      return false;
    } else if (req.headers["authorization"] !== "SuperSecure") {
      internalServerError();
      return false;
    }
  }
  return true;
}

createApiServer<ExampleMeta>(server, exampleApiMeta, {
  port: 8000,
  middlewares: [dumbAuth],
});
