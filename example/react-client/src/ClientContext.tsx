import React from "react";
import { CommonBlob, Duplex } from "estuary-rpc";
import { convertApiClient, FetchOptsArg } from "estuary-rpc-client";

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

// end of symlink plop

type ClientContextType = {
  setAuth: (authorization: string) => void;
  client: ExampleApi<FetchOptsArg, ExampleMeta>;
};

(window as any).hello = new Duplex<string, string>();

const ClientContext = React.createContext<ClientContextType>({
  setAuth: () => {},
  client: convertApiClient(exampleApiMeta) as ExampleApi<
    FetchOptsArg,
    ExampleMeta
  >,
});

export function ClientContextProvider({
  children,
}: React.PropsWithChildren<{}>) {
  const [auth, setAuth] = React.useState<string>("");

  const context = React.useMemo(
    () =>
      convertApiClient(exampleApiMeta, {
        ammendXhr: (xhr: XMLHttpRequest) =>
          xhr.setRequestHeader("authorization", auth),
      }) as ExampleApi<FetchOptsArg, ExampleMeta>,
    [auth]
  );

  return (
    <ClientContext.Provider value={{ setAuth, client: context }}>
      {children}
    </ClientContext.Provider>
  );
}

export default ClientContext;
