type MessageFn<T> = (t: T) => void;
type ErrorFn = (err: Error) => void;
type CloseFn = () => void;

interface StreamListener<T> {
  onMessage?: MessageFn<T>;
  onError?: ErrorFn;
  onClose?: CloseFn;
}

type InStream<In> = {
  addListener: (listener: StreamListener<In>) => void;
  removeListener: (listener: StreamListener<In>) => void;
  on: (
    eventType: "message" | "error" | "close",
    fn: MessageFn<In> | ErrorFn | CloseFn
  ) => void;
  mapIn: <In2>(fn: (input: In2) => In) => InStream<In2>;
};

type OutStream<Out> = {
  write: (out: Out) => void;
  error: (error: Error) => void;
  close: () => void;
  mapOut: <Out2>(fn: (output: Out) => Out2) => OutStream<Out2>;
};

const CLOSED_FN = () => {
  throw new Error("Closed Out Stream");
};

const CLOSED_IN_STREAM: InStream<unknown> = {
  addListener: CLOSED_FN,
  removeListener: CLOSED_FN,
  on: CLOSED_FN,
  mapIn: CLOSED_FN,
};
const CLOSED_OUT_STREAM: OutStream<unknown> = {
  write: CLOSED_FN,
  error: CLOSED_FN,
  close: CLOSED_FN,
  mapOut: CLOSED_FN,
};

type StreamHandler<In, Out> = InStream<In> & OutStream<Out>;

class Stream<T> implements StreamHandler<T, T> {
  private listeners: Array<StreamListener<T>>;

  write(t: T) {
    this.listeners.forEach((l) => l.onMessage && l.onMessage(t));
  }
  error(err: Error) {
    this.listeners.forEach((l) => l.onError && l.onError(err));
  }
  close() {
    this.listeners.forEach((l) => l.onClose?.());
  }
  addListener(listener: StreamListener<T>) {
    this.listeners.push(listener);
  }
  removeListener(listener: StreamListener<T>) {
    this.listeners = this.listeners.filter((l) => l != listener);
  }

  on(
    eventType: "message" | "error" | "close",
    fn: MessageFn<T> | ErrorFn | CloseFn
  ) {
    switch (eventType) {
      case "message":
        this.addListener({ onMessage: fn as MessageFn<T> });
        break;
      case "error":
        this.addListener({ onError: fn as ErrorFn });
        break;
      case "close":
        this.addListener({ onClose: fn as CloseFn });
        break;
    }
  }
  mapOut<S>(fn: (t: T) => S) {
    const stream = new Stream<S>();
    this.addListener({
      onMessage: (t: T) => stream.write(fn(t)),
      onError: stream.error,
      onClose: stream.close,
    });
    return stream;
  }
  mapIn<S>(fn: (t: S) => T) {
    const stream = new Stream<S>();
    stream.addListener({
      onMessage: (s: S) => this.write(fn(s)),
      onError: this.error,
      onClose: this.close,
    });
    return stream;
  }
}

export class BiDiStream<In, Out> {
  public toServer: Stream<In>;
  public toClient: Stream<Out>;
  public server: StreamHandler<In, Out>;
  public client: StreamHandler<Out, In>;
  constructor(toServer = new Stream<In>(), toClient = new Stream<Out>()) {
    this.toServer = toServer;
    this.toClient = toClient;
    this.server = {
      write: this.toClient.write,
      error: this.toClient.error,
      close: this.toClient.close,
      mapOut: this.toClient.mapOut,
      addListener: this.toServer.addListener,
      removeListener: this.toServer.removeListener,
      on: this.toServer.on,
      mapIn: this.toServer.mapIn,
    };
    this.client = {
      write: this.toServer.write,
      error: this.toServer.error,
      close: this.toServer.close,
      mapOut: this.toServer.mapOut,
      addListener: this.toClient.addListener,
      removeListener: this.toClient.removeListener,
      on: this.toClient.on,
      mapIn: this.toClient.mapIn,
    };
  }

  map<NewIn, NewOut>(
    inFn: (input: NewIn) => In,
    outFn: (output: Out) => NewOut
  ) {
    return new BiDiStream<NewIn, NewOut>(
      this.toServer.mapIn(inFn),
      this.toClient.mapOut(outFn)
    );
  }

  closeServer() {
    this.server = {
      ...(CLOSED_IN_STREAM as InStream<In>),
      ...(CLOSED_OUT_STREAM as OutStream<Out>),
    };
  }
  closeClient() {
    this.client = {
      ...(CLOSED_IN_STREAM as InStream<Out>),
      ...(CLOSED_OUT_STREAM as OutStream<In>),
    };
  }
}

export async function openStreamHandler<Out, In>(
  streamEndpoint: (input: BiDiStream<In, Out>) => Promise<void>
) {
  const bidi = new BiDiStream<In, Out>();
  await streamEndpoint(bidi);
  return bidi.client;
}

export default Stream;
