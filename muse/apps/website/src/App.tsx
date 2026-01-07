import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* Redirect to web app for auth and trial routes */}
      <Route path="/try" element={<RedirectToWebApp path="/try" />} />
      <Route path="/login" element={<RedirectToWebApp path="/login" />} />
      <Route path="/signup" element={<RedirectToWebApp path="/signup" />} />
      <Route path="/docs" element={<ComingSoon title="Documentation" />} />
      {/* Catch-all for unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Redirect to the main web app (port 3000 in dev) */
function RedirectToWebApp({ path }: { path: string }) {
  // In production, both apps would be on same domain
  // In development, redirect to the web app port
  const configuredBaseUrl = (import.meta.env["VITE_WEB_APP_URL"] as string | undefined)?.trim();
  const webAppUrl = configuredBaseUrl
    ? new URL(path, configuredBaseUrl).toString()
    : import.meta.env.DEV
      ? `http://localhost:3005${path}`
      : path;

  window.location.href = webAppUrl;
  return null;
}

/** Placeholder for pages not yet implemented */
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-medium mb-2">{title}</h1>
        <p className="text-text-muted">Coming soon</p>
        <a href="/" className="text-text-secondary hover:text-text-primary mt-4 inline-block">
          ← Back to home
        </a>
      </div>
    </div>
  );
}

export default App;
