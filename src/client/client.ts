import {
  Api,
  Encoders,
  EndpointDescription,
  JSON_ENCODER,
  SimpleMeta,
  WsData,
} from "../common/api";
import HTTP_STATUS_CODES from "../common/statusCodes";
import { BiDiStream } from "../common/stream";

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
  json?: T;
};

export type FetchOptsArg = FetchOpts | void;

export function getUrl(meta: SimpleMeta) {
  const url = new URL(`${document.baseURI}api/${meta.url}`);
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
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = getUrl(meta);
    if (opts?.params) {
      for (const key of Object.keys(opts.params)) {
        url.searchParams.append(key, opts.params[key]);
      }
    }
    xhr.open(meta.method, url.toString());
    if (opts.timeout) {
      xhr.timeout = opts.timeout;
    }
    const encoders = (meta.encoders as Encoders<Req, Res>) ?? {
      isBinary: false,
      rest: JSON_ENCODER,
    };

    if (encoders.isBinary) {
      xhr.responseType = "arraybuffer";
    } else {
      xhr.setRequestHeader("Accept", "application/json");
    }

    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      xhr.setRequestHeader("Content-Type", "application/json");
      body = encoders.rest?.fromReq(opts.json);
    } else if (opts.formData) {
      body = opts.formData;
    }

    xhr.onload = () => {
      if (xhr.status === HTTP_STATUS_CODES.NO_CONTENT) {
        resolve(null);
      } else {
        try {
          const parsedResponse = encoders.rest?.toRes(xhr.responseText);
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
): EndpointDescription<unknown, unknown, unknown, Meta> {
  const method = async (req: unknown, opts?: FetchOpts) =>
    superFetch(req, meta, opts, clientOpts);
  return Object.assign(method, meta);
}
function createWsEndpoint<Meta extends SimpleMeta>(
  meta: Meta,
  _?: ClientOpts
): EndpointDescription<BiDiStream<unknown, unknown>, void, FetchOpts, Meta> {
  const encoders = (meta.encoders as Encoders<unknown, unknown>) ?? {
    isBinary: false,
    ws: JSON_ENCODER,
  };

  const method = async (bidi: BiDiStream<unknown, unknown>) => {
    const { server } = bidi;
    const ws = new WebSocket(getUrl(meta));
    if (!encoders.isBinary) {
      ws.binaryType = "arraybuffer";
    }
    ws.onmessage = (message: MessageEvent) => {
      server.write(encoders.ws.toRes(message as unknown as string));
    };
    ws.onerror = (ev: Event) => server.error(new Error(ev.toString()));
    ws.onclose = server.close;

    server.addListener({
      onMessage: (req: unknown) => ws.send(encoders.ws.fromReq(req) as WsData),
      onError: (err: Error) =>
        console.warn("Encountered error in WS connecion", err),
      onClose: () => ws.close(),
    });
    bidi.closeServer();
  };

  return Object.assign(method, meta);
}

export function convertApiClient<
  Meta extends SimpleMeta,
  CustomApi extends Api<never, Meta>
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
        fetchApi[apiName] as Api<unknown, Meta>,
        opts
      );
    }
  });
  return fetchApi;
}
