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
* The Meta type used to describe all your endpoints. It may be sufficient to use SimpleMeta, in which case the Meta type can simple be left off your endpoint metadata definitions in the next section

* Your API metadata definition. This will use the [get](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.get.html), [post](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.post.html), [put](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.put.html), [del](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.del.html), or [ws](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.ws.html)  methods defined in `estuary-rpc` to define the metadata about the given REST or WS endpoint definitions - most importantly the URL at which the endpoint will be accessed, but also any other metadata/auth requirements/upload definitions should go here. For Example:
```ts
export const exampleApiMeta = {
  foo: {
    emptyPost: post<number, number, ExampleMeta>("foo/emptyPost"),
    simpleGet: get<string, string, ExampleMeta>("foo/simpleGet", { needsAuth: true }),
    simpleStream: ws<Foo, Bar, ExampleMeta>("foo/simpleStream"),
  },
  fileUpload: post<void, null, ExampleMeta>("fileUpload", { uploads: ["someFile.txt"] }),
};
```
* Your API type, inferred from your API metadata definition like so:
```ts
export type ExampleApi<Closure> = ApiTypeof<Closure, ExamlpeMeta, typeof exampleApiMeta>;
// You may also want to define the service types individually, for implementing them one at a time:
export type FooService<Closure> = ExampleApi<Closure>["foo"];
```
