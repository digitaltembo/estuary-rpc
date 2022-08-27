# Estuary RPC Server

Estuary RPC is an attempt to make an extremely simple (toy) RPC system for use between browsers and servers that:

- is typesafe, with all types simply defined in TS - meaning your code won't compile if the server or the client code is not invoked with the correct types for the given RPC call
- supports most desired operations between client and server (REST methods, status codes, file uploads, automatic authentication)
- doesn't have external dependencies

# This Package

`estuary-rpc-server` defines the `createApiServer` method for translating your API metadata definition into a and typesafe collection of async functions organized into a functioning HTTP and WS server

# Installation
This should be installed in your server project
```
npm install estuary-rpc-server
```

# Usage

After following instructions for your common code, on the serverside, you need to instantiate an object that implements your Api with an ApiContext closure (so your endpoints can have access to the raw request/response and helper error methods) and an unknown metadata:
```
const server: ExampleApi<ApiContext, unknown> = {
  foo: {
    emptyPost: async () => {
      console.log("got post");
    },
    simpleGet: async (num: number) => 4,
    simpleStream: async ({ server }: Duplex<string, boolean>) => {
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
