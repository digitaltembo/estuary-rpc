import { IncomingMessage } from "http";
import { getUrl } from "./middleware";

import { Authentication } from "../common/api";

export function getCookies(request: IncomingMessage): Record<string, string> {
  return (request.headers?.cookie?.split?.(`;`) ?? []).reduce(
    (cookies, cookie) => {
      let [name, ...rest] = cookie.split(`=`);
      name = name?.trim();
      if (!name) {
        return cookies;
      }
      const value = rest.join(`=`).trim();
      if (!value) {
        return cookies;
      }
      cookies[name] = decodeURIComponent(value);
      return cookies;
    },
    {}
  );
}
export function isAuthenticated(
  incoming: IncomingMessage,
  metaAuth?: Authentication,
  authenticate?: (authentication: Authentication) => boolean
): [boolean, Authentication | undefined] {
  let auth: Authentication | undefined = undefined;
  if (!metaAuth || !authenticate) {
    return [true, auth];
  }
  switch (metaAuth.type) {
    case "basic":
      const [username, password] = Buffer.from(
        incoming.headers["authorization"]?.split?.("Basic ")?.[1] ?? "",
        "base64"
      )
        .toString()
        .split(":");
      auth = { ...metaAuth, username, password: password ?? "" };
      return [authenticate(auth), auth];

    case "bearer":
      const token =
        incoming.headers["authorization"]?.split("Bearer ")?.[1] ?? "";
      auth = { ...metaAuth, token };
      return [authenticate(auth), auth];

    case "header":
      const header = metaAuth.keyPair[0];
      const headerValue = incoming.headers[header]?.[0] ?? "";
      auth = { ...metaAuth, [header]: headerValue };
      return [authenticate(auth), auth];

    case "query":
      const query = metaAuth.keyPair[0];

      const queryValue = getUrl(incoming)?.searchParams?.get?.(query) ?? "";
      auth = { ...metaAuth, [query]: queryValue };
      return [authenticate(auth), auth];

    case "cookie":
      const cookie = metaAuth.keyPair[0];
      const cookieValue = getCookies(incoming)?.[cookie] ?? "";
      auth = { ...metaAuth, [cookie]: cookieValue };
      return [authenticate(auth), auth];
  }
}
