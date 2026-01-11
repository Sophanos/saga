import React from "react";
import ReactDOM from "react-dom/client";
import { enableMapSet } from "immer";
import { ConvexProvider } from "./providers";
import App from "./App";
import "./styles/prosemirror.css";
import "./styles/globals.css";

// Enable Immer MapSet plugin for Zustand stores that use Map/Set
enableMapSet();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
