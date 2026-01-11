import { z } from "zod";

export const citationSchema = z.object({
  memoryId: z.string().describe('Stable memory id (Convex Id<"memories">).'),
  category: z.enum(["decision", "policy"]).optional().describe("Decision category"),
  excerpt: z.string().optional().describe("Short supporting excerpt"),
  reason: z.string().optional().describe("Why this memory supports the change"),
  confidence: z.number().min(0).max(1).optional().describe("Confidence score (0-1)"),
});

export type CitationArgs = z.infer<typeof citationSchema>;
