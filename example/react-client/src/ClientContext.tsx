import React from "react";
import { Authentication, CommonBlob, Duplex } from "estuary-rpc";
import { createApiClient, FetchOptsArg } from "estuary-rpc-client";

// import { ExampleApi, exampleApiMeta } from "./exampleApi";

import {
  Api,
  SimpleMeta,
  StreamDesc,
  get,
  post,
  ws,
  EndDesc,
  TransportType,
} from "estuary-rpc";

// create-react-app isn't liking my symlink, so just plop it here

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
