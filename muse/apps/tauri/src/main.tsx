import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import App from './App';
import { authClient, initAuth, setupAuthDeepLinks } from './lib/auth';
import { initAnalytics } from './lib/analytics';
import { initClarity } from './lib/clarity';
import './styles/global.css';

// Initialize auth configuration
initAuth();

// Initialize analytics
initAnalytics();
initClarity();

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL || 'https://convex.cascada.vision';
const convex = new ConvexReactClient(convexUrl, {
  skipConvexDeploymentUrlCheck: true, // Self-hosted
});

// Auth wrapper component for deep link handling
function AuthWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Setup deep link listener for OAuth callbacks
    const cleanup = setupAuthDeepLinks(() => {
      console.log('[auth] OAuth callback received');
      // Force re-render or navigate as needed
      window.location.reload();
    });

    return () => {
      cleanup.then((unlisten) => unlisten?.());
    };
  }, []);

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <AuthWrapper>
          <App />
        </AuthWrapper>
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  </React.StrictMode>,
);
