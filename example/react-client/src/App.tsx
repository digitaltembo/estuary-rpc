import React from "react";
import toast, { Toaster } from "react-hot-toast";
import { openStreamHandler, StreamHandler } from "estuary-rpc";

import ClientContext from "./ClientContext";

function App() {
  const [pass, setPass] = React.useState("");

  const [text, setText] = React.useState("");

  const { client, setAuth } = React.useContext(ClientContext);

  const post = React.useCallback(() => {
    client.foo
      .emptyPost()
      .then(() => toast("Successful empty post!"))
      .catch((err) => {
        console.log(err);
        toast.error("Dangit, failure");
      });
  }, [client]);

  const get = React.useCallback(() => {
    client.foo
      .simpleGet(8)
      .then((val: number) => toast(`Got ${val} from server`))
      .catch((err) => toast.error("Dangit, failure: " + err.message));
  }, [client]);

  const streamHandler = React.useRef<StreamHandler<boolean, string> | null>(
    null
  );

  const transmitState = React.useCallback(async () => {
    if (!streamHandler.current) {
      streamHandler.current = await openStreamHandler(client.foo.simpleStream);
      streamHandler.current.on("message", (val: boolean) => {
        setText((text) => `${text}${val}\n`);
      });
    }
    const lines = text.split("\n");

    streamHandler.current.write(lines[lines.length - 1]);
    setText(text + "\n");
  }, [client, text]);

  const closeStream = () => {
    if (streamHandler.current) {
      streamHandler.current.close();
      streamHandler.current = null;
      setText("");
    }
  };

  return (
    <div className="App" style={{ maxWidth: 700, margin: "auto", padding: 20 }}>
      <h1>Estuary-RPC</h1>
      <p>
        Demonstration of simple usage of estuary-rpc for React clientside used
      </p>
      <div>
        <input
          type="text"
          placeholder="password"
          onChange={(e) => setPass(e.target.value)}
          value={pass}
        />
        <button
          onClick={() => {
            setAuth(pass);
            setPass("");
          }}
        >
          Login
        </button>
      </div>
      <br />
      <div>
        <button onClick={post}>Call /api/foo/emptyPost</button>
        <button onClick={get}>Call /api/foo/simpleGet</button>
      </div>
      <p>Type in textarea and press enter to stream to the backend</p>
      <textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && transmitState()}
      />

      <div>
        <button onClick={closeStream} disabled={streamHandler.current === null}>
          Stop Stream
        </button>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
