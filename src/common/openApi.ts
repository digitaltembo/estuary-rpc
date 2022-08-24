import {
  Api,
  Schema,
  SimpleMeta,
  TransportType,
  URL_FORM_DATA_KEY,
} from "./types";

const DEFAULT_SCHEMAS = {
  Error: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["error"],
        description:
          'Errors will always have "status": "error". It is also assumed that non-errors will NOT have "status": "error".',
      },
      message: {
        type: "string",
        description: "Error description",
      },
    },
  },
};

function flatten<Meta extends SimpleMeta>(api: Api<unknown, Meta>): Meta[] {
  return Object.values(api).reduce(
    (acc: Meta[], cur) =>
      typeof cur === "function"
        ? [...acc, cur as Meta]
        : [...acc, ...flatten(cur as Api<unknown, Meta>)],
    []
  );
}

function schemaFromExample(example: unknown): Schema {
  switch (typeof example) {
    case "boolean":
      return { type: "boolean", example };
    case "number":
      return { type: "number", example };
    case "string":
      return { type: "string", example };

    case "object":
      if (Array.isArray(example)) {
        return {
          type: "array",
          items: example.length > 0 ? schemaFromExample(example[0]) : undefined,
        };
      }
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(example as Record<string, unknown>).map(
            ([prop, propExample]) => [prop, schemaFromExample(propExample)]
          )
        ),
      };
  }

  return { type: "object" };
}

function requestDoc<Meta extends SimpleMeta>(
  meta: Meta
): Record<string, unknown> {
  const reqSchema =
    meta.reqSchema ||
    (meta.example ? schemaFromExample(meta.example[0]) : { type: "object" });
  switch (meta.transport?.transportType) {
    case undefined:
    // undefined transports are assumed to be JSON
    case TransportType.JSON:
      return {
        requestBody: { content: { "application/json": { schema: reqSchema } } },
      };
    case TransportType.URL_FORM_DATA:
      if (reqSchema.type === "object") {
        return {
          parameters: Object.entries(reqSchema.properties ?? {}).map(
            ([name, propSchema]) => ({
              in: "query",
              name: name,
              schema: propSchema,
            })
          ),
        };
      } else {
        return {
          parameters: [
            { in: "query", name: URL_FORM_DATA_KEY, schema: reqSchema },
          ],
        };
      }
    case TransportType.MULTIPART_FORM_DATA:
      if (reqSchema.type === "object") {
        return {
          requestBody: {
            content: {
              "multipart/form-data": { schema: reqSchema },
            },
          },
        };
      } else {
        return {
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { [URL_FORM_DATA_KEY]: reqSchema },
                },
              },
            },
          },
        };
      }
  }
  //probably a safe assumption
  return { type: "object" };
}

function responseDoc<Meta extends SimpleMeta>(
  meta: Meta
): Record<string, unknown> {
  const resSchema =
    meta.resSchema ||
    (meta.example ? schemaFromExample(meta.example[1]) : { type: "object" });

  return {
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": { schema: resSchema },
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
      ...(meta.authentication
        ? {
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          }
        : {}),
      "5XX": {
        description: "Unexpected Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  };
}
function endpointDoc<Meta extends SimpleMeta>(
  meta: Meta
): Record<string, unknown> {
  return {
    [meta.method === "WS" ? "post" : meta.method.toLowerCase()]: {
      summary: meta.summary,
      description: meta.description,
      security: meta.authentication
        ? [{ [meta.authentication.type + "Auth"]: [] }]
        : undefined,
      ...requestDoc(meta),
      ...responseDoc(meta),
      ...(meta.swagger || {}),
    },
  };
}

function accumulateSchemas<Meta extends SimpleMeta>(
  schemaCat: Record<string, Schema>,
  meta: Meta
) {
  return meta.reqSchema?.id
    ? { ...schemaCat, [meta.reqSchema.id]: meta.reqSchema }
    : schemaCat;
}
type SecurityScheme = [string, Record<string, string>];

function accumulateSecurities<Meta extends SimpleMeta>(
  securities: SecurityScheme[],
  meta: Meta
) {
  if (!meta.authentication) {
    return securities;
  }
  const securityScheme: SecurityScheme =
    meta.authentication.type === "basic" ||
    meta.authentication.type === "bearer"
      ? [
          meta.authentication.type + "Auth",
          { type: "http", scheme: meta.authentication.type },
        ]
      : [
          meta.authentication.type + "Auth",
          {
            type: "apiKey",
            in: meta.authentication.type,
            name: meta.authentication.keyPair[0],
          },
        ];
  const keys = Object.keys(securityScheme[1]);
  return [
    ...securities.filter(([_, s]: SecurityScheme) =>
      keys.every((key) => securityScheme[1][key] === s[key])
    ),
    securityScheme,
  ];
}

export function createOpenApiSpec<Meta extends SimpleMeta>(
  api: Api<unknown, Meta>,
  additionalSwag: any,
  endpointMapping?: (
    currentSwaggerJson: Record<string, unknown>,
    currentMeta: Meta
  ) => Record<string, unknown>
) {
  const endpoints = flatten(api);
  const knownSchemas = endpoints.reduce<Record<string, Schema>>(
    accumulateSchemas,
    {}
  );

  const securitySchemes = Object.fromEntries(
    endpoints.reduce<SecurityScheme[]>(accumulateSecurities, [])
  );
  const finalTouches =
    endpointMapping || ((swag: Record<string, unknown>) => swag);
  return {
    openapi: "3.0.0",
    ...additionalSwag,
    paths: Object.fromEntries(
      endpoints.map((meta: Meta) => [
        "/" + meta.url,
        finalTouches(endpointDoc(meta), meta),
      ])
    ),
    components: {
      schemas: {
        ...DEFAULT_SCHEMAS,
        ...knownSchemas,
        ...additionalSwag.components,
      },
      securitySchemes,
    },
  };
}
