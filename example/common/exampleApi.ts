import {
  Api,
  SimpleMeta,
  StreamDesc,
  get,
  post,
  ws,
  EndDesc,
  TransportType,
  CommonBlob,
} from "estuary-rpc";

export type ExampleMeta = SimpleMeta & {
  needsAuth?: boolean;
};

export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: FooService<Closure, Meta>;
  formPost: EndDesc<SimpleForm, number, Closure, Meta>;
}
export type SimpleForm = {
  name: string;
  file: CommonBlob;
};

export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
  simplePost: EndDesc<number, number, Closure, Meta>;

  simpleGet: EndDesc<string, string, Closure, Meta>;
  authenticatedGet: EndDesc<string, string, Closure, Meta>;

  simpleStream: StreamDesc<string, boolean, Closure, Meta>;
}

export const exampleApiMeta: ExampleApi<unknown, ExampleMeta> = {
  foo: {
    simplePost: post("api/foo/simplePost", { example: [17, 4] }),
    simpleGet: get("api/foo/simpleGet", { example: ["hello", "HELLO"] }),
    authenticatedGet: get("api/foo/authenticatedGet", {
      example: ["hello", "HELLO"],
      needsAuth: true,
    }),
    simpleStream: ws("api/foo/simpleStream"),
  },
  formPost: post("api/formPost", {
    needsAuth: false,
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
