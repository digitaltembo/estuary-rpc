import { Api, SimpleMeta, TransportType } from "./types";
import { post, get, ws, del, put } from "./api";
import { createOpenApiSpec } from "./openApi";

export const exampleApiMeta: Api<never, SimpleMeta> = {
  foo: {
    emptyPost: post("foo/emptyPost", {
      authentication: { type: "bearer" },
      transport: { transportType: TransportType.MULTIPART_FORM_DATA },
    }),
    simpleGet: get("foo/simpleGet", {
      transport: { transportType: TransportType.URL_FORM_DATA },
    }),
    simpleStream: ws("foo/simpleStream"),
  },
  del: del("bar", { summary: "Simple Delete", description: "More Data" }),
  put: put("put", { example: [[2, 3], { nested: "object", b: true }] }),
};
test("Generates OpenAPI Schema", async () => {
  await expect(exampleApiMeta.del).rejects.toHaveProperty(
    "message",
    "Invalid Usage"
  );
  expect(
    createOpenApiSpec(
      exampleApiMeta,
      {
        info: {
          title: "Example API",
          version: "foo.bar",
        },
        components: {
          FooComponent: {
            type: "string",
            description: "wow",
          },
        },
      },
      (cur, meta) =>
        meta.method === "GET" ? { ...cur, description: "This is a get" } : cur
    )
  ).toMatchObject(EXPECTED_OUTPUT);
});

const EXPECTED_OUTPUT = {
  openapi: "3.0.0",
  info: { title: "Example API", version: "foo.bar" },
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["error"],
            description:
              'Errors will always have "status": "error". It is also assumed that non-errors will NOT have "status": "error".',
          },
          message: { type: "string", description: "Error description" },
        },
      },
      FooComponent: { type: "string", description: "wow" },
    },
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
  },
  paths: {
    "/foo/emptyPost": {
      post: {
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "5XX": {
            description: "Unexpected Error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/foo/simpleGet": {
      get: {
        parameters: [],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "5XX": {
            description: "Unexpected Error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      description: "This is a get",
    },
    "/foo/simpleStream": {
      post: {
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "5XX": {
            description: "Unexpected Error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/bar": {
      delete: {
        summary: "Simple Delete",
        description: "More Data",
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "5XX": {
            description: "Unexpected Error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/put": {
      put: {
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "array", items: { type: "number", example: 2 } },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nested: { type: "string", example: "object" },
                    b: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          "400": {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "5XX": {
            description: "Unexpected Error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
};
