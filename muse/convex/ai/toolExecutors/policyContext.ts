import { fetchPinnedProjectMemories, formatMemoriesForPrompt, type DecisionCategory } from "../canon";

type PinnedPolicyContext = { text: string; count: number };

export async function getPinnedPoliciesForProject(
  projectId: string,
  options?: { limit?: number; categories?: DecisionCategory[] }
): Promise<PinnedPolicyContext | null> {
  try {
    const pinned = await fetchPinnedProjectMemories(projectId, {
      limit: options?.limit ?? 50,
      categories: options?.categories ?? ["policy", "decision"],
    });
    if (pinned.length === 0) return null;
    return { text: formatMemoriesForPrompt(pinned), count: pinned.length };
  } catch (error) {
    console.warn("[tools.policy_context] Failed to fetch pinned policies:", error);
    return null;
  }
}
