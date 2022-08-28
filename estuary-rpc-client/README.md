# Estuary RPC Client

Estuary RPC is an attempt to make an extremely simple (toy) RPC system for use between browsers and servers that:

- is typesafe, with all types simply defined in TS - meaning your code won't compile if the server or the client code is not invoked with the correct types for the given RPC call
- supports most desired operations between client and server (REST methods, status codes, file uploads, automatic authentication)
- doesn't have external dependencies

# This Package

`estuary-rpc-client` defines the [createApiClient](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_client.createApiClient.html) method for translating your API metadata definition into a typesafe collection of async functions organized into a neat little object

# Installation
This should be installed in your client project
```
npm install estuary-rpc-client
```

# Usage

After following instructions for your common code, from the clientside, it is necessary merely to `import { convertApiClient, ClientClosure } from "estuary-rpc-client";` and import your common definitions, and you will be able to create an instantion of your Api type with callable rpc methods:
```ts
const client = convertApiClient(exampleApiMeta) as ExampleApi<ClientClosure, unknown>;
```

`ClientClosure` serves as the closure to the individual calls, should it be necessary to add additional calling options such as a timeout. The methods can then be called with
* `await client.foo.emptyPost()` to send an empty post message
* `const res = await client.foo.simpleGet(4);` to retrieve a number response from the server
* `const res = await client.foo.simpleGet(4, {timeout: 1000});` to set a timeout on that fetch call
* Streaming is a bit more complicated, but I have tried to make it as straightforward as possible - 

```ts
import { openStreamHandler } from "estuary-rpc";

const streamHandler = await openStreamHandler(client.foo.simpleStream);

streamHandler.on("message", (val: boolean) =>
  console.log("Got message from server", val);
  streamHandler.close()
);
streamHandler.write("yooo");
```
  * `openStreamHandler` serves as a bit of a simplification of the underlying use of the RPC method, which works natively like so:
```ts
import { Duplex } from "estuary-rpc";

const duplex = new Duplex<string, boolean>();
await client.foo.simpleStream(duplex);

const streamHandler = duplex.client;
streamHandler.on("message", (val: boolean) => {
  console.log("Got message from server", val);
  simpleStream.close()
});
streamHandler.write("yooo");
```
