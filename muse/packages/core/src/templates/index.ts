/**
 * Template System Exports
 *
 * The template system enables Mythos IDE to work with any creative genre.
 */

// Type definitions
export * from "./types";

// Builtin templates
export {
  BUILTIN_TEMPLATES,
  getTemplate,
  getTemplatesByCategory,
  searchTemplates,
  // Individual templates for direct access
  EPIC_FANTASY_TEMPLATE,
  WIZARDING_WORLD_TEMPLATE,
  DND_CAMPAIGN_TEMPLATE,
  MANGA_TEMPLATE,
  LITERARY_FICTION_TEMPLATE,
  SCIFI_TEMPLATE,
  HORROR_TEMPLATE,
  ROMANCE_TEMPLATE,
  MYSTERY_TEMPLATE,
  SCREENPLAY_TEMPLATE,
  WEBNOVEL_TEMPLATE,
  VISUAL_NOVEL_TEMPLATE,
  COMICS_TEMPLATE,
  BLANK_TEMPLATE,
} from "./builtin";
