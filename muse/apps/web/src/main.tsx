import React from "react";
import ReactDOM from "react-dom/client";
import { enableMapSet } from "immer";
import { initSupabaseClient } from "@mythos/db";
import { webStorage } from "@mythos/storage";
import { ConvexProvider } from "./providers";
import App from "./App";
import "./styles/globals.css";

// Enable Immer MapSet plugin for Zustand stores that use Map/Set
enableMapSet();

// Initialize Supabase client with web-specific configuration
initSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  storage: webStorage,
  detectSessionInUrl: true, // Enable for OAuth callbacks on web
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
