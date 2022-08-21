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
import { ServerOpts } from "./types";

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
export function incomingMethodId(req: IncomingMessage) {
  return methodId({
    method: req.method ?? "",
    url: getUrl(req)?.pathname?.slice(1) ?? "",
  });
}

export const serveStatic = async (
  _: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  notFoundPath?: string
) => {
  const ext = String(extname(filePath)).toLowerCase();

  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  fs.readFile(filePath)
    .then((content) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    })
    .catch((error) => {
      if (error.code === "ENOENT") {
        const emptyNotFound = () => {
          res.writeHead(HTTP_STATUS_CODES.NOT_FOUND, {
            "Content-Type": "application/json",
          });
          res.end(errorResponse(DEFAULT_NOT_FOUND), "utf-8");
        };
        if (notFoundPath) {
          fs.readFile(notFoundPath)
            .then((content) => {
              res.writeHead(HTTP_STATUS_CODES.NOT_FOUND, {
                "Content-Type": "text/html",
              });
              res.end(content, "utf-8");
            })
            .catch(emptyNotFound);
        } else {
          emptyNotFound();
        }
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(errorResponse(DEFAULT_INTERNAL_SERVER_ERROR), "utf-8");
      }
    });
};
export const staticFileMiddleware =
  (fileRoot: string = ".", urlRoot: string = "/static/") =>
  async (req: IncomingMessage, res: ServerResponse) => {
    const filePath = join(fileRoot, req.url.slice(urlRoot.length));
    if (!req.url.startsWith(urlRoot)) {
      return true;
    }

    await serveStatic(req, res, filePath, join(fileRoot, "404.html"));
    return false;
  };

export const prefixFilterMiddleware =
  (defaultFile: string, ...prefixes: string[]) =>
  async (req: IncomingMessage, res: ServerResponse) => {
    if (prefixes.some((prefix) => req.url.startsWith(prefix))) {
      return true;
    }
    await serveStatic(req, res, defaultFile);
    return false;
  };

export function automaticMiddleware<Meta extends SimpleMeta>(
  serverOpts: ServerOpts<Meta>
) {
  return [
    ...(serverOpts.staticFiles
      ? [
          staticFileMiddleware(
            serverOpts.staticFiles.fileRoot,
            serverOpts.staticFiles.urlRoot
          ),
        ]
      : []),
    ...(serverOpts.servePrefixes
      ? [
          prefixFilterMiddleware(
            serverOpts.servePrefixes.defaultFile,
            ...serverOpts.servePrefixes.prefixes
          ),
        ]
      : []),
    ...(serverOpts.restMiddleware || []),
  ];
}
