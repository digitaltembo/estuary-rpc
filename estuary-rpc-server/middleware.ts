import { IncomingMessage, ServerResponse } from "http";
import { join, extname } from "path";
import { promises as fs } from "fs";

import { SimpleMeta, HTTP_STATUS_CODES } from "estuary-rpc";

import {
  errorResponse,
  DEFAULT_NOT_FOUND,
  DEFAULT_INTERNAL_SERVER_ERROR,
} from "./errors";
import { ServerOpts, StaticFileOpts } from "./types";

const MIME_TYPES = {
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".jpeg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

/**
 * Defines a unique string ID for all endpoints
 * @group Server
 */
export function methodId(meta: { method?: string; url?: string }) {
  return `${meta.method}:${meta.url}`;
}

/**
 * Parses the IncomingMessage into the URL object, useful for queryString parsing
 * @param req
 * @group Server
 */
export function getUrl(req: IncomingMessage): URL | undefined {
  let url: URL | undefined;
  try {
    url = new URL(req.url ?? "", `http://${req.headers.host ?? ""}`);
  } catch {}
  return url;
}

const contentCache: Record<string, Buffer | null> = {};
async function cachedDefaultContent(path?: string) {
  if (path === undefined || contentCache[path] === null) {
    return null;
  }
  if (contentCache[path]) {
    return contentCache[path];
  }
  contentCache[path] = await fs.readFile(path).catch(() => null);
  return contentCache[path];
}
/**
 * Method for serving the static file at filePath to a client
 *
 * @group Server
 */
export const serveStatic = async (
  _: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  defaultPath?: string,
  defaultCode?: number
) => {
  const ext = String(extname(filePath)).toLowerCase();

  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const defaultContent = await cachedDefaultContent(defaultPath);

  fs.readFile(filePath)
    .then((content) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    })
    .catch((error) => {
      if (error.code === "ENOENT" || error.code === "EISDIR") {
        res.writeHead(defaultCode ?? HTTP_STATUS_CODES.NOT_FOUND, {
          "Content-Type": defaultContent ? "text/html" : "application/json",
        });
        res.end(defaultContent ?? errorResponse(DEFAULT_NOT_FOUND), "utf-8");
      } else {
        console.log(error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(errorResponse(DEFAULT_INTERNAL_SERVER_ERROR), "utf-8");
      }
    });
};

/**
 * Creates a middleware object for serving static files. See {@link StaticFileOpts} for more detailed information
 * Can't really imagine needing to use this directly, instead you should just define the staticFiles field in the
 * {@link createApiServer}
 * @param staticFileOpts
 * @returns Static File Middles
 *
 * @group Server
 */
export const staticFileMiddleware =
  ({
    defaultFile = "404.html",
    apiPrefixes = [],
    defaultCode = HTTP_STATUS_CODES.NOT_FOUND,
    fileRoot = "./static",
    urlRoot = "",
  }: StaticFileOpts) =>
  async (req: IncomingMessage, res: ServerResponse) => {
    const filePath = join(fileRoot, req.url?.slice(urlRoot.length) ?? "");
    if (
      !req.url?.startsWith(urlRoot) ||
      apiPrefixes.some((prefix) => req.url?.startsWith(prefix))
    ) {
      return true;
    }

    await serveStatic(
      req,
      res,
      filePath,
      join(fileRoot, defaultFile),
      defaultCode
    );
    return false;
  };

/**
 * Gets the list of middlewares given serverOpts
 * @group Server
 */
export function automaticMiddleware<Meta extends SimpleMeta>(
  serverOpts: ServerOpts<Meta>
) {
  return [
    ...(serverOpts.staticFiles
      ? [staticFileMiddleware(serverOpts.staticFiles)]
      : []),
    ...(serverOpts.restMiddleware || []),
  ];
}
