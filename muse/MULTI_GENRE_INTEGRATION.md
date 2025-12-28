# Mythos IDE: Multi-Genre Worldbuilding Integration

> "Notion with IDE + AI" for every creative genre

## Vision

Mythos IDE is a universal creative writing environment that works like a code IDE but for storytelling. It treats **story as code** — tracking entities like variables, relationships like dependencies, and narrative consistency like type safety.

The system must work seamlessly across ALL creative genres:

---

## Supported Genres & Templates

### Epic Fantasy (LOTR / Wheel of Time / Malazan / Stormlight)
- **Entity kinds**: character, location, faction, magic_system, prophecy, language, culture, artifact, deity, event
- **Relationships**: lineage, fealty, alliance, enmity, worships, speaks_language
- **Linter focus**: Magic consistency, prophecy tracking, timeline integrity
- **UI emphasis**: World Graph, Map view, Timeline, Genealogy trees

### Wizarding Worlds (Harry Potter / The Magicians)
- **Entity kinds**: character, location, spell, magical_creature, potion, faction, prophecy
- **Relationships**: teaches, house_member, blood_status
- **Linter focus**: Spell rules, creature classifications
- **UI emphasis**: Spell book, Creature compendium

### D&D / TTRPG Campaigns (DM Mode)
- **Entity kinds**: pc, npc, monster, location, quest, encounter, spell (D&D stats), item, faction
- **Relationships**: patron_of, hunts, party_member
- **Linter focus**: Stat consistency, CR balance, initiative tracking
- **UI emphasis**: Encounter builder, Initiative tracker, Stat blocks, Session notes
- **Special**: Full DM mode with hidden information

### Manga / Anime / Light Novels
- **Entity kinds**: character (with power_level), technique, arc, location, faction
- **Relationships**: trained_by, defeated_by, inherited_from, uses_technique
- **Linter focus**: Power scaling, pacing rhythm, dialogue density
- **UI emphasis**: Storyboard view, Arc tracker, Power level charts
- **Arc template**: Kishotenketsu (4-act Japanese structure)

### Literary Fiction (Faust / Dostoevsky / Kafka)
- **Entity kinds**: character, theme, symbol, moral_dilemma, location, event
- **Relationships**: embodies, contrasts_with, foil_to, symbolizes
- **Linter focus**: Theme tracking, symbolism consistency, show-don't-tell
- **UI emphasis**: Theme web, Symbol tracker, Character psychology

### Science Fiction (Dune / Foundation / Expanse)
- **Entity kinds**: character, planet, starship, technology, species, faction, event
- **Relationships**: orbits, crew_of, invented
- **Linter focus**: Tech consistency, physics plausibility (optional)
- **UI emphasis**: Star map, Tech tree, Species encyclopedia

### Horror (Lovecraft / King / Gothic)
- **Entity kinds**: character, creature, curse, location, symbol, event
- **Relationships**: haunts, cursed_by, hunts, bound_to, survived
- **Linter focus**: Horror rules (creature limitations), tension pacing
- **UI emphasis**: Mystery tracker, Survivor status

### Romance
- **Entity kinds**: character, relationship_arc, location, event
- **Relationships**: chemistry_with, jealous_of, protective_of, ex_of
- **Linter focus**: Romance beats, chemistry balance
- **UI emphasis**: Relationship web, Arc progression

### Mystery / Thriller (Noir / Whodunit)
- **Entity kinds**: character, suspect, clue, crime, location, event
- **Relationships**: suspects, alibied_by, witnessed, concealing
- **Linter focus**: Clue planting (fair play), timeline airtight
- **UI emphasis**: Evidence board, Timeline, Suspect tracker
- **Special**: DM mode for hiding solution

### Screenplay (Film / TV)
- **Entity kinds**: character, scene_entity, beat, location, faction
- **Relationships**: subplot_with
- **Linter focus**: Page count, beat placement (Save the Cat), dialogue balance
- **UI emphasis**: Beat sheet, Scene cards, Page count tracker
- **Arc template**: Save the Cat beats

### Webnovel / Serial Fiction (LitRPG / Cultivation / Progression)
- **Entity kinds**: character (with power_level), power_system, skill, item, faction, event
- **Relationships**: power_level_above, has_skill, cultivates
- **Linter focus**: Power scaling (no power creep), rank consistency, chapter hooks
- **UI emphasis**: Power ranking chart, Skill tree, Cultivation levels

