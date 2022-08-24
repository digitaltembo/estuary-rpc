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


### Usage - Server
On the serverside, you need to instantiate an object that implements your Api with an ApiContext closure (so your endpoints can have access to the raw request/response and helper error methods) and an unknown metadata:
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

## Metadata & Middleware

Each endpoint must also have metadata associated with it, which is accessible from the clientside or through your ApiDefinition object. This metadata must extend the SimpleMeta interface defined in common/api.ts

```
interface SimpleMeta {
  method: Method;
  url: string;
  transport?: Transport<unknown, unknown>;
  authentication?: Authentication;

  // Used for OpenAPI docs
  example?: [reqBody: unknown, resBody: unknown];
  reqSchema?: Schema;
  resSchema?: Schema;
  summary?: string;
  description?: string;
  swagger?: Record<string, unknown>;
}
```
These are defined for you automatically as you construct your ApiDefinition with the get/post/put/del/ws objects, although it is possible to override the transport and authentication values on a per-endpoint basis. If you want to use openApi, you will likely additionally want to define values for some of those fields. Lastly, it is possible to extend SimpleMeta with your own data, so you can annotate the interface however you want. After annotating the interface however you want, you may want to act upon that data - 
* On the client side, the apiClient that is created by `createApiClient` will have the metadata in the same object that you use as a function for communicating with the backend:
```
const client = createApiClient(myApiDef);
// prints out "Calling GET /foo/bar"
console.log(`Calling ${client.fooService.bar.method}: ${client.fooService.bar.url}`);
const result = await client.fooService.bar();
```
* On the serverside, you can define middlewares passed into the `createApiServer` method which will act before every endpoint gets called, and be able to determine whether to execute the endpoint:
```
const serverDef = {
  fooService: { bar: () => "cool"}
};
const myMiddleware = (context: ApiContex, meta: SimpleMeta) => {
  // block all requests from Jeff;
  if(context.authentication?.username !== "Jeff" || meta.url.contains("Jeff")) {
    context.badRequest("No Jeff's allowed");
    return false;
  }
  return true;
}
createApiServer(serverDef, myApiDef, { middlewares: [myMiddleware]});
```

### Transport Metadata

The transport metadata determines the method by which the arguments to the endpoint function are encoded for underlying representation. They should be one of the following:
```
// Default transport used
export type JsonTransport = { transportType: TransportType.JSON };

// Encode request values in the queryString, with most values still JSON encoded and put there
export type UrlFormTransport = {
  transportType: TransportType.URL_FORM_DATA;
  // set this to true to treat it as a Record<string, string> instead of trying to parse as JSON
  rawStrings?: boolean;
};
// Encode request values in multipart/form-data, should be used for any file transmission
export type MultipartFormTransport = {
  transportType: TransportType.MULTIPART_FORM_DATA;
  // set true to persist data to disk instead of just parsing it after the fact
  persist?: boolean;
  // set this to true to treat it as a Record<string, string> instead of trying to parse as JSON
  rawStrings?: boolean;
};
// Build your own Transport! Must provide definitions for encoding and decoding the Req and Res types
// to Uint8Array.
export type UnknownBinaryTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: true;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};
// Build your own Transport! Must provide definitions for encoding and decoding the Req and Res types
// to string.
export type UknownStringTransport<Req, Res> = {
  transportType: TransportType.UNKNOWN;
  isBinary: false | undefined;
  contentType: string;
  encode: Encoder<Req, Res, WsData>;
  decode: Decoder<Req, Res, WsData>;
};
```

### Authentication Metadata

It is fairly straightforward to build your own authentication process, but there are builtins for simple Basic, Bearer, Cookie, query param, and custom header-based authentication schemas, that encode authentication values passed into the `createApiClient` into the logical parts of the request and in turn parse those values at the server side. Authentication Metadata must look like one of these:
```

export type BasicAuth = {
  type: "basic";
  username: string;
  password: string;
};
export type BearerAuth = {
  type: "bearer";
  token: string;
};
export type HeaderAuth = {
  type: "header";
  keyPair: [string, string] | [string];
};
export type QueryAuth = {
  type: "query";
  keyPair: [string, string] | [string];
};
export type CookieAuth = {
  type: "cookie";
  keyPair: [string, string] | [string];
};
```

