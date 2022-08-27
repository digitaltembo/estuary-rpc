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

test.each`
  writeSide   | readSide    | msg
  ${"client"} | ${"server"} | ${"message"}
  ${"client"} | ${"server"} | ${"error"}
  ${"client"} | ${"server"} | ${"close"}
  ${"server"} | ${"client"} | ${"message"}
  ${"server"} | ${"client"} | ${"error"}
  ${"server"} | ${"client"} | ${"close"}
`(
  "Duplex transmits $msg from $writeSide to $readSide",
  ({ writeSide, readSide, msg }) => {
    const d = new Duplex<Error, Error>();
    const listener = jest.fn();

    d[readSide].on(msg, listener);
    const writeSomething = () =>
      d[writeSide][msg === "message" ? "write" : msg](new Error("blah"));

    writeSomething();
    expect(listener).toHaveBeenCalled();

    const newListener = jest.fn();
    const listenerType = {
      message: "onMessage",
      error: "onError",
      close: "onClose",
    }[msg];
    const listenerObj = { [listenerType]: newListener };
    d[readSide].addListener(listenerObj);
    writeSomething();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(newListener).toHaveBeenCalledTimes(1);
    d[readSide].removeListener(listenerObj);
    writeSomething();
    expect(newListener).toHaveBeenCalledTimes(1);

    d[writeSide === "client" ? "closeClient" : "closeServer"]();

    d[readSide].addListener(listenerObj);
    expect(writeSomething).toThrow();
    expect(newListener).toHaveBeenCalledTimes(1);
  }
);

test("Duplex Mapping", () => {
  const isTrue = new Duplex<boolean, string>();
  isTrue.server.on("message", (b) => isTrue.server.write(b ? "true" : "false"));

  const isEven = isTrue.map(
    (n: number) => n % 2 === 0,
    (out) => `*${out}*`
  );

  const listener = jest.fn();
  isEven.client.on("message", listener);
  isEven.client.write(3);

  expect(listener).toHaveBeenCalledWith("*false*");
});

test("Duplex Handling", async () => {
  const isTrueEndpoint = async (d: Duplex<boolean, string>) =>
    d.server.on("message", (b) => d.server.write(b ? "true" : "false"));
  const client = await openStreamHandler(isTrueEndpoint);
  const listener = jest.fn();
  client.on("message", listener);
  client.write(true);
  expect(listener).toHaveBeenCalledWith("true");
});