### Visual Novel / Interactive Fiction (Ren'Py / Twine)
- **Entity kinds**: character, route, choice, ending, location, event
- **Relationships**: affection_level, unlocks, blocks
- **Linter focus**: Route consistency (flags), ending reachability
- **UI emphasis**: Route flowchart, Flag tracker, Ending matrix

### Comics / Graphic Novels
- **Entity kinds**: character, location, arc, item, faction, event
- **Documents**: issue > page > panel hierarchy
- **Relationships**: nemesis, sidekick_of, secret_identity
- **Linter focus**: Panel pacing, dialogue density, page turns
- **UI emphasis**: Storyboard, Panel layout

---

## Core Architecture Principles

### 1. Template-Driven Everything
```
User creates project → Selects template (Epic Fantasy, D&D, Manga, etc.)
                     → Template provides:
                        - Entity kinds (character, spell, technique...)
                        - Relationship kinds
                        - Document kinds
                        - UI modules (which panels/views are shown)
                        - Linter rules (genre-specific)
                        - Default style mode
```

### 2. Extensible Kinds (No Hardcoded Limits)
- DB has NO `CHECK` constraints on entity/document types
- Application validates against template registry
- Users can add custom kinds per-project
- Custom kinds stored in `entity_kind_registry` table

### 3. Mode-Aware Display
- **Writer Mode**: Focus on narrative, hide mechanical details
- **DM Mode**: Show all information, stats, hidden secrets
- Each entity/field can specify `visibleIn: "writer" | "dm" | "both"`

### 4. Universal Entity HUD
The ASCII HUD works for ANY entity type:
```
┌─────────────────────────────────────┐
│ KAEL STORMBORN              [CHAR]  │
├─────────────────────────────────────┤
│ Role: Protagonist                    │
│ Archetype: Hero                      │
│ Status: Healthy | Mood: Determined   │
├─────────────────────────────────────┤
│ TRAITS                              │
│ ▸ Loyal (Strength)                  │
│ ▸ Reckless (Weakness)               │
├─────────────────────────────────────┤
│ RELATIONSHIPS                        │
│ → Mentored by: Aldric               │
│ → Loves: Lyra                       │
│ → Enemy of: The Shadow King         │
└─────────────────────────────────────┘
```

### 5. AI Agents Adapt to Genre
- **Consistency Linter**: Validates against genre-specific rules
- **Writing Coach**: Analyzes based on style mode (hemingway/tolkien/manga/noir)
- **Dynamics Extractor**: Extracts interactions relevant to genre
- **Entity Detector**: Recognizes genre-specific entity types

---

## Implementation Checklist

### Phase 1: Template System (DONE)
- [x] `packages/core/src/templates/types.ts` - Type definitions
- [x] `packages/core/src/templates/builtin.ts` - 14 builtin templates
- [x] `packages/core/src/templates/index.ts` - Exports
- [x] `packages/db/src/migrations/005_flexible_kinds.sql` - Flexible DB schema
- [x] `packages/core/src/schema/project.schema.ts` - templateId in projects

### Phase 2: Template UI (TODO)
- [ ] Template picker in project creation
- [ ] Template preview with entity/document kinds
- [ ] Manifest sidebar reads entity kinds from template
- [ ] Entity form renders template-defined fields
- [ ] Document tree supports template document kinds

### Phase 3: Dynamic Entity Styling (TODO)
- [ ] EntityMark reads color from template registry
- [ ] Generate CSS for custom entity kinds
- [ ] HUD adapts to any entity kind

### Phase 4: Genre-Specific AI (TODO)
- [ ] Linter loads rules from template
- [ ] Coach adapts analysis to genre conventions
- [ ] Entity detector recognizes custom kinds

### Phase 5: Advanced Views (TODO)
- [ ] Storyboard view for manga/comics
- [ ] Encounter builder for D&D
- [ ] Route flowchart for visual novels
- [ ] Power ranking chart for progression fantasy

---

## What Makes This "Notion with IDE + AI"

