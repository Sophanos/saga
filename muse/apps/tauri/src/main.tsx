import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexReactClient, useConvexAuth, useQuery } from 'convex/react';
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../../convex/_generated/api';
import App from './App';
import { initAuth, setupAuthDeepLinks } from './lib/auth';
import { initAnalytics } from './lib/analytics';
import { initClarity } from './lib/clarity';
import { useAuthStore } from '@mythos/auth';
import './styles/global.css';

// Initialize auth configuration
initAuth();

// Initialize analytics
initAnalytics();
initClarity();

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL || 'https://convex.rhei.team';
const convex = new ConvexReactClient(convexUrl, {
  skipConvexDeploymentUrlCheck: true, // Self-hosted
});

// Auth sync component - syncs Convex Auth with Zustand store
function AuthSync(): null {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    setLoading(isLoading || (isAuthenticated && currentUser === undefined));
    if (isLoading) return;

    if (isAuthenticated && currentUser) {
      setUser({
        id: currentUser._id,
        email: currentUser.email ?? "",
        name: currentUser.name ?? undefined,
        image: currentUser.image ?? undefined,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      reset();
    }
  }, [isLoading, isAuthenticated, currentUser, setUser, setLoading, reset]);

  return null;
}

// Deep link handler for OAuth callbacks
type DeepLinkHandlerProps = {
  children: React.ReactNode;
};

function DeepLinkHandler({ children }: DeepLinkHandlerProps): JSX.Element {
  const { signIn } = useAuthActions();

  useEffect(() => {
    // Setup deep link listener for OAuth callbacks
    const cleanup = setupAuthDeepLinks(async (params) => {
      if (params.error) {
        console.error('[auth] OAuth callback error:', params.error, params.error_description);
        return;
      }

      if (!params.code) {
        console.warn('[auth] OAuth callback missing code');
        return;
      }

      try {
        const signInWithCode = signIn as (
          provider: string | undefined,
          args: { code: string }
        ) => Promise<unknown>;
        await signInWithCode(undefined, { code: params.code });
      } catch (error) {
        console.error('[auth] Failed to complete OAuth sign-in:', error);
      }
    });

    return () => {
      cleanup.then((unlisten) => unlisten?.());
    };
  }, [signIn]);

  return <>{children}</>;
}

// Replace URL to scrub consumed auth code params
function replaceURL(url: string): void {
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', url);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex} replaceURL={replaceURL}>
      <AuthSync />
      <DeepLinkHandler>
        <App />
      </DeepLinkHandler>
    </ConvexAuthProvider>
  </React.StrictMode>,
);
