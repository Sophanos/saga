/**
 * Convex mutation hook with offline queue support
 */

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { getMutationQueue } from "../offline/mutationQueue";
import { useConvexOffline } from "../provider";

export interface UseConvexMutationWithQueueOptions {
  /**
   * Project ID for scoping the mutation
   */
  projectId: string;

  /**
   * Unique name for this mutation (used for offline queue)
   * If not provided, will use the function reference string
   */
  mutationName?: string;

  /**
   * Callback when mutation succeeds (online or after queue processing)
   */
  onSuccess?: (data: unknown) => void;

  /**
   * Callback when mutation fails
   */
  onError?: (error: Error) => void;

  /**
   * Callback when mutation is queued for offline processing
   */
  onQueued?: (mutationId: string) => void;
}

export interface MutationState {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isQueued: boolean;
}

/**
 * Use a Convex mutation with automatic offline queue support.
 *
 * When online: Executes mutation immediately
 * When offline: Queues mutation for later processing with last-write-wins
 *
 * @example
 * ```tsx
 * const createDocument = useConvexMutationWithQueue(
 *   api.documents.create,
 *   { projectId, mutationName: "documents:create" }
 * );
 *
 * // This will work offline too
 * await createDocument.mutate({ title: "New Chapter", type: "chapter" });
 * ```
 */
export function useConvexMutationWithQueue<
  Mutation extends FunctionReference<"mutation", "public", any, any>
>(
  mutation: Mutation,
  options: UseConvexMutationWithQueueOptions
): {
  mutate: (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation> | string>;
  mutateAsync: (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation> | string>;
  state: MutationState;
  reset: () => void;
} {
  const { projectId, mutationName, onSuccess, onError, onQueued } = options;
  const { isOnline } = useConvexOffline();
  const convexMutation = useMutation(mutation);

  const [state, setState] = useState<MutationState>({
    isLoading: false,
    isError: false,
    error: null,
    isQueued: false,
  });

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isError: false,
      error: null,
      isQueued: false,
    });
  }, []);

  const mutateAsync = useCallback(
    async (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation> | string> => {
      setState((prev) => ({ ...prev, isLoading: true, isError: false, error: null }));

      try {
        if (isOnline) {
          // Online: execute immediately
          const result = await convexMutation(args as any);
          setState((prev) => ({ ...prev, isLoading: false, isQueued: false }));
          onSuccess?.(result);
          return result;
        } else {
          // Offline: queue for later
          const queue = getMutationQueue();
          // Use provided name or generate from function reference
          const name = mutationName ?? String(mutation);
          const mutationId = await queue.enqueue(
            name,
            args as Record<string, unknown>,
            projectId
          );

          setState((prev) => ({ ...prev, isLoading: false, isQueued: true }));
          onQueued?.(mutationId);

          // Return the mutation ID for tracking
          return mutationId as unknown as FunctionReturnType<Mutation>;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          error: err,
        }));
        onError?.(err);
        throw err;
      }
    },
    [isOnline, convexMutation, mutationName, mutation, projectId, onSuccess, onError, onQueued]
  );

  return {
    mutate: mutateAsync,
    mutateAsync,
    state,
    reset,
  };
}
