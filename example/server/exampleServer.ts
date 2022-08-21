import { Duplex } from "estuary-rpc";
import { ApiContext, createApiServer } from "estuary-rpc-server";

import {
  ExampleApi,
  exampleApiMeta,
  FooService,
  ExampleMeta,
} from "./exampleApi";

const server: ExampleApi<ApiContext, unknown> = {
  foo: {
    emptyPost: async () => {
      console.log("got post");
    },
    simpleGet: async ({ input }: { input: number }) => 4,
    simpleStream: async ({ server }: Duplex<string, boolean>) => {
      console.log("listening!");
      server.on("message", (input: string) => {
        console.log("Got message", input);
        server.write(input === "foo");
      });
      server.on("error", (err) => console.log("shoot"));
      server.on("close", () => console.log("closed"));
    },
  } as FooService<ApiContext, unknown>,

  fileUpload: (_1: void, _2: ApiContext) => {
    return null;
  },
};

// super straightforward middleware for handling authentication
async function dumbAuth(
  { req, internalServerError }: ApiContext,
  { method, needsAuth }: ExampleMeta
) {
  if (needsAuth) {
    if (method === "WS") {
      internalServerError();
      return false;
    } else if (req.headers["authorization"] !== "SuperSecure") {
      internalServerError("Unauthorized");
      return false;
    }
  }
  return true;
}

createApiServer<ExampleMeta>(server, exampleApiMeta, {
  port: 8000,
  staticFiles: {
    fileRoot: "../react-client/build/static/",
  },
  servePrefixes: {
    defaultFile: "../react-client/build/index.html",
    prefixes: ["/api"],
  },
  middlewares: [dumbAuth],
});
