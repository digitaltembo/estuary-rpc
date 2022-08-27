# Estuary RPC

Estuary RPC is an attempt to make an extremely simple (toy) RPC system for use between browsers and servers that:

- is typesafe, with all types simply defined in TS - meaning your code won't compile if the server or the client code is not invoked with the correct types for the given RPC call
- supports most desired operations between client and server (REST methods, status codes, file uploads, automatic authentication)
- doesn't have external dependencies

# This Package

`estuary-rpc` defines common types and methods for in turn defining your API in code that is held in 
common between a server and a client. 

# Installation
Should be installed in both your server and client code with
```
npm install estuary-rpc
```

# Usage
Within the common project, it will be necessary to define 3 things:
* The Meta type used to describe all your endpoints. It may be sufficient to use `import { SimpleMeta } from "estuary-rpc";`
* The Api type used in the interface. This type can be arbitrarily nested, but each "leaf" field must be either `Endpoint<[Req], [Res], Closure, Meta>` or `StreamEndpoint<[Req], [Res], Closure, Meta>`, where `Req` and `Res` are specific types and `Closure` and `Meta` are genericized
  * For instance, this would define a ExampleApi:
```
export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: FooService<Closure, Meta>;
  fileUpload: Endpoint<void, void, Closure, Meta>;
}

export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
  simpleGet: Endpoint<number, number, Closure, Meta>;
  simpleStream: StreamEndpoint<string, boolean, Closure, Meta>;
}
```
* The Api Metadata Definition, implementing your Api type genericized over your Meta type and an unknown closure. This will use the `get`, `post`, `put`, `del`, or `ws` methods defined in `estuary-rpc-common` to define the metadata about the given REST or WS endpoint definitions - most importantly the URL at which the endpoint will be accessed, but also any other metadata/auth requirements/upload definitions should go here. For Example:
```
export const exampleApiMeta: ExampleApi<never, ExampleMeta> = {
  foo: {
    emptyPost: post("foo/emptyPost"),
    simpleGet: get("foo/simpleGet", { needsAuth: true }),
    simpleStream: ws("foo/simpleStream"),
  },
  fileUpload: post("fileUpload", { uploads: ["someFile.txt"] }),
};
```
