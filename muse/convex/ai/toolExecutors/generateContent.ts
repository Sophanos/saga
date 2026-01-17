import { DEFAULT_MODEL, OPENROUTER_API_URL } from "./openRouter";

interface GenerateContentInput {
  entityId: string;
  contentType: "description" | "backstory" | "dialogue" | "scene";
  context?: string;
  length?: "short" | "medium" | "long";
}

interface GenerateContentResult {
  content: string;
  contentType: string;
  entityId: string;
  wordCount: number;
}

const GENERATE_CONTENT_SYSTEM = `You are a creative writing assistant. Generate high-quality content for worldbuilding entities.

Content types:
- description: Vivid, sensory description of appearance/location/object
- backstory: Character history and formative experiences
- dialogue: In-character speech samples that reveal personality
- scene: A short narrative scene featuring the entity

Write in a literary style appropriate for fiction. Focus on showing rather than telling.
Be specific and evocative. Avoid generic descriptions.

Respond with JSON containing:
- content: The generated text
- wordCount: Approximate word count`;

export async function executeGenerateContent(
  input: GenerateContentInput,
  _projectId: string
): Promise<GenerateContentResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const length = input.length ?? "medium";
  const wordTargets = { short: 100, medium: 250, long: 500 };
  const targetWords = wordTargets[length];

  const userContent = `Generate ${input.contentType} content for entity ${input.entityId}.

Target length: ~${targetWords} words (${length})
${input.context ? `\nContext: ${input.context}` : ""}

Generate ${input.contentType} content now.`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://mythos.app",
      "X-Title": "Saga AI",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: GENERATE_CONTENT_SYSTEM },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content generated");
  }

  const parsed = JSON.parse(content);

  return {
    content: parsed.content || "",
    contentType: input.contentType,
    entityId: input.entityId,
    wordCount: parsed.wordCount || parsed.content?.split(/\s+/).length || 0,
  };
}
