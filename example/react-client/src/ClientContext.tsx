import React from "react";

import { convertApiClient, FetchOptsArg } from "estuary-rpc-client";
// import { openStreamHandler } from "estuary-rpc";
import {
  Api,
  SimpleMeta,
  StreamDesc,
  get,
  post,
  ws,
  EndDesc,
  BiDiStream,
} from "estuary-rpc";

export type ExampleMeta = SimpleMeta & {
  needsAuth?: boolean;
};

export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: FooService<Closure, Meta>;
  fileUpload: EndDesc<void, void, Closure, Meta>;
}

export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
  emptyPost: EndDesc<void, void, Closure, Meta>;
  simpleGet: EndDesc<number, number, Closure, Meta>;
  simpleStream: StreamDesc<string, boolean, Closure, Meta>;
}

export const exampleApiMeta: ExampleApi<unknown, ExampleMeta> = {
  foo: {
    emptyPost: post("api/foo/emptyPost"),
    simpleGet: get("api/foo/simpleGet", { needsAuth: true }),
    simpleStream: ws("api/foo/simpleStream"),
  },
  fileUpload: post("api/fileUpload", { uploads: ["someFile.txt"] }),
};

type ClientContextType = {
  setAuth: (authorization: string) => void;
  client: ExampleApi<FetchOptsArg, unknown>;
};

(window as any).hello = new BiDiStream<string, string>();

const ClientContext = React.createContext<ClientContextType>({
  setAuth: () => {},
  client: convertApiClient(exampleApiMeta) as ExampleApi<FetchOptsArg, unknown>,
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
      }) as ExampleApi<FetchOptsArg, unknown>,
    [auth]
  );

  return (
    <ClientContext.Provider value={{ setAuth, client: context }}>
      {children}
    </ClientContext.Provider>
  );
}

export default ClientContext;
