import React from "react";
import { Authentication, CommonFile, Duplex } from "estuary-rpc";
import { createApiClient, FetchOptsArg } from "estuary-rpc-client";

// import { ExampleApi, exampleApiMeta } from "./exampleApi";

import {
  Api,
  SimpleMeta,
  StreamEndpoint,
  get,
  post,
  ws,
  Endpoint,
  TransportType,
} from "estuary-rpc";

// create-react-app isn't liking my symlink, so just plop it here

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
    inUrl: get(x`api/foo/bar/${number("hi")}`)
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

// end of symlink plop

type ClientContextType = {
  setAuth: (
    authorization?:
      | Authentication
      | ((oldAuth?: Authentication) => Authentication)
  ) => void;
  client: ExampleApi<FetchOptsArg, SimpleMeta>;
};

(window as any).hello = new Duplex<string, string>();

const ClientContext = React.createContext<ClientContextType>({
  setAuth: () => {},
  client: createApiClient(exampleApiMeta) as ExampleApi<
    FetchOptsArg,
    SimpleMeta
  >,
});

export function ClientContextProvider({
  children,
}: React.PropsWithChildren<{}>) {
  const [auth, setAuth] = React.useState<Authentication | undefined>(undefined);

  const context = React.useMemo(
    () =>
      createApiClient(exampleApiMeta, {
        authentication: auth,
      }) as ExampleApi<FetchOptsArg, SimpleMeta>,
    [auth]
  );

  return (
    <ClientContext.Provider value={{ setAuth, client: context }}>
      {children}
    </ClientContext.Provider>
  );
}

export default ClientContext;
