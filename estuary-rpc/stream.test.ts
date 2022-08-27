import Stream, { Duplex, openStreamHandler } from "./stream";

test("Stream Works", () => {
  const s = new Stream<number>();
  const calls = [];

  const listener = {
    onMessage: () => calls.push("onMessage"),
    onError: () => calls.push("onError"),
  };
  s.addListener(listener);
  s.on("close", () => calls.push("onClose"));

  s.write(4);
  s.error(new Error());
  s.removeListener(listener);
  s.close();

  expect(calls).toMatchObject(["onMessage", "onError", "onClose"]);
});

test("Stream Mapping", () => {
  const x = new Stream<number>();
  const y = x.mapOut((t) => `(${t})`);
  let result = "";

  y.on("message", (value) => (result = value));
  x.write(1);
  expect(result).toBe("(1)");

  const z = x.mapIn((n: number) => n - 4);
  z.write(10);
  expect(result).toBe("(6)");
});
