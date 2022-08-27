import {
  Api,
  ClientOpts,
  createApiClient,
  Endpoint,
  FetchOpts,
  FetchOptsArg,
  get,
  HTTP_STATUS_CODES,
  openStreamHandler,
  post,
  SimpleMeta,
  StreamEndpoint,
  ws,
} from "./client";

test("metadata is conveyed", () => {
  const client = createApiClient({ foo: get("test") });
  expect(client.foo.url).toBe("test");
});

let oldXhr: any = null;

let xhrMock: any = null;
beforeEach(() => {
  const xhrMockClass = (opts) => {
    xhrMock = {
      open: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      setRequestHeader: jest.fn(),
      opts,
    };
    return xhrMock;
  };
  oldXhr = global.XMLHttpRequest;
  global.XMLHttpRequest = jest.fn().mockImplementation(xhrMockClass) as any;
  global.WebSocket = jest.fn().mockImplementation(xhrMockClass) as any;
  global.document = { baseURI: "http://localhost/" } as any;
});

afterEach(() => {
  global.XMLHttpRequest = oldXhr;
});

export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
  foo: FooService<Closure, Meta>;
}
type NestedObj = { a: { b: string[] } };
export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
  simpleGet: Endpoint<NestedObj | number | undefined, number, Closure, Meta>;
  simplePost: Endpoint<string, string, Closure, Meta>;
  simpleStream: StreamEndpoint<string, boolean, Closure, Meta>;
}

const apiMeta: ExampleApi<unknown, SimpleMeta> = {
  foo: {
    simpleGet: get("get"),
    simpleStream: ws("ws"),
    simplePost: post("post"),
  },
};

const client = (opts?: ClientOpts) =>
  createApiClient(apiMeta, opts) as ExampleApi<FetchOptsArg, SimpleMeta>;

async function call<T>(promise: T, status: number, response: any) {
  xhrMock.status = status;
  xhrMock.responseText = JSON.stringify(response);
  xhrMock.onload();
  return promise;
}

async function open<T>(promise: T) {
  xhrMock.onopen();
  return promise;
}

test("Simple Empty Get", async () => {
  const empty = await call(
    client().foo.simpleGet(undefined),
    HTTP_STATUS_CODES.NO_CONTENT,
    5
  );
  expect(xhrMock.open).toHaveBeenCalledWith("GET", "http://localhost/get");
  // The return value is ignored if the status is NO_CONTENT
  expect(empty).toBeUndefined();
});

test.each`
  auth                                                   | headers                                    | other
  ${{ type: "basic", username: "foo", password: "bar" }} | ${["Authorization", "Basic Zm9vOmJhcg=="]} | ${false}
  ${{ type: "bearer", token: "foo" }}                    | ${["Authorization", "Bearer foo"]}         | ${false}
  ${{ type: "header", keyPair: ["X-Foo", "bar"] }}       | ${["X-Foo", "bar"]}                        | ${false}
  ${{ type: "query", keyPair: ["xFoo", "bar"] }}         | ${false}                                   | ${() => expect(xhrMock.open).toHaveBeenCalledWith("GET", "http://localhost/get?xFoo=bar")}
`("GET $auth.type Authentication", async ({ auth, headers, other }) => {
  await call(
    client({
      authentication: auth,
    }).foo.simpleGet(undefined),
    HTTP_STATUS_CODES.NO_CONTENT,
    5
  );
  if (headers) {
    expect(xhrMock.setRequestHeader).toHaveBeenCalledWith(...headers);
  }
  if (other) {
    other();
  }
});

test("Get With url encoded params", async () => {
  const simple = await call(client().foo.simpleGet(5), HTTP_STATUS_CODES.OK, 6);
  expect(xhrMock.open).toHaveBeenCalledWith(
    "GET",
    "http://localhost/get?_es_data=5"
  );
  expect(simple).toBe(6);
});

test("Get with url encoded object params", async () => {
  const obj = await call(
    client().foo.simpleGet({ a: { b: ["hi"] } }),
    HTTP_STATUS_CODES.OK,
    7
  );
  // URL encoding of nested objects gets a bit involved
  expect(xhrMock.open).toHaveBeenCalledWith(
    "GET",
    "http://localhost/get?a=%7B%22b%22%3A%5B%22hi%22%5D%7D"
  );
  expect(obj).toBe(7);
});

test("Simple post", async () => {
  const empty = await call(
    client().foo.simplePost("hi"),
    HTTP_STATUS_CODES.NO_CONTENT,
    "wow"
  );
  expect(xhrMock.open).toHaveBeenCalledWith("POST", "http://localhost/post");
  // The return value is ignored if the status is NO_CONTENT
  expect(empty).toBeUndefined();
});

test("Simple post data", async () => {
  const result = await call(
    client().foo.simplePost("hi"),
    HTTP_STATUS_CODES.OK,
    "wow"
  );
  expect(xhrMock.open).toHaveBeenCalledWith("POST", "http://localhost/post");
  // The return value is ignored if the status is NO_CONTENT
  expect(result).toBe("wow");
});

test("Simple WebSocket", async () => {
  const streamHandler = await open(
    openStreamHandler(client().foo.simpleStream)
  );
  streamHandler.write("hi");
  expect(xhrMock.send).toHaveBeenCalledWith('"hi"');
});
