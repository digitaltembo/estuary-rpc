import { StreamEndpoint } from "./types";

/**
 * Callback from a message being send
 * @param T type of message being sent
 * @group Streams
 */
export type MessageFn<T> = (t: T) => void;
/** Error callback @group Streams */
export type ErrorFn = (err: Error) => void;
/** Stream completion callback @group Streams */
export type CloseFn = () => void;

/**
 * A StreamListener<T> defines any of three potential callbacks to be triggered by a stream event -
 * the reception of a message, an error being thrown onto the stream, or the stream being closed
 * @param T The type of messages carried by the stream
 * @group Streams
 */
export interface StreamListener<T> {
  onMessage?: MessageFn<T>;
  onError?: ErrorFn;
  onClose?: CloseFn;
}

/**
 * An InStream represents the interface for handling a readable stream
 * @param In The type of the messages being sent into the stream
 * @group Streams
 */
export interface InStream<In> {
  /** Adds a listener for message, error, and/or completion events coming in  */
  addListener: (listener: StreamListener<In>) => void;
  /** Removes a listener added by addListener */
  removeListener: (listener: StreamListener<In>) => void;
  /**
   * shortcut for adding a listener of a single type.
   * @example
   * ```ts
   * foo.on("close", () => console.log("closed") );
   * // is equivalent to
   * foo.addListener({onClose: () => console.log("closed")});
   * ```
   * @param eventType Which of three valid events to listen for
   * @param fn callback that is called
   */
  on: (
    eventType: "message" | "error" | "close",
    fn: MessageFn<In> | ErrorFn | CloseFn
  ) => void;

  /**
   * Creates a new InStream of a different type by converting all of its
   * input values to this streams input values
   * @param In2 The object type being sent along InStream
   * @param fn The method used to map between the two stream objects
   * */
  mapIn: <In2>(fn: (input: In2) => In) => InStream<In2>;
}

/**
 * An OutStream represents the interface for writing to a stream
 * @param Out The type of messages that will be written to the stream
 * @group Streams
 */
export interface OutStream<Out> {
  /** Writes the out object to the stream */
  write: (out: Out) => void;
  /** Transmits an error event along the stream */
  error: (error: Error) => void;
  /** Closes the stream */
  close: () => void;
  /**
   * Creates a new OutStream of a different type by converting all of this streams
   * outputs to a different type
   * @param Out2 the new OutStream object type
   * @param fn The method for converting between types
   */
  mapOut: <Out2>(fn: (output: Out) => Out2) => OutStream<Out2>;
}

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

/**
 * A StreamHandler handles messages coming in of one type and outputs messages of another type
 * @param In The type of messages coming in
 * @param Out The type of messages going out
 * @group Streams
 */
export type StreamHandler<In, Out> = InStream<In> & OutStream<Out>;

/**
 * A Stream<T> implements both {@link InStream} and {@link OutStream} in such a way that the output
 * events of OutStream trigger the input events of InStream
 * @param T type of objects being transmitted along the stream
 * @group Streams
 */
export class Stream<T> implements StreamHandler<T, T> {
  private listeners: Array<StreamListener<T>> = [];

  /** Invokes any registerd message listeners */
  write(t: T) {
    this.listeners.forEach((l) => l.onMessage && l.onMessage(t));
  }
  /** Invokes any registered error listeners */
  error(err: Error) {
    this.listeners.forEach((l) => l.onError && l.onError(err));
  }
  /** Invokes any registered close listeners */
  close() {
    this.listeners.forEach((l) => l.onClose?.());
  }
  /** Adds a StreamListener to handle any of the output events*/
  addListener(listener: StreamListener<T>) {
    this.listeners.push(listener);
  }
  /** Removes the listener if it had been added */
  removeListener(listener: StreamListener<T>) {
    this.listeners = this.listeners.filter((l) => l != listener);
  }

  /** Adds a specific flavor of {@link StreamListener} */
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
  /**
   * @param fn Method to convert between the type of this stream and the returned stream type
   * @returns a new Stream which is written to whenever this stream is written to
   */
  mapOut<S>(fn: (t: T) => S) {
    const stream = new Stream<S>();
    this.addListener({
      onMessage: (t: T) => stream.write(fn(t)),
      onError: stream.error,
      onClose: stream.close,
    });
    return stream;
  }
  /**
   * @param fn Method to convert between the type of this stream and the returned stream type
   * @returns a new Stream which is will write to this one whenever it is written to
   */
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

/**
 * A Duplex<In, Out> is the core type used for {@link StreamEndpoint}, and represents two streams -
 * one going "in" to a server, and one going "out" to a client
 * @param In The type of messages transmitted to the server
 * @param Out The type of messages transmitted to the client
 * @group Streams
 */
export class Duplex<In, Out> {
  /** Underlying stream to the server - likely unnecessary to access */
  public toServer: Stream<In>;
  /** Underlying stream to the clietn - likely unnecessary to access */
  public toClient: Stream<Out>;

