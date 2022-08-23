import { Duplex, SimpleFile } from "estuary-rpc";
import { ApiContext, createApiServer } from "estuary-rpc-server";
import { IncomingMessage } from "http";

import {
  ExampleApi,
  exampleApiMeta,
  FooService,
  ExampleMeta,
  SimpleForm,
} from "./exampleApi";

async function simpleGet(input: string) {
  console.log("processing get", input);
  return input.toUpperCase();
}
const server: ExampleApi<ApiContext, unknown> = {
  foo: {
    simplePost: async (num) => {
      console.log("got post");
      return num + 1;
    },
    simpleGet,
    authenticatedGet: simpleGet,
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

  formPost: async (form: SimpleForm) => {
    console.log(
      "processing response",
      form.name,
      (form.file as SimpleFile).name
    );
    return 4;
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
    fileRoot: "../react-client/build/",
    apiPrefixes: ["/api"],
    defaultFile: "index.html",
    defaultCode: 200,
  },
  middlewares: [dumbAuth],
});
