import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "mythos-openrouter-key";

/**
 * Hook for managing the OpenRouter API key in localStorage.
 *
 * Security notes:
 * - Key is stored in localStorage (browser-only)
 * - Never logged or exposed to console
 * - Should only be sent in request headers to API
 */
export function useApiKey() {
  const [key, setKeyState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) || "";
  });

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setKeyState(e.newValue || "");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const saveKey = useCallback((newKey: string) => {
    localStorage.setItem(STORAGE_KEY, newKey);
    setKeyState(newKey);
  }, []);

  const clearKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setKeyState("");
  }, []);

  return {
    key,
    saveKey,
    clearKey,
    hasKey: !!key,
  };
}
