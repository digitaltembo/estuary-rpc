import {
  Api,
  SimpleMeta,
  StreamEndpoint,
  get,
  post,
  ws,
  EndDesc,
  TransportType,
  CommonFile,
} from "estuary-rpc";

export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: FooService<Closure, Meta>;
  formPost: Endpoint<SimpleForm, number, Closure, Meta>;
}
export type SimpleForm = {
  name: string;
  file: CommonFile;
};

export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
  simplePost: Endpoint<number, number, Closure, Meta>;

  simpleGet: Endpoint<string, string, Closure, Meta>;
  authenticatedGet: Endpoint<string, string, Closure, Meta>;

  simpleStream: StreamEndpoint<string, boolean, Closure, Meta>;
}

export const exampleApiMeta: ExampleApi<unknown, SimpleMeta> = {
  foo: {
    simplePost: post("api/foo/simplePost", { example: [17, 4] }),
    simpleGet: get("api/foo/simpleGet", { example: ["hello", "HELLO"] }),
    authenticatedGet: get("api/foo/authenticatedGet", {
      example: ["hello", "HELLO"],
      authentication: { type: "basic", username: "", password: "" },
    }),
    simpleStream: ws("api/foo/simpleStream"),
  },
  formPost: post("api/formPost", {
    transport: {
      transportType: TransportType.MULTIPART_FORM_DATA,
      rawStrings: false,
    },
    reqSchema: {
      type: "object",
      properties: {
        name: { type: "string", example: "foo" },
        file: { type: "string", format: "binary" },
      },
    },
  }),
};
