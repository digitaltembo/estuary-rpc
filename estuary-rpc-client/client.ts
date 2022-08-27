import {
  Api,
  Authentication,
  Endpoint,
  SimpleMeta,
  TransportType,
  URL_FORM_DATA_KEY,
  HTTP_STATUS_CODES,
  Duplex,
} from "estuary-rpc";

export * from "estuary-rpc";

/**
 * Basic options passed on the creation of an API client with {@link createApiClient}
 * @group Client
 */
export type ClientOpts = {
  /**
   * Maps over all XmlHttpRequests going out from estuary-rpc-client before they are opened,
   * allowing for additional modifications/callbacks
   */
  ammendXhr?: (xhr: XMLHttpRequest) => void;
  /** Authentication data to be attatched to XmlHttpRequests */
  authentication?: Authentication | Authentication[];
};

/**
 * FetchOpts are the "closure" and the optional second argument to all client endpoint function calls, used to
 * modify how estuary-rpc-client constructs the XmlHttpRequest
 * @group Client
 */
export type FetchOpts = {
  params?: Record<string, string>;
  formData?: FormData;
  progressCallback?: (pe: ProgressEvent) => void;
  timeout?: number;
};

/** Generic version of FetchOpts with the request object */
export type FetchArgs<T> = FetchOpts & {
  req?: T;
};

/**
 * This is necessary so that we can make API request with an empty argument list, instead of having
 * to pass undefined everytime we don't care about the request type
 * @group Client
 */
export type FetchOptsArg = FetchOpts | void;

/** Returns the URL of a given metadata */
export function getUrl(meta: SimpleMeta) {
  const url = new URL(`${document.baseURI}${meta.url}`);
  if (meta.method === "WS") {
    url.protocol = url.protocol === "http:" ? "ws:" : "wss";
  }
  return url;
}

/**
 * Invokes a XMLHTTPRequest given a request object, metadata, the closure of opts, and the global clientOpts
 * @param req request body
 * @param meta endpoint metadata
 * @param opts closure for containing information such as timeout
 * @param clientOpts options for the entire API client, such as authentication
 * @returns Promise<Res> resolving to the response type of the endpoint
 *
 * @group Client
 */
export function superFetch<Req, Res, Meta extends SimpleMeta>(
  req: Req,
  meta: Meta,
  opts: FetchArgs<Req>,
  clientOpts?: ClientOpts
): Promise<Res> {
  const transport = meta.transport || { transportType: TransportType.JSON };

  const auths = clientOpts?.authentication
    ? Array.isArray(clientOpts.authentication)
      ? clientOpts.authentication
      : [clientOpts.authentication]
    : [];

  return new Promise<Res>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = getUrl(meta);
    if (opts?.params) {
      for (const key of Object.keys(opts.params)) {
        url.searchParams.append(key, opts.params[key]);
      }
    }
    if (
      transport.transportType === TransportType.URL_FORM_DATA &&
      req != null
    ) {
      // pinky swear that req is of type Record<string, unknown>
      if (typeof req === "object") {
        Object.entries(req ?? {}).map(([key, value]) =>
          url.searchParams.append(
            key,
            // and rawStrings actually means it should be Record<string, string>
            transport.rawStrings ? String(value) : JSON.stringify(value)
          )
        );
      } else {
        url.searchParams.append(
          URL_FORM_DATA_KEY,
          transport.rawStrings ? String(req) : JSON.stringify(req)
        );
      }
    }
    auths.forEach((auth) => {
      if (auth?.type === "query") {
        url.searchParams.append(auth.keyPair[0], auth.keyPair[1] ?? "");
      }
    });

    xhr.open(meta.method, url.toString());
    if (opts?.timeout) {
      xhr.timeout = opts?.timeout;
    }

    if (transport.transportType === TransportType.UNKNOWN) {
      xhr.responseType = "arraybuffer";
    } else {
      xhr.setRequestHeader("Accept", "application/json");
    }

    let body: XMLHttpRequestBodyInit | null = null;
    auths.forEach((auth) => {
      switch (auth?.type) {
        case "basic":
          const { username, password } = auth;
          xhr.setRequestHeader(
            "Authorization",
            `Basic ${btoa(`${username}:${password}`)}`
          );
          break;
        case "bearer":
          xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
          break;
        case "header":
          xhr.setRequestHeader(auth.keyPair[0], auth.keyPair[1] ?? "");
          auth;
          break;
      }
    });
    switch (transport.transportType) {
      case TransportType.JSON:
        xhr.setRequestHeader("Content-Type", "application/json");
        body = JSON.stringify(req) as string;
        break;
      case TransportType.URL_FORM_DATA:
        xhr.setRequestHeader(
          "Content-Type",
          "application/x-www-form-urlencoded"
        );
        break;
      case TransportType.MULTIPART_FORM_DATA:
        // pinky swear that req is of type Record<string, unknown>
        const formData = new FormData();
        if (req instanceof File) {
          formData.append(URL_FORM_DATA_KEY, req);
        } else if (typeof req !== "object") {
          // why are you using multipart form data then??
          formData.append(
            URL_FORM_DATA_KEY,
            transport.rawStrings ? String(req) : JSON.stringify(String(req))
          );
        } else {
          Object.entries(
            req as unknown as Record<string, string | Blob>
          ).forEach(([key, value]) => {
            if (value)
              formData.append(
                key,
                value instanceof File || transport.rawStrings
                  ? value
                  : JSON.stringify(value)
              );
          });
        }
        body = formData;
        break;
      case TransportType.UNKNOWN:
        xhr.setRequestHeader("Content-Type", transport.contentType);
        if (req !== undefined) {
          body = transport.encode.req(req);
        }
        break;
    }

    xhr.onload = () => {
      if (xhr.status === HTTP_STATUS_CODES.NO_CONTENT) {
        resolve(undefined as unknown as Res);
      } else if (xhr.status === HTTP_STATUS_CODES.OK) {
        try {
          // All non-custom-encoded server responses should be JSON
          const parsedResponse =
            transport.transportType === TransportType.UNKNOWN
              ? transport.decode.res(xhr.responseText)
              : JSON.parse(xhr.responseText);
          resolve(parsedResponse as unknown as Res);
        } catch (err: any) {
          reject(err);
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          if (errorResponse.message) {
            reject(new Error(errorResponse.message));
          }
        } catch (err: any) {
          reject(err);
        }
      }
    };

    xhr.onerror = () => reject(new Error("Caught error!"));

    xhr.ontimeout = () => reject(new Error("Timeout!!"));

    if (opts.progressCallback) {
      xhr.upload.onprogress = opts.progressCallback;
    }
    clientOpts?.ammendXhr?.(xhr);

    xhr.send(body);
  });
}

