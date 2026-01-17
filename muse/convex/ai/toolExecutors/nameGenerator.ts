import { DEFAULT_MODEL, OPENROUTER_API_URL } from "./openRouter";

export async function executeNameGenerator(input: {
  entityType: string;
  genre?: string;
  culture?: string;
  count?: number;
  tone?: string;
}): Promise<{
  names: Array<{
    name: string;
    meaning?: string;
    origin?: string;
  }>;
}> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const count = input.count || 10;
  const genre = input.genre || "fantasy";
  const culture = input.culture || "varied";
  const tone = input.tone || "neutral";

  const systemPrompt = `You are a name generator for fiction. Generate ${count} names.

Entity type: ${input.entityType}
Genre: ${genre}
Cultural inspiration: ${culture}
Tone: ${tone}

For each name, optionally provide meaning and origin.

Respond with JSON containing a "names" array.`;

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
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${count} names for a ${input.entityType}` },
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
  return JSON.parse(data.choices?.[0]?.message?.content || '{"names":[]}');
}
