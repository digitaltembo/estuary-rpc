import { convertApiClient, FetchOptsArg } from "../../src/client/client";
import { openStreamHandler } from "../../src/common/stream";
import { ExampleApi, exampleApiMeta } from "../common/exampleApi";

const client = convertApiClient(exampleApiMeta, {
  ammendXhr: (xhr: XMLHttpRequest) =>
    xhr.setRequestHeader("authorization", "SuperSecure"),
}) as ExampleApi<FetchOptsArg, unknown>;

client.foo.emptyPost();

let simpleStream = await openStreamHandler(client.foo.simpleStream);
simpleStream.on("close", () =>
  openStreamHandler(client.foo.simpleStream).then(
    (newStream) => (simpleStream = newStream)
  )
);

simpleStream.on("message", (val: boolean) =>
  console.log("Got message from server", val)
);
simpleStream.write("yooo");