Note that when specifying the metadata, it is necessary to put in a value for some of those secrets - this is just done to make it easier to reuse the types, and an empty string will not make a functional difference.

Usage would be as follows:

```
interface MyApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: EndpointDesc<string, string, Closure, Meta>;
  bar: EndpointDesc<string, string, Closure, Meta>;
}
const myApiDef: MyApi<unknown, SimpleMeta> = {
  foo: get('foo', { authentication: { type: 'basic', username: '', password: ''}}),
  bar: get('bar')
};

function createMyApiClient(currentAuthState) {
  return createApiClient(myApiDef, { authentication: currentAuthState });
}
...

function authenticate(auth: Authentication) {
  if (auth.type === "basic") {
    return auth.username === "blah" && auth.password === "blah";
  } else if (auth.type === "query") {
    // perform default authentication on all endpoints not otherwise specified
    // only allowing requests with ?queryKey=awesome
    return auth.keyPair[1] === "awesome";
  }
}
createApiServer(serverDefs, myApiDef, { defaultAuthentication: { type: 'query', keyPair: ['queryKey'] } })
```

### OpenAPI

The format of the metadata that you need to generate for Estuary is already pretty close to what is necessary for an OpenApi spec, which has a good amount of tooling around it - so Estuary provides a `createOpenApiSpec` method. Minimal usage is possible by simply calling
```
const spec = createOpenApiSpec(exampleApiMeta, {
  info: {
    title: "Example API",
    version: "foo.bar",
  },
});
```

and using that resultant spec in tooling provided by the swagger-ui, swagger-ui-react, or swagger-ui-dist tools. Arbitrary JSON can be added to the second argument to extend the generated spec with additional OpenApi tooling, 
such as custom components or servers, etc - [more details here](https://swagger.io/docs/specification/basic-structure/). Additionally, it is possible to provide specific endpoint-level metadata in your api definition, of the type
```
{
  // Simplest way to do it, provide example request/responses and Estuary will put forth a minimal description
  // of those types in a friendly way for OpenApi
  example?: [reqBody: unknown, resBody: unknown];
  // Or just give proper descriptions of the Request and Response types according to the [Schema Object](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#schemaObject) definition
  // Small note here - Estuary will automatically convert a Request object definition to a list of parameters
  // if the encoding type is URL_FORM_ENCODED
  reqSchema?: Schema;
  resSchema?: Schema;
  summary?: string;
  description?: string;
  // Or just give a proper description of the entire endpoint. Hopefully the fields above are easier to use and 
  // almost fully functional
  swagger?: Record<string, unknown>;
}
```

See the example client for an example of use

## Streams

Streaming data is handled via websockets and ends up working a bit differently to the rest of the requests:
* Basic, Bearer, and Header authentication schemes won't work, as you can't pass headers into a websocket request from the browser
* URL_FORM_DATA and MULTIPART_FORM_DATA transports are not supported for what should be fairly clear reasons
* Instead of conceptualizing the endpoint as a thing that takes in a request and returns a response, the endpoints are reprented as unary functions that take in a Duplex which can be read from and written to (and have events attatched)

The Duplex object used in these functions contains two streams: `toServer` and `toClient`, representing the streams of data flowing to the server and to the client, respectively. They are probably easiest to interact with via the StreamHandlers though, which have methods for writing in one direction and reading from the other. That is, when on the client side you do:
```
const streamHandler = await openStreamHandler(client.foo.simpleStream);

streamHandler.on("message", (val: boolean) =>
  console.log("Got message from server", val);
  streamHandler.write("up");
  streamHandler.close()
);
```
The returned streamHandler is the client representation of a duplex created and passed to `client.foo.simpleStream`, with the message event triggering **on messages from the server** and the streamHandler.write event being encoded and sent in the websocket stream to the server (and the close event, in turn terminating the WS connection).

Likewise on the server, when you define a method it is easiest to do something like

```
simpleStream: async ({ server }: Duplex<string, boolean>) => {
  server.on("message", (input: string) => {
    console.log("Got message", input);
    server.write(input === "foo");
  });
},
```

Where the server view of the duplex is reading from the client and writing to the server. Because the high-level design of Estuary is such that the type of the method should be the same on the client as on the server, you technically must have access to the same interface on both sides - but accessing the client interface on the server or vice versa will result in messages being written to streams that don't otherwise have listeners on them (and vice versa).