function createRestEndpoint<Meta extends SimpleMeta>(
  meta: Meta,
  clientOpts?: ClientOpts
): Endpoint<unknown, unknown, FetchArgs<unknown>, Meta> {
  const method = async (req: unknown, opts?: FetchOpts) =>
    superFetch(req, meta, opts ?? {}, clientOpts);
  return Object.assign(method, meta);
}
function createWsEndpoint<Meta extends SimpleMeta>(
  meta: Meta,
  _?: ClientOpts
): Endpoint<Duplex<unknown, unknown>, void, FetchOpts, Meta> {
  const transport = meta.transport || { transportType: TransportType.JSON };

  const method = async (duplex: Duplex<unknown, unknown>) => {
    const { server } = duplex;
    const ws = new WebSocket(getUrl(meta));
    if (transport.transportType === TransportType.UNKNOWN) {
      ws.binaryType = "arraybuffer";
    }
    ws.onmessage = (message: MessageEvent) => {
      server.write(
        transport.transportType === TransportType.UNKNOWN
          ? transport.decode.req(message.data as string)
          : JSON.parse(message.data as string)
      );
    };
    ws.onerror = (ev: Event) => server.error(new Error(ev.toString()));
    ws.onclose = server.close;

    duplex.closeServer();
    await new Promise<void>(
      (resolve) =>
        (ws.onopen = () => {
          server.addListener({
            onMessage: (req: unknown) =>
              ws.send(
                transport.transportType === TransportType.UNKNOWN
                  ? transport.encode.req(req)
                  : JSON.stringify(req)
              ),
            onError: (err: Error) =>
              console.warn("Encountered error in WS connecion", err),
            onClose: () => ws.close(),
          });
          resolve();
        })
    );
  };

  return Object.assign(method, meta);
}

/**
 * createApiClient is the primary method by your client will interact with estuary-rpc (unless you also want to generate
 * an OpenApi spec with {@link estuary-rpc!createOpenApiSpec} and use that)
 *
 * @param Meta Your custom Metadata class, or just {@link estuary-rpc!SimpleMeta}
 * @param CustomApi Your API definition type, shared in common with your server
 * @param api Your API Metadata definition, shared in common with your server
 * @param opts Options for the estuary-rpc-client to use in constructing the underlying HTTP/WS request (most
 * usefully containing an {@link estuary-rpc!Authentication}
 * @returns Your API Client object, chalk full of correctly typed callable endpoints
 *
 * @group Client
 *
 * @example
 * ```ts
 * // Common Code
 * export interface ExampleApi<Closure, Meta> extends Api<Closure, Meta> {
 *   foo: FooService<Closure, Meta>;
 *   fileUpload: Endpoint<void, void, Closure, Meta>;
 * }
 *
 * export interface FooService<Closure, Meta> extends Api<Closure, Meta> {
 *   emptyPost: Endpoint<void, void, Closure, Meta>;
 *   simpleGet: Endpoint<number, number, Closure, Meta>;
 *   simpleStream: StreamDesc<string, boolean, Closure, Meta>;
 * }
 *
 * export const exampleApiMeta: ExampleApi<never, ExampleMeta> = {
 *   foo: {
 *     emptyPost: post("foo/emptyPost"),
 *     simpleGet: get("foo/simpleGet", { authentication: "bearer", token: "" }),
 *     simpleStream: ws("foo/simpleStream"),
 *   },
 *   fileUpload: post("fileUpload", { uploads: ["someFile.txt"] }),
 * };
 *
 * // Client Code
 * const client = createApiClient(exampleApiMeta, {authentication: "bearer", token: "foo"});
 * // posts data, returns nothing
 * await client.foo.emptyPost();
 * // Gets from server, using Bearer Authentication
 * const a = client.foo.simpleGet("hello");
 * // Streams data from the server
 * streamHandler.on("message", (val: boolean) =>
 *   console.log("Got message from server", val);
 *   streamHandler.close()
 * );
 * streamHandler.write("yooo");
 * ```
 */
export function createApiClient<
  Meta extends SimpleMeta,
  CustomApi extends Api<unknown, Meta>
>(api: CustomApi, opts?: ClientOpts): Api<FetchOpts, Meta> {
  const fetchApi: Api<FetchOpts, Meta> = {};
  Object.keys(api).forEach((apiName: string) => {
    if (typeof api[apiName] === "function") {
      const meta = api[apiName] as Meta;
      if (meta.method === "WS") {
        fetchApi[apiName] = createWsEndpoint(meta, opts);
      } else {
        fetchApi[apiName] = createRestEndpoint(meta, opts);
      }
    } else {
      fetchApi[apiName] = createApiClient(
        api[apiName] as Api<unknown, Meta>,
        opts
      );
    }
  });
  return fetchApi;
}
