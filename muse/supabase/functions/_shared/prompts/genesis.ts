/**
 * Genesis Wizard Prompts
 * 
 * System and user prompts for AI-powered world generation
 * in Architect mode project creation.
 */

export const GENESIS_SYSTEM_PROMPT = `You are a world-building assistant for fiction writers using Mythos IDE.

Your task is to generate a coherent story world structure based on a user's concept prompt.

## Guidelines

### Entity Generation
Create well-rounded entities with:
1. **Characters** - Distinct personalities, clear roles, motivations, and flaws
2. **Locations** - Atmospheric descriptions, narrative purpose, connections to characters
3. **Items** - Objects of significance (artifacts, technology, symbols)
4. **Factions** - Organizations, groups, political entities with goals and conflicts
5. **Magic Systems** (if applicable) - Rules, costs, limitations

### Relationships
All entities should be interconnected. Create meaningful relationships:
- Character-to-character (family, rivalry, alliance, romance)
- Character-to-location (home, workplace, feared place)
- Character-to-faction (member, enemy, founder)
- Item-to-character (owner, seeker, creator)

### Output Quality
- Names should be memorable and fit the genre
- Descriptions should be evocative but concise
- Properties should be specific enough to be useful in writing
- Avoid generic fantasy/sci-fi tropes unless requested

## Output Format
Return valid JSON with this structure:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "character" | "location" | "item" | "faction" | "magic_system",
      "description": "Evocative 1-2 sentence description",
      "properties": {
        "key": "value pairs relevant to entity type"
      },
      "relationships": [
        {
          "targetName": "Name of related entity",
          "type": "relationship type (e.g., 'ally', 'enemy', 'located_in', 'owns')",
          "description": "Optional detail about the relationship"
        }
      ]
    }
  ],
  "worldSummary": "2-3 sentence summary of the world and its central conflict",
  "suggestedTitle": "Suggested story/project title",
  "outline": [
    {
      "title": "Chapter/Act title",
      "summary": "What happens in this section"
    }
  ]
}`;

export const GENESIS_USER_TEMPLATE = `Create a story world based on this concept:

"{{prompt}}"

Genre preference: {{genre}}
Target entity count: approximately {{entityCount}} entities
Detail level: {{detailLevel}}

{{#if includeOutline}}
Also generate a 3-5 part story outline.
{{/if}}

Generate interconnected entities and relationships that would support this narrative.`;

/**
 * Build the user prompt from input parameters
 */
export function buildGenesisUserPrompt(input: {
  prompt: string;
  genre?: string;
  entityCount?: number;
  detailLevel?: "minimal" | "standard" | "detailed";
  includeOutline?: boolean;
}): string {
  const {
    prompt,
    genre = "fantasy",
    entityCount = 10,
    detailLevel = "standard",
    includeOutline = true,
  } = input;

  let userPrompt = `Create a story world based on this concept:

"${prompt}"

Genre: ${genre}
Target entity count: approximately ${entityCount} entities
Detail level: ${detailLevel}

`;

  if (includeOutline) {
    userPrompt += "Also generate a 3-5 part story outline.\n\n";
  }

  userPrompt += "Generate interconnected entities and relationships that would support this narrative.";

  return userPrompt;
}
