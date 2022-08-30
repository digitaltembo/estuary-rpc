<img align="center" alt="Estuary-RPC" src="https://user-images.githubusercontent.com/4743325/187557355-dffd76cb-a27c-47eb-b008-1a44fd89157d.png" />
<p align="center">
  <a href="https://github.com/digitaltembo/estuary-rpc/actions/workflows/builld-and-deploy.yaml">
    <img alt="Build & Deploy" 
         src="https://github.com/digitaltembo/estuary-rpc/actions/workflows/builld-and-deploy.yaml/badge.svg">
  </a>
  <a href="https://digitaltembo.github.io/estuary-rpc/coverage/">
    <img alt="Coverage" 
         src="https://img.shields.io/endpoint?url=https://digitaltembo.github.io/estuary-rpc/coverage.json">
  </a>
  <a href="https://www.npmjs.com/package/estuary-rpc">
    <img alt="npm"
         src="https://img.shields.io/npm/v/estuary-rpc">
  </a>
  <a href="https://digitaltembo.github.io/estuary-rpc/">
    <img alt="Documentation" 
         src="https://img.shields.io/static/v1?label=docs&message=passing&color=brightgreen">
  </a>
</p>

Estuary RPC is an attempt to make an extremely simple RPC system in TypeScript for use between browsers and Node.js servers that:

- is typesafe, with all types simply defined in TypeScript - meaning your code won't compile if the server or the client code is not invoked with the correct types for the given RPC call
- supports most desired operations between client and server (REST methods, WebSocket streams, status codes, file uploads, automatic authentication) transparently with respect to the function calls and definitions
- doesn't have external dependencies

As a system, Estuary RPC replaces
- clientside calls to `fetch`, `new XmlHttpRequest()`, and `new WebSocket()` - all such calls just go through a typesafe client object
- serverside use of `Express` and other http servers, `ws` and other WebSocket server, `multer`/`busboy` and other file/form parsing libraries
- full rpc solutions such as `gRPC`

It is NOT and does not endeavor to be a web-framework, specifically being extremely unopinionated about UI frameworks (you just need JS), security (it will parse security tokens from requests, but deciding what to do with them is up to you), or databases.

It was inspired by me passing a JSON object `{"heightCM": 123}` to a server when `{"height": 123}` was needed, and being quite frustrated by the fact that *the main benefit* of using a JS backend is to share types with the frontend, but rarely are the types living on the interface actually enforced.

## Sample Code
As a quick taste, here is how to define a complete typesafe client and server in estuary-rpc:
### Common Code
```ts
import { Api, Endpoint, get, SimpleMeta } from "estuary-rpc";

// define metadata for your interface, to be used by client and server
export const myApiMeta: MyApi<unknown, SimpleMeta> = {
  // foo will be an endpoint that takes a number, returns a string, and will be translated into 
  // a GET request with the number sent over URL form encoding to the url /foo
  foo: get<number, string>("foo"),
};

export type MyApi<Closure, Meta> = ApiTypeOf<Closure, Meta, typeof myApiMeta>;

```
### Server Code
```ts
import { ApiContext, createApiServer } from "estuary-rpc-server";

// endpoint definitions
const myService: MyApi<ApiContext, unknown> = {
  foo: (num: number) => `Server says: ${num}`,
};

// Start listening
createApiServer(myService, myApiMeta, { port: 8080 });
```
### Client Code
```ts
import { createApiClient, FetchOpts } from "estuary-rpc-client";

const client = createApiClient(myApiMeta) as MyApi<FetchOpts, SimpleMeta>;

// logs "Server says: 4"
console.log(await client.foo(4));
```

## Detailed Usage