  /**
   * StreamHanlder view of the underlying streams from the perspective of the server -
   * from this perspective, you will be able to listen for messages being sent to the server
   * and be able to write messages "out" to the client
   * */
  public server: StreamHandler<In, Out>;
  /**
   * StreamHanlder view of the underlying streams from the perspective of the client -
   * from this perspective, you will be able to listen for messages being sent to the client
   * and be able to write messages "out" to the server
   * */
  public client: StreamHandler<Out, In>;

  /**
   * Assigns the underlying streams to the duplex and creates the server and client StreamHandler views
   * @param toServer Stream for sending data to the server, will create a new stream if not specified
   * @param toClient Stream for sending data to the client, will create a new stream if not specified
   */
  constructor(toServer = new Stream<In>(), toClient = new Stream<Out>()) {
    this.toServer = toServer;
    this.toClient = toClient;
    this.server = {
      write: (msg) => this.toClient.write(msg),
      error: (err) => this.toClient.error(err),
      close: () => this.toClient.close(),
      mapOut: (fn) => this.toClient.mapOut(fn),
      addListener: (list) => this.toServer.addListener(list),
      removeListener: (list) => this.toServer.removeListener(list),
      on: (ty, ev) => this.toServer.on(ty, ev),
      mapIn: (fn) => this.toServer.mapIn(fn),
    };
    this.client = {
      write: (msg) => this.toServer.write(msg),
      error: (err) => this.toServer.error(err),
      close: () => this.toServer.close(),
      mapOut: (fn) => this.toServer.mapOut(fn),
      addListener: (list) => this.toClient.addListener(list),
      removeListener: (list) => this.toClient.removeListener(list),
      on: (ty, ev) => this.toClient.on(ty, ev),
      mapIn: (fn) => this.toClient.mapIn(fn),
    };
  }
  /**
   * @param inFn transformation for input message types
   * @param outFn transformation for output message types
   * @returns New duplex
   * @example
   * ```ts
   * const isTrueEndpoint = async ({server}}: Duplex<boolean, string>) => {
   *   server.on("message", (b) => server.write(b ? "true" : "false"));
   * }
   * // Forward requests from otherEndpoint to endpoint, and forward responses back
   * const isEvenEndpoint = async (dup: Duplex<number, string>) =>
   *   isTrueEndpoint(dup.map((n: number) => n % 2 === 0, (s) => s));
   * ```
   */
  map<NewIn, NewOut>(
    inFn: (input: NewIn) => In,
    outFn: (output: Out) => NewOut
  ) {
    return new Duplex<NewIn, NewOut>(
      this.toServer.mapIn(inFn),
      this.toClient.mapOut(outFn)
    );
  }

  /**
   * "Closes" the serverside of this duplex by making it so the server view throws errors if you
   * try to read messages sent to the server or write messages to the client
   */
  closeServer() {
    this.server = {
      ...(CLOSED_IN_STREAM as InStream<In>),
      ...(CLOSED_OUT_STREAM as OutStream<Out>),
    };
  }
  /**
   * "Closes" the clientside of this duplex by making it so the server view throws errors if you
   * try to read messages sent to the client or write messages to the server
   */
  closeClient() {
    this.client = {
      ...(CLOSED_IN_STREAM as InStream<Out>),
      ...(CLOSED_OUT_STREAM as OutStream<In>),
    };
  }
}

/**
 * Invokes the streamEndpoint with a new Duplex and returns the client view of that endpoint when the connection
 * has been established.
 * @param streamEndpoint the {@link StreamEndpoint} to be invoked
 * @returns Returns a StreamHandler which can be written to to stream messages to the server over WebSocket and
 * which can be listened to for messages from the server
 * @example
 * ```ts
 * const client = createApiClient({foo: { simpleStream: ws<"string", "string">("/ws/stream") }});
 * const streamHandler = await openStreamHandler(client.foo.simpleStream);
 *
 * streamHandler.on("message", (val: boolean) =>
 *   console.log("Got message from server", val);
 *   streamHandler.close()
 * );
 * streamHandler.write("This string is sent to the server");
 * ```
 * @group Streams
 */
export async function openStreamHandler<Out, In, Closure>(
  streamEndpoint: StreamEndpoint<In, Out, Closure, unknown>,
  closure?: Closure
): Promise<StreamHandler<Out, In>> {
  const duplex = new Duplex<In, Out>();
  await streamEndpoint(duplex, closure);
  return duplex.client;
}

export default Stream;
