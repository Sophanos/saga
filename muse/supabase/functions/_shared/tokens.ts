/**
 * Token Estimation Utilities (MLP 2.x)
 *
 * Lightweight token counting for prompt budgeting.
 * Uses character-based heuristics to avoid heavy tokenizer dependencies in Deno edge runtime.
 */

// =============================================================================
// Types
// =============================================================================

export interface TokenEstimator {
  /** Estimate token count for a string */
  estimate(text: string): number;
}

export interface TokenBudgetConfig {
  /** Total budget for memory context */
  total: number;
  /** Per-category budgets (optional, will be allocated proportionally if not specified) */
  decisions?: number;
  style?: number;
  preferences?: number;
  session?: number;
}

export interface BudgetedLine {
  content: string;
  tokens: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default characters per token ratio.
 * GPT-family models average ~4 chars/token for English.
 * Claude tends to be slightly higher (~4.5).
 * We use 4 as a conservative estimate.
 */
const DEFAULT_CHARS_PER_TOKEN = 4;

/**
 * Default token budget for memory context injection.
 * ~800 tokens is reasonable for memory without overwhelming the context.
 */
const DEFAULT_MEMORY_BUDGET_TOKENS = 800;

/**
 * Default allocation ratios when per-category budgets aren't specified.
 */
const DEFAULT_BUDGET_RATIOS = {
  decisions: 0.35, // Canon decisions are highest priority
  style: 0.25, // Style preferences
  preferences: 0.25, // Accept/reject patterns
  session: 0.15, // Session continuity (smallest, most ephemeral)
};

// =============================================================================
// Token Estimator Implementation
// =============================================================================

/**
 * Create a heuristic token estimator.
 *
 * @param opts.charsPerToken - Characters per token ratio (default: 4)
 */
export function createHeuristicTokenEstimator(opts?: {
  charsPerToken?: number;
}): TokenEstimator {
  const charsPerToken = opts?.charsPerToken ?? DEFAULT_CHARS_PER_TOKEN;

  return {
    estimate(text: string): number {
      if (!text) return 0;

      // Basic character-based estimation
      let estimate = Math.ceil(text.length / charsPerToken);

      // Adjust for common patterns that affect tokenization:
      // - Punctuation and special characters often get their own tokens
      // - Numbers may tokenize differently
      // - Whitespace is usually combined with adjacent text

      // Count special characters that likely become separate tokens
      const specialChars = (text.match(/[^\w\s]/g) || []).length;
      estimate += Math.floor(specialChars * 0.3); // ~30% of special chars add tokens

      // Newlines often become separate tokens
      const newlines = (text.match(/\n/g) || []).length;
      estimate += newlines;

      return estimate;
    },
  };
}

/**
 * Default estimator instance for convenience.
 */
export const defaultEstimator = createHeuristicTokenEstimator();

// =============================================================================
// Budget-Aware Line Selection
// =============================================================================

/**
 * Take lines until token budget is exhausted.
 *
 * @param params.lines - Lines to select from
 * @param params.budgetTokens - Maximum tokens to use
 * @param params.estimator - Token estimator (defaults to heuristic)
 * @param params.overheadTokens - Reserved tokens for formatting overhead
 * @returns Selected lines that fit within budget
 */
export function takeLinesWithinTokenBudget(params: {
  lines: string[];
  budgetTokens: number;
  estimator?: TokenEstimator;
  overheadTokens?: number;
}): string[] {
  const {
    lines,
    budgetTokens,
    estimator = defaultEstimator,
    overheadTokens = 0,
  } = params;

  const availableTokens = budgetTokens - overheadTokens;
  if (availableTokens <= 0 || lines.length === 0) {
    return [];
  }

  const result: string[] = [];
  let usedTokens = 0;

  for (const line of lines) {
    const lineTokens = estimator.estimate(line);

    // Include a small overhead per line for bullet formatting
    const totalLineTokens = lineTokens + 2; // "- " prefix + newline

    if (usedTokens + totalLineTokens > availableTokens) {
      break;
    }

    result.push(line);
    usedTokens += totalLineTokens;
  }

  return result;
}

/**
 * Take lines with detailed token tracking.
 */
export function takeLinesWithBudgetInfo(params: {
  lines: string[];
  budgetTokens: number;
  estimator?: TokenEstimator;
  overheadTokens?: number;
}): { selected: BudgetedLine[]; usedTokens: number; remainingTokens: number } {
  const {
    lines,
    budgetTokens,
    estimator = defaultEstimator,
    overheadTokens = 0,
  } = params;

  const availableTokens = budgetTokens - overheadTokens;
  const selected: BudgetedLine[] = [];
  let usedTokens = 0;

  for (const line of lines) {
    const lineTokens = estimator.estimate(line);
    const totalLineTokens = lineTokens + 2;

    if (usedTokens + totalLineTokens > availableTokens) {
      break;
    }

    selected.push({ content: line, tokens: lineTokens });
    usedTokens += totalLineTokens;
  }

  return {
    selected,
    usedTokens,
    remainingTokens: availableTokens - usedTokens,
  };
}

// =============================================================================
// Budget Configuration
// =============================================================================

/**
 * Get memory context token budget from environment or defaults.
 */
export function getMemoryBudgetConfig(): TokenBudgetConfig {
  const totalEnv = Deno.env.get("MEMORY_CONTEXT_BUDGET_TOKENS");
  const total = totalEnv ? parseInt(totalEnv, 10) : DEFAULT_MEMORY_BUDGET_TOKENS;

  // Calculate per-category budgets based on ratios
  return {
    total,
    decisions: Math.floor(total * DEFAULT_BUDGET_RATIOS.decisions),
    style: Math.floor(total * DEFAULT_BUDGET_RATIOS.style),
    preferences: Math.floor(total * DEFAULT_BUDGET_RATIOS.preferences),
    session: Math.floor(total * DEFAULT_BUDGET_RATIOS.session),
  };
}

/**
 * Apply token budget to memory records.
 * Returns content strings that fit within the category's budget.
 */
export function applyMemoryBudget(
  category: "decisions" | "style" | "preferences" | "session",
  contents: string[],
  budgetConfig?: TokenBudgetConfig
): string[] {
  const config = budgetConfig ?? getMemoryBudgetConfig();
  const categoryBudget = config[category] ?? Math.floor(config.total / 4);

  return takeLinesWithinTokenBudget({
    lines: contents,
    budgetTokens: categoryBudget,
    overheadTokens: 10, // Section header overhead
  });
}
