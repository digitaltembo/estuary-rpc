# Estuary RPC

Estuary RPC is an attempt to make an extremely simple (toy) RPC system for use between browsers and servers that:

- is typesafe, with all types simply defined in TS - meaning your code won't compile if the server or the client code is not invoked with the correct types for the given RPC call
- supports most desired operations between client and server (REST methods, status codes, file uploads, automatic authentication)
- doesn't have external dependencies

## Usage

The imagined usage is in a project set up like the example project, with
```
project
 - client
 - common
 - server
```
directories, where there are two separate projects, one for the server running in npm and one for the client that runs on the browser, sharing the `common` directory.

### Usage - Common

For both the server and the client projects, you must install `estuary-rpc`.

```
npm install estuary-rpc-common
```
Within the common project, it will be necessary to define 3 things:
* The Meta type used to describe all your endpoints. It may be sufficient to use `import { SimpleMeta } from "estuary-rpc";`
* The Api type used in the interface. This type can be arbitrarily nested, but each "leaf" field must be either `EndDesc<[Req], [Res], Closure, Meta>` or `StreamDesc<[Req], [Res], Closure, Meta>`, where `Req` and `Res` are specific types and `Closure` and `Meta` are genericized
  * For instance, this would define a ExampleApi:
```
export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: FooService<Closure, Meta>;
  fileUpload: EndDesc<void, void, Closure, Meta>;
}

export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
  simpleGet: EndDesc<number, number, Closure, Meta>;
  simpleStream: StreamDesc<string, boolean, Closure, Meta>;
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

### Usage - Client
From the clientside, it is necessary merely to `import { convertApiClient, FetchOptsArg } from "estuary-rpc-client";` and import your common definitions, and you will be able to create an instantion of your Api type with callable rpc methods:
```
const client = convertApiClient(exampleApiMeta) as ExampleApi<FetchOptsArg, unknown>;
```

`FetchOptsArg` serves as the closure to the individual calls, should it be necessary to add additional calling options such as a timeout. The methods can then be called with
* `await client.foo.emptyPost()` to send an empty post message
* `const res = await client.foo.simpleGet(4);` to retrieve a number response from the server
* `const res = await client.foo.simpleGet(4, {timeout: 1000});` to set a timeout on that fetch call
* Streaming is a bit more complicated, but I have tried to make it as straightforward as possible - 

```
import { openStreamHandler } from "estuary-rpc";

const streamHandler = await openStreamHandler(client.foo.simpleStream);

streamHandler.on("message", (val: boolean) =>
  console.log("Got message from server", val);
  streamHandler.close()
);
streamHandler.write("yooo");
```
  * `openStreamHandler` serves as a bit of a simplification of the underlying use of the RPC method, which works natively like so:
```
import { BiDiStream } from "estuary-rpc";

const bidi = new BiDiStream<string, boolean>();
await client.foo.simpleStream(bidi);

const streamHandler = bidi.client;
streamHandler.on("message", (val: boolean) => {
  console.log("Got message from server", val);
  simpleStream.close()
});
streamHandler.write("yooo");
```


### Usage - Server
On the serverside, you need to instantiate an object that implements your Api with an ApiContext closure (so your endpoints can have access to the raw request/response and helper error methods) and an unknown metadata:
```
const server: ExampleApi<ApiContext, unknown> = {
  foo: {
    emptyPost: async () => {
      console.log("got post");
    },
    simpleGet: async (num: number) => 4,
    simpleStream: async ({ server }: BiDiStream<string, boolean>) => {
      server.on("message", (input: string) => {
        console.log("Got message", input);
        server.write(input === "foo");
      });
    },
  } as FooService<ApiContext, unknown>,

  fileUpload: (_1: void, _2: ApiContext) => {
    return null;
  },
};
```

Likely, of course, your individual services will be defined in separate files and/or directories, but they all still need to come together at the end. 

After you have a server object, to actually run it in such a way as to respond correctly to REST and WS connections, you simply need to `import { createApiServer } from "estuary-rpc-server";` and call it with your server definition and api metadata definition, as well as the port number on which you want to serve it
```
createApiServer(server, exampleApiMeta, { port: 8888});
```
and the server will listen correctly!

## Metadata & Middleware

TODO

## Streams

TODO
