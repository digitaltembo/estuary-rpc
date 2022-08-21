import {
  Api,
  Transport,
  EndpointDescription,
  SimpleMeta,
  TransportType,
  WsData,
} from "../common/api";
import HTTP_STATUS_CODES from "../common/statusCodes";
import { Duplex } from "../common/stream";

export * from "../common/stream";
export * from "../common/statusCodes";
export * from "../common/api";

export type ClientOpts = {
  ammendXhr?: (xhr: XMLHttpRequest) => void;
};

export type ParamMap = { [key: string]: string };

export type FetchOpts = {
  params?: ParamMap;
  formData?: FormData;
  progressCallback?: (pe: ProgressEvent) => void;
  timeout?: number;
};

export type FetchArgs<T> = FetchOpts & {
  req?: T;
};

export type FetchOptsArg = FetchOpts | void;

export function getUrl(meta: SimpleMeta) {
  const url = new URL(`${document.baseURI}${meta.url}`);
  if (meta.method === "WS") {
    url.protocol = url.protocol === "http:" ? "ws:" : "wss";
  }
  return url;
}

export function superFetch<Req, Res, Meta extends SimpleMeta>(
  req: Req,
  meta: Meta,
  opts: FetchArgs<Req>,
  clientOpts?: ClientOpts
): Promise<Res> {
  return new Promise<Res>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = getUrl(meta);
    if (opts?.params) {
      for (const key of Object.keys(opts.params)) {
        url.searchParams.append(key, opts.params[key]);
      }
    }
    if (meta.transport.transportType === TransportType.URL_FORM_DATA) {
      Object.entries(req ?? {}).map(([key, value]) =>
        url.searchParams.append(key, JSON.stringify(value))
      );
      console.log("encoding as URL_FORM", Object.entries(req), url.toString());
    }
    xhr.open(meta.method, url.toString());
    if (opts?.timeout) {
      xhr.timeout = opts?.timeout;
    }

    if (meta.transport.transportType === TransportType.UNKNOWN) {
      xhr.responseType = "arraybuffer";
    } else {
      xhr.setRequestHeader("Accept", "application/json");
    }

    let body: XMLHttpRequestBodyInit | null = null;
    switch (meta.transport.transportType) {
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
      case TransportType.UNKNOWN:
        xhr.setRequestHeader("Content-Type", meta.transport.contentType);
        if (req !== undefined) {
          body = meta.transport.encode.req(req);
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
            meta.transport.transportType === TransportType.UNKNOWN
              ? meta.transport.decode.res(xhr.responseText)
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
): EndpointDescription<unknown, unknown, FetchArgs<unknown>, Meta> {
  const method = async (req: unknown, opts?: FetchOpts) =>
    superFetch(req, meta, opts ?? {}, clientOpts);
  return Object.assign(method, meta);
}
function createWsEndpoint<Meta extends SimpleMeta>(
  meta: Meta,
  _?: ClientOpts
): EndpointDescription<Duplex<unknown, unknown>, void, FetchOpts, Meta> {
  const method = async (duplex: Duplex<unknown, unknown>) => {
    const { server } = duplex;
    const ws = new WebSocket(getUrl(meta));
    if (meta.transport.transportType === TransportType.UNKNOWN) {
      ws.binaryType = "arraybuffer";
    }
    ws.onmessage = (message: MessageEvent) => {
      server.write(
        meta.transport.transportType === TransportType.UNKNOWN
          ? meta.transport.decode.req(message.data as string)
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
                meta.transport.transportType === TransportType.UNKNOWN
                  ? meta.transport.encode.req(req)
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

export function convertApiClient<
  Meta extends SimpleMeta,
  CustomApi extends Api<unknown, Meta>
>(api: CustomApi, opts?: ClientOpts): Api<FetchOpts, unknown> {
  const fetchApi: Api<FetchOpts, unknown> = {};
  Object.keys(api).forEach((apiName: string) => {
    if (typeof api[apiName] === "function") {
      const meta = api[apiName] as Meta;
      if (meta.method === "WS") {
        fetchApi[apiName] = createWsEndpoint(meta, opts);
      } else {
        fetchApi[apiName] = createRestEndpoint(meta, opts);
      }
    } else {
      fetchApi[apiName] = convertApiClient(
        api[apiName] as Api<unknown, Meta>,
        opts
      );
    }
  });
  return fetchApi;
}
