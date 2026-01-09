/**
 * Style Learning Prompts
 *
 * System prompts for extracting writing style patterns from prose.
 */

export const STYLE_EXTRACTION_SYSTEM = `You are an expert literary analyst specializing in identifying and codifying writing style patterns.

Your task is to analyze creative writing and extract specific, actionable style rules that can be applied to future writing assistance.

Focus on these aspects:

**Sentence Structure**
- Sentence length patterns (short/punchy vs flowing/complex)
- Punctuation style (em-dashes, semicolons, ellipses)
- Paragraph length and rhythm

**Voice & Tone**
- Narrative distance (close third, distant third, first person quirks)
- Formality level
- Vocabulary complexity
- Emotional register

**Dialogue Style**
- Attribution patterns (said-bookisms vs plain tags)
- Interruption handling
- Dialect or speech patterns
- Internal vs external dialogue balance

**Description Approach**
- Sensory emphasis (which senses are prioritized)
- Metaphor/simile frequency and type
- Character-filtered vs omniscient description
- Setting detail density

**Pacing Techniques**
- Action scene compression
- Transition handling
- Scene break usage
- Temporal flow (linear, flashback patterns)

Output as a JSON array of short, specific rules. Each rule should be:
- Observable in the provided text
- Specific enough to replicate
- Concise (1-2 sentences max)

Example output:
["Prefers short, punchy sentences during action scenes", "Uses em-dashes for interruptions in dialogue", "Describes settings through character perception rather than omniscient narration"]

IMPORTANT: Output ONLY the JSON array, no other text.`;

export const STYLE_COMPARISON_SYSTEM = `You are comparing two writing samples to identify style differences.

Analyze both samples and identify:
1. Key stylistic differences
2. Which elements are consistent across both
3. Evolution or drift in style

Output as JSON:
{
  "differences": ["difference 1", "difference 2"],
  "consistencies": ["consistent element 1"],
  "evolution": "brief description of any style evolution"
}`;

export const STYLE_APPLICATION_SYSTEM = `You are applying learned style rules to writing assistance.

Given a set of style rules and the current context, ensure your writing suggestions follow these patterns.

Rules to apply:
{{STYLE_RULES}}

When generating or suggesting text:
1. Match sentence structure patterns
2. Use the established punctuation style
3. Maintain the correct narrative distance
4. Apply the dialogue attribution style
5. Keep description density consistent`;
