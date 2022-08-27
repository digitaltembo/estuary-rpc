import {
  Api,
  SimpleMeta,
  StreamEndpoint,
  get,
  post,
  ws,
  Endpoint,
  TransportType,
  CommonFile,
  ApiTypeOf,
} from "estuary-rpc";

export type SimpleForm = {
  name: string;
  file: CommonFile;
};

export const exampleApiMeta = {
  foo: {
    simplePost: post<number, number, SimpleMeta>("api/foo/simplePost", {
      example: [17, 4],
    }),
    simpleGet: get<string, string, SimpleMeta>("api/foo/simpleGet", {
      example: ["hello", "HELLO"],
    }),
    authenticatedGet: get<string, string, SimpleMeta>(
      "api/foo/authenticatedGet",
      {
        example: ["hello", "HELLO"],
        authentication: { type: "basic", username: "", password: "" },
      }
    ),
    simpleStream: ws<string, boolean, SimpleMeta>("api/foo/simpleStream"),
  },
  formPost: post<SimpleForm, number, SimpleMeta>("api/formPost", {
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

export type ExampleApi<Closure> = ApiTypeOf<
  Closure,
  SimpleMeta,
  typeof exampleApiMeta
>;
