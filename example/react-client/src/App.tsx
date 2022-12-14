import React from "react";
import toast, { Toaster } from "react-hot-toast";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

import {
  openStreamHandler,
  StreamHandler,
  createOpenApiSpec,
} from "estuary-rpc";

import ClientContext from "./ClientContext";
import { exampleApiMeta, SimpleForm } from "./exampleApi";

const spec = createOpenApiSpec(exampleApiMeta, {
  info: {
    title: "Example API",
    version: "foo.bar",
  },
});

function App() {
  const [authState, setAuthState] = React.useState({
    username: "",
    password: "",
  });

  const [text, setText] = React.useState("");
  const [form, setForm] = React.useState<SimpleForm>({
    name: "",
    file: "",
  });

  const { client, setAuth } = React.useContext(ClientContext);

  const post = React.useCallback(() => {
    client.foo
      .simplePost(8)
      .then((val) => toast("Successful simple post, got value " + val))
      .catch((err) => {
        console.log(err);
        toast.error("Dangit, failure");
      });
  }, [client]);

  const simpleGet = React.useCallback(() => {
    client.foo
      .simpleGet("hello")
      .then((output) => toast(`Server returned ${output}`))
      .catch((err) => {
        console.log(err);
        toast.error("Dangit, failure: " + err.message);
      });
  }, [client]);

  const authGet = React.useCallback(() => {
    client.foo
      .authenticatedGet("hello")
      .then((output) => toast(`Server returned ${output}`))
      .catch((err) => {
        console.log(err);
        toast.error("Dangit, failure: " + err.message);
      });
  }, [client]);

  const submitForm = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      client
        .formPost(form)
        .then((val: number) => toast(`Got ${val} from server`))
        .catch((err) => toast.error("Dangit, failure: " + err.message));
    },
    [client, form]
  );

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
        Demonstration of simple usage of estuary-rpc for React clientside use
      </p>
      <div>
        <input
          type="text"
          placeholder="username"
          onChange={(e) =>
            setAuthState(({ password }) => ({
              password,
              username: e.target.value,
            }))
          }
          value={authState.username}
        />
        <input
          type="text"
          placeholder="password"
          onChange={(e) =>
            setAuthState(({ username }) => ({
              username,
              password: e.target.value,
            }))
          }
          value={authState.password}
        />
        <button
          onClick={() => {
            setAuth({ type: "basic", ...authState });
          }}
        >
          Login
        </button>
      </div>
      <br />
      <div>
        <h2>Post data</h2>
        <button onClick={post}>Call /api/foo/simplePost</button>
        <h2>GET data, check authentication</h2>
        <button onClick={simpleGet}>Call /api/foo/simpleGet</button>
        <button onClick={authGet}>Call /api/foo/authenticatedGet</button>
      </div>
      <div>
        <h2>Use a form, upload a file</h2>
        <form onSubmit={submitForm}>
          <input
            type="text"
            onChange={(e) =>
              setForm((form) => ({ ...form, name: e.target.value }))
            }
            value={form.name}
          />
          <input
            type="file"
            onChange={(e) =>
              setForm((form) => ({
                ...form,
                file: e.target.files?.[0] ?? null,
              }))
            }
          />
          <button type="submit">Submit</button>
        </form>
      </div>
      <h2>Stream over WebSockets</h2>
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

      <div>
        <h2>Swagger Docs</h2>
        <SwaggerUI spec={spec} />
      </div>
      <Toaster />
    </div>
  );
}

export default App;