1. Install into server and client projects: `npm i estuary-rpc estuary-rpc-server` on the server, `npm i estuary-rpc estuary-rpc-client` on the client
2. Implement common code:
    1. Define your API interface type as a generic type with Closure and Metadata generic types, extending [Api](http://digitaltembo.github.io/estuary-rpc/interfaces/estuary_rpc.Api.html) from the estuary-rpc package
    2. (Optional) Define the metadata type you would like to describe endpoints with. If you don't need to expand beyond the functionalities provided by estuary-rpc, just using [SimpleMeta](http://digitaltembo.github.io/estuary-rpc/interfaces/estuary_rpc.SimpleMeta.html) from the estuary-rpc package is sufficient
        - This is where you decide the groupings of RPC endpoints and types of individual endpoints
        - Each endpoint should be defined as an [Endpoint<SomeReq, SomeRes, Closure, Meta>](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.Endpoint.html) type, or if it the endpoint streams data to/from the server, a [StreamEndpoint<SomeReq, SomeRes, Closure, Meta>](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.StreamEndpoint.html). 
    3. Define your API metadata as an object instantiation of your API interface type, with the generics instantiated with an unknown Closure and your custom Metadata
        - Use the [get](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.get.html), [post](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.post.html), [put](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.put.html), [del](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.del.html), or [ws](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.ws.html) functions to easily create the endpoints that you want
3. In the server project
    1. Define your server as an object instantiation of your API interface type, with the generics instantiated to have a Closure of [ApiContext](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc_server.ApiContext.html) and your Metadata type
    2. Call [createApiServer](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_server.createApiServer.html) with your server object, your API metadata object, and [ServerOpts](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc_server.ServerOpts.html) to start the server
4. In the client program, create your estuary-rpc Client object by calling [createApiClient](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_client.createApiClient.html) with your API metadata object
    - You can also pass any additional [ClientOpts](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc_client.ClientOpts.html) here, such as [Authentication information](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.Authentication.html) to be passed with all requests

At either end, you may also want to call [createOpenApiSpec](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.createOpenApiSpec.html) to create an OpenAPI compatible JSON blob, for use in documentation tools such as [Swagger UI](https://github.com/swagger-api/swagger-ui), [ReDoc](https://github.com/Redocly/redoc) and others.

## Other Details
### Metadata & Middleware

Each endpoint must also have metadata associated with it, which is accessible from the clientside or through your API Metadata definition object. This metadata must extend the [SimpleMeta](http://digitaltembo.github.io/estuary-rpc/interfaces/estuary_rpc.SimpleMeta.html) interface:

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
These are defined for you automatically as you construct your API Metadata definition with the [get](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.get.html)/[post](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.post.html)/[put](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.put.html)/[del](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.del.html)/[ws](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.ws.html) objects, although it is possible to override the transport and authentication values on a per-endpoint basis. If you want to use openApi, you will likely additionally want to define values for some of those fields. Lastly, it is possible to extend SimpleMeta with your own data, so you can annotate the interface however you want. After annotating the interface however you want, you may want to act upon that data - 
* On the client side, the apiClient that is created by [createApiClient](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_client.createApiClient.html) will have the metadata in the same object that you use as a function for communicating with the backend:
```
const client = createApiClient(myApiDef);
// prints out "Calling GET /foo/bar"
console.log(`Calling ${client.fooService.bar.method}: ${client.fooService.bar.url}`);
const result = await client.fooService.bar();
```
* On the serverside, you can define middlewares passed into the [createApiServer](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_server.createApiServer.html) method which will act before every endpoint gets called, and be able to determine whether to execute the endpoint:
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

The transport metadata determines the method by which the arguments to the endpoint function are encoded for underlying representation. See [the Transport type definition](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.Transport.html) for an elaboration of what is possible here, but basically trasnport will be one of [Json](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.JsonTransport.html), [UrlFormData](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.UrlFormTransport.html), [MultipartFormData](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.MultipartFormTransport.html) or a custom transport. GET requests default to a UrlFormData transport where the request is encoded in the query string, everything else defaults to JSON passed in the requestBody - all responses default to JSON encoded in the responseBody.

### Authentication Metadata

It is fairly straightforward to build your own authentication process using a custom Metadata type to annotate how individual endpoints should be authenticated, and a custom [Middleware](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc_server.Middleware.html) - but that is not necessarily necessary. There are builtins for simple Basic, Bearer, Cookie, query param, and custom header-based authentication schemas, that encode authentication values passed into the [createApiClient](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_client.createApiClient.html) into the logical parts of the request and in turn parse those values at the server side, for usage, simply 

1. Pass an [Authentication](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.Authentication.html) object without the secret defined in your endpoint definition function (or alternatively, pass it as a `defaultAuthentication` in your [ServerOpts](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc_server.ServerOpts.html) to make the server check authentication by default)
2. Pass an [Authentication](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.Authentication.html) object *with* the secret defined to [createApiClient](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc_client.createApiClient.html) on your client side

Simple example:
```
interface MyApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: Endpoint<string, string, Closure, Meta>;
  bar: Endpoint<string, string, Closure, Meta>;
}
const myApiDef: MyApi<unknown, SimpleMeta> = {
  foo: get('foo', { authentication: { type: 'basic'}}),
  bar: get('bar')
};

function createMyApiClient(currentAuthState: {username: string, password: string}) {
  return createApiClient(myApiDef, { authentication: {type: "Basic", ...currentAuthState } });
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

The format of the metadata that you need to generate for Estuary is already pretty close to what is necessary for an OpenApi spec, which has a good amount of tooling around it - so Estuary provides a [createOpenApiSpec](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.createOpenApiSpec.html) method. Minimal usage is possible by simply calling
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

### Streams

Streaming data is handled via websockets and ends up working a bit differently to the rest of the requests:
* [Basic](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.BasicAuth.html), [Bearer](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.BearerAuth.html), and [Header](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.HeaderAuth.html) authentication schemes won't work, as you can't pass headers into a websocket request from the browser
* [URL_FORM_DATA](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.UrlFormTransport.html) and [MULTIPART_FORM_DATA](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.MultipartFormTransport.html) transports are not supported for what should be fairly clear reasons
* Instead of conceptualizing the endpoint as a thing that takes in a request and returns a response, the endpoints are reprented as unary functions that take in a Duplex which can be read from and written to (and have events attatched)

The [Duplex](http://digitaltembo.github.io/estuary-rpc/classes/estuary_rpc.Duplex.html) object used in these functions contains two streams: [toServer](http://digitaltembo.github.io/estuary-rpc/classes/estuary_rpc.Duplex.html#server) and [toClient](http://digitaltembo.github.io/estuary-rpc/classes/estuary_rpc.Duplex.html#server), representing the streams of data flowing to the server and to the client, respectively. They are probably easiest to interact with via the [client](http://digitaltembo.github.io/estuary-rpc/classes/estuary_rpc.Duplex.html#client) and [server](http://digitaltembo.github.io/estuary-rpc/classes/estuary_rpc.Duplex.html#server) StreamHandlers though, which have methods for writing in one direction and reading from the other. That is, when on the client side you do:
```
const streamHandler = await openStreamHandler(client.foo.simpleStream);

streamHandler.on("message", (val: boolean) =>
  console.log("Got message from server", val);
  streamHandler.write("up");
  streamHandler.close()
);
```
[openStreamHandler](http://digitaltembo.github.io/estuary-rpc/functions/estuary_rpc.openStreamHandler.html) returnes a [StreamHandler](http://digitaltembo.github.io/estuary-rpc/types/estuary_rpc.StreamHandler.html) that is the client representation of a duplex created and passed to `client.foo.simpleStream`, with the message event triggering **on messages from the server** and the streamHandler.write event being encoded and sent in the websocket stream to the server (and the close event, in turn terminating the WS connection).

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