| Notion | Mythos IDE |
|--------|------------|
| Pages & databases | Documents & entities |
| Properties | Entity fields (template-defined) |
| Relations | Typed relationships with semantic categories |
| Views | Canvas views (Editor, Graph, Map, Timeline) |
| Templates | Genre templates with full configuration |
| Comments | AI coach inline suggestions |
| — | Consistency linting (like type checking) |
| — | Entity HUD (like hover documentation) |
| — | Dynamics stream (like git log) |
| — | DM mode (like feature flags) |

---

## Additional Genres to Consider

### Already Covered
- Epic Fantasy / High Fantasy
- Urban Fantasy / Contemporary Fantasy
- Wizarding World / Magic School
- D&D / Pathfinder / TTRPG
- Call of Cthulhu / Cosmic Horror
- Manga (Shounen/Seinen/Shoujo/Josei)
- Light Novel / Isekai
- LitRPG / Progression Fantasy
- Cultivation Novel (Xianxia/Wuxia)
- Literary Fiction / Classics
- Psychological Drama
- Science Fiction / Space Opera
- Cyberpunk
- Horror / Gothic / Supernatural Thriller
- Romance / Romantic Comedy
- Mystery / Detective Fiction
- Noir / Crime Thriller
- Screenplay / Teleplay
- Stage Play
- Webnovel / Serial Fiction
- Visual Novel / Dating Sim
- Interactive Fiction (Twine/Ink)
- Comics / Graphic Novels
- Superhero Fiction

### Future Additions
- Historical Fiction (timeline-heavy)
- Alternate History (branching timelines)
- Military Fiction (unit/rank hierarchies)
- Sports Fiction (stats, matchups)
- Slice of Life (relationship webs)
- Musical Theatre (song integration)
- Podcast Drama (audio scripting)
- Game Design Documents (mechanics focus)
- Worldbuilding-only (no narrative, pure encyclopedia)

---

## The "Mythos Promise"

**Any story, any genre, any scale.**

Whether you're writing:
- A 10-book epic fantasy saga with invented languages
- A one-shot D&D dungeon crawl
- A 500-chapter webnovel with 100 power levels
- A literary novel exploring moral philosophy
- A manga with 50 named techniques
- A murder mystery with 12 suspects
- A visual novel with 8 routes and 24 endings

Mythos IDE tracks it all, keeps it consistent, and helps you write better.

---

## Technical Notes

### Entity Kind Resolution
```typescript
function getEntityKinds(project: Project): EntityKindDefinition[] {
  const template = getTemplate(project.templateId ?? "blank");
  const builtinKinds = template.entityKinds;
  const customKinds = project.templateOverrides?.customEntityKinds ?? [];
  const disabled = new Set(project.templateOverrides?.disabledEntityKinds ?? []);

  return [
    ...builtinKinds.filter(k => !disabled.has(k.kind)),
    ...customKinds
  ];
}
```

### Linter Rule Loading
```typescript
function getLinterRules(project: Project): LinterRuleDefinition[] {
  const template = getTemplate(project.templateId ?? "blank");
  const templateRules = template.linterRules;
  const customRules = project.config.customRules ?? [];

  return [...templateRules, ...customRules].filter(rule => {
    // Filter by applicable genres if specified
    if (rule.applicableGenres && project.config.genre) {
      return rule.applicableGenres.includes(project.config.genre);
    }
    return true;
  });
}
```

### Mode-Aware Field Rendering
```typescript
function shouldShowField(field: FieldDefinition, mode: "writer" | "dm"): boolean {
  if (!field.visibleIn || field.visibleIn === "both") return true;
  return field.visibleIn === mode;
}
```

---

## Conclusion

This template system transforms Mythos IDE from a "fantasy writing tool" into a **universal creative writing platform**. Every genre has unique needs — power scaling for manga, stat blocks for D&D, clue tracking for mysteries — and the template system ensures each gets a tailored experience while sharing the same powerful core.

The architecture is:
1. **Extensible**: Add new entity kinds without code changes
2. **Configurable**: Each project can customize its template
3. **Mode-aware**: Writer vs DM mode for different perspectives
4. **AI-integrated**: Linting and coaching adapt to genre conventions

This is what makes Mythos "Notion with IDE + AI" — it's not just a document editor, it's a **creative development environment**.
