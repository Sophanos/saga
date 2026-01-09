/**
 * useSyncEngine hook for React Native
 *
 * Manages the SyncEngine lifecycle for Expo/React Native.
 * Handles SQLite database initialization, sync engine lifecycle,
 * and online status synchronization.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as SQLite from "expo-sqlite";
import { SyncEngine, type Mutation, type QueuedAiRequest } from "@mythos/sync";
import { createSqliteAdapter, type SQLiteDatabase } from "@mythos/sync/native";
import { getMobileSupabase } from "./supabase";
import { useOfflineStore } from "@mythos/state";

/**
 * Database name for local storage
 */
const DB_NAME = "mythos_sync.db";

/**
 * Options for the useSyncEngine hook
 */
export interface UseSyncEngineOptions {
  /**
   * Current project ID (null if no project selected)
   */
  projectId: string | null;
  /**
   * Current user ID (null if not authenticated)
   */
  userId: string | null;
  /**
   * Optional sync interval in milliseconds (default: 30000)
   */
  syncIntervalMs?: number;
}

/**
 * Result returned by the useSyncEngine hook
 */
export interface UseSyncEngineResult {
  /**
   * The sync engine instance (null if not initialized)
   */
  engine: SyncEngine | null;
  /**
   * Whether the sync engine is ready and running
   */
  isReady: boolean;
  /**
   * Any error that occurred during initialization
   */
  error: string | null;
  /**
   * Enqueue a mutation for sync
   */
  mutate: (mutation: Omit<Mutation, "id" | "createdAt" | "projectId">) => Promise<void>;
  /**
   * Queue an AI request for processing when online
   */
  queueAi: (request: Omit<QueuedAiRequest, "id" | "createdAt">) => Promise<void>;
  /**
   * Trigger an immediate sync
   */
  syncNow: () => Promise<void>;
}

/**
 * Hook to manage the SyncEngine lifecycle for React Native
 *
 * @param options - Hook configuration
 * @returns Sync engine state and methods
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isReady, error, mutate, syncNow } = useSyncEngine({
 *     projectId: currentProjectId,
 *     userId: user?.id ?? null,
 *   });
 *
 *   if (error) {
 *     console.error('Sync engine error:', error);
 *   }
 *
 *   // Mutate data (will sync when online)
 *   const saveDocument = async (doc) => {
 *     await mutate({ table: 'documents', type: 'upsert', row: doc });
 *   };
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useSyncEngine(options: UseSyncEngineOptions): UseSyncEngineResult {
  const { projectId, userId, syncIntervalMs = 30000 } = options;

  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current project ID to detect changes
  const currentProjectIdRef = useRef<string | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  // Subscribe to online status changes
  const isOnline = useOfflineStore((s) => s.isOnline);

  /**
   * Initialize the SQLite database
   */
  const initializeDatabase = useCallback(async (): Promise<SQLite.SQLiteDatabase> => {
    if (dbRef.current) {
      return dbRef.current;
    }

    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      dbRef.current = db;
      return db;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open database";
      console.error("[useSyncEngine] Database initialization failed:", message);
      throw new Error(message);
    }
  }, []);

  /**
   * Start the sync engine for a project
   */
  const startEngine = useCallback(
    async (pid: string): Promise<SyncEngine> => {
      console.log("[useSyncEngine] Starting engine for project:", pid);

      try {
        // Initialize database
        const db = await initializeDatabase();

        // Create SQLite adapter (cast to our interface which is compatible)
        const adapter = createSqliteAdapter(db as unknown as SQLiteDatabase);

        // Get Supabase client
        const supabase = getMobileSupabase();

        // Create sync engine
        const newEngine = new SyncEngine({
          supabase,
          local: adapter,
          projectId: pid,
          isOnline: useOfflineStore.getState().isOnline,
          syncIntervalMs,
        });

        // Start the engine
        await newEngine.start();

        engineRef.current = newEngine;
        return newEngine;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start sync engine";
        console.error("[useSyncEngine] Failed to start engine:", message);
        throw new Error(message);
      }
    },
    [initializeDatabase, syncIntervalMs]
  );

  /**
   * Stop the current sync engine
   */
  const stopEngine = useCallback(async (): Promise<void> => {
    if (engineRef.current) {
      console.log("[useSyncEngine] Stopping engine");
      try {
        await engineRef.current.stop();
      } catch (err) {
        console.error("[useSyncEngine] Error stopping engine:", err);
      }
      engineRef.current = null;
    }
  }, []);

  // Handle project changes - start/stop engine as needed
  useEffect(() => {
    let mounted = true;

    const handleProjectChange = async () => {
      // Skip if no user
      if (!userId) {
        if (engineRef.current) {
          await stopEngine();
          if (mounted) {
            setEngine(null);
            setIsReady(false);
          }
        }
        return;
      }

      // Skip if project hasn't changed
      if (projectId === currentProjectIdRef.current) {
        return;
      }

      // Stop existing engine
      if (engineRef.current) {
        await stopEngine();
        if (mounted) {
          setEngine(null);
          setIsReady(false);
        }
      }

      // Update current project ref
      currentProjectIdRef.current = projectId;

      // Skip if no project
      if (!projectId) {
        return;
      }

      // Start new engine
      try {
        if (mounted) {
          setError(null);
        }

        const newEngine = await startEngine(projectId);

        if (mounted) {
          setEngine(newEngine);
          setIsReady(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync engine initialization failed";
        console.error("[useSyncEngine] Initialization error:", message);
        if (mounted) {
          setError(message);
          setEngine(null);
          setIsReady(false);
        }
      }
    };

    handleProjectChange();

    return () => {
      mounted = false;
    };
  }, [projectId, userId, startEngine, stopEngine]);

  // Update engine online status when it changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setOnline(isOnline);
    }
  }, [isOnline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEngine();
    };
  }, [stopEngine]);

  /**
   * Enqueue a mutation for sync
   */
  const mutate = useCallback(
    async (mutation: Omit<Mutation, "id" | "createdAt" | "projectId">): Promise<void> => {
      if (!engineRef.current) {
        console.warn("[useSyncEngine] Cannot mutate: engine not ready");
        return;
      }

      await engineRef.current.mutate(mutation);
    },
    []
  );

  /**
   * Queue an AI request for processing
   */
  const queueAi = useCallback(
    async (request: Omit<QueuedAiRequest, "id" | "createdAt">): Promise<void> => {
      if (!engineRef.current) {
        console.warn("[useSyncEngine] Cannot queue AI request: engine not ready");
        return;
      }

      await engineRef.current.queueAi(request);
    },
    []
  );

  /**
   * Trigger an immediate sync
   */
  const syncNow = useCallback(async (): Promise<void> => {
    if (!engineRef.current) {
      console.warn("[useSyncEngine] Cannot sync: engine not ready");
      return;
    }

    await engineRef.current.syncNow();
  }, []);

  return {
    engine,
    isReady,
    error,
    mutate,
    queueAi,
    syncNow,
  };
}

export default useSyncEngine;
