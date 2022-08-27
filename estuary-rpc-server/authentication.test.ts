import { IncomingMessage } from "http";
import { getCookies, isAuthenticated } from "./authentication";

test.each`
  description          | cookieHeader             | cookies
  ${"No Cookies"}      | ${undefined}             | ${{}}
  ${"Simple Cookie"}   | ${"foo=bar"}             | ${{ foo: "bar" }}
  ${"Complex Cookies"} | ${"A=; b=c; d=f=g; h;;"} | ${{ b: "c", d: "f=g" }}
`(
  "getCookies, when given $description, parses $cookieHeader as $cookies",
  ({ cookieHeader, cookies }) => {
    expect(
      getCookies({
        headers: { cookie: cookieHeader },
      } as unknown as IncomingMessage)
    ).toMatchObject(cookies);
  }
);

test.each`
  description    | headers                                            | metaAuth                                     | authentication
  ${"Skipping "} | ${{}}                                              | ${undefined}                                 | ${undefined}
  ${"Basic"}     | ${{ authorization: "Basic ZGVtbzpwQDU1dzByZA==" }} | ${{ type: "basic" }}                         | ${{ type: "basic", username: "demo", password: "p@55w0rd" }}
  ${"Bearer"}    | ${{ authorization: "Bearer Foo" }}                 | ${{ type: "bearer" }}                        | ${{ type: "bearer", token: "Foo" }}
  ${"Header"}    | ${{ "X-Custom": ["Wow"] }}                         | ${{ type: "header", keyPair: ["X-Custom"] }} | ${{ type: "header", keyPair: ["X-Custom", "Wow"] }}
  ${"Cookie"}    | ${{ cookie: "custom=Wow" }}                        | ${{ type: "cookie", keyPair: ["custom"] }}   | ${{ type: "cookie", keyPair: ["custom", "Wow"] }}
  ${"Query"}     | ${{ host: "localhost", url: "?custom=Wow" }}       | ${{ type: "query", keyPair: ["custom"] }}    | ${{ type: "query", keyPair: ["custom", "Wow"] }}
`(
  "isAuthenticated with $description Auth, with headers $headers, returns $authentication",
  ({ headers, metaAuth, authentication }) => {
    const callback = () => true;
    const [authd, authObj] = isAuthenticated(
      { headers, url: headers.url } as IncomingMessage,
      metaAuth,
      callback
    );
    expect(authd).toBe(true);
    if (authentication === undefined) {
      expect(authObj).toBeUndefined();
    } else {
      expect(authObj).toMatchObject(authentication);
    }
  }
);
