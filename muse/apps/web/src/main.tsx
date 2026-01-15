import ReactDOM from "react-dom/client";
import { enableMapSet } from "immer";
import { ConvexProvider } from "./providers";
import App from "./App";
import { initAuth } from "./lib/auth";
import "prosemirror-view/style/prosemirror.css";
import "./styles/globals.css";

// Enable Immer MapSet plugin for Zustand stores that use Map/Set
enableMapSet();
initAuth();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexProvider>
    <App />
  </ConvexProvider>
);
