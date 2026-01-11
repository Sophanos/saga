import { useAnonymousStore } from "../stores/anonymous";

const ANON_TRIAL_LIMIT = 5;

function ensureAnonDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const store = useAnonymousStore.getState();
  if (!store.sessionId) {
    store.startSession();
  }

  return useAnonymousStore.getState().sessionId;
}

export function getAnonHeaders(): Record<string, string> {
  const anonDeviceId = ensureAnonDeviceId();
  if (!anonDeviceId) {
    return {};
  }

  return { "x-anon-device-id": anonDeviceId };
}

export interface AnonymousTrialSession {
  trial: {
    limit: number;
    used: number;
    remaining: number;
  };
}

export async function ensureAnonSession(): Promise<AnonymousTrialSession> {
  ensureAnonDeviceId();

  const { chatMessageCount } = useAnonymousStore.getState();
  const used = chatMessageCount ?? 0;
  const remaining = Math.max(ANON_TRIAL_LIMIT - used, 0);

  return {
    trial: {
      limit: ANON_TRIAL_LIMIT,
      used,
      remaining,
    },
  };
}
