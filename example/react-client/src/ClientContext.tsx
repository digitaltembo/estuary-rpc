import React from "react";
import { Authentication } from "estuary-rpc";
import { createApiClient, ClientClosure } from "estuary-rpc-client";
import { exampleApiMeta, ExampleApi } from "./exampleApi";

type ClientContextType = {
  setAuth: (
    authorization?:
      | Authentication
      | ((oldAuth?: Authentication) => Authentication)
  ) => void;
  client: ExampleApi<ClientClosure>;
};

const ClientContext = React.createContext<ClientContextType>({
  setAuth: () => {},
  client: createApiClient(exampleApiMeta) as ExampleApi<ClientClosure>,
});

export function ClientContextProvider({
  children,
}: React.PropsWithChildren<{}>) {
  const [auth, setAuth] = React.useState<Authentication | undefined>(undefined);

  const context = React.useMemo(
    () =>
      createApiClient(exampleApiMeta, {
        authentication: auth,
      }) as ExampleApi<ClientClosure>,
    [auth]
  );

  return (
    <ClientContext.Provider value={{ setAuth, client: context }}>
      {children}
    </ClientContext.Provider>
  );
}

export default ClientContext;
