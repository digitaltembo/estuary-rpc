import { Duplex, SimpleFile, Authentication, SimpleMeta } from "estuary-rpc";
import { ApiContext, createApiServer } from "estuary-rpc-server";
import { IncomingMessage } from "http";

import {
  ExampleApi,
  exampleApiMeta,
  FooService,
  SimpleForm,
} from "./exampleApi";

async function simpleGet(input: string) {
  console.log("processing get", input);
  return input.toUpperCase();
}
const server: ExampleApi<ApiContext, unknown> = {
  foo: {
    simplePost: async (num, { req }) => {
      console.log("got post", req.headers);
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

createApiServer<SimpleMeta>(server, exampleApiMeta, {
  port: 8000,
  staticFiles: {
    fileRoot: "../react-client/build/",
    apiPrefixes: ["/api"],
    defaultFile: "index.html",
    defaultCode: 200,
  },
  authenticate: (auth: Authentication) =>
    auth.type === "basic" &&
    auth.username === "user" &&
    auth.password === "password",
});
