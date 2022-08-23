import { IncomingMessage, ServerResponse } from "http";
import { join, extname } from "path";
import { promises as fs } from "fs";

import {
  errorResponse,
  DEFAULT_NOT_FOUND,
  DEFAULT_INTERNAL_SERVER_ERROR,
} from "./errors";
import HTTP_STATUS_CODES from "../common/statusCodes";
import { SimpleMeta } from "../common/api";
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

export function methodId(meta: { method: string; url: string }) {
  return `${meta.method}:${meta.url}`;
}

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

// If requests match urlRoot, serve the file under fileRoot by that or serve a 404
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
