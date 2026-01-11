/**
 * Project Type Definitions for Template Builder
 *
 * Shared between web and mobile AI Template Builder implementations.
 */

export type ProjectType = "story" | "product" | "engineering" | "design" | "comms" | "cinema";

export type TemplateBuilderPhase =
  | "type_select"
  | "discovery"
  | "generate"
  | "review"
  | "done";

export type AccentKey = "purple" | "green" | "amber" | "orange" | "pink" | "yellow";

export interface ProjectTypeDef {
  label: string;
  description: string;
  accent: AccentKey;
  baseTemplateId: string;
}

export const PROJECT_TYPE_ORDER: ProjectType[] = [
  "story",
  "product",
  "engineering",
  "design",
  "comms",
  "cinema",
];

export const PROJECT_TYPE_DEFS: Record<ProjectType, ProjectTypeDef> = {
  story: {
    label: "Story / World",
    description: "Fiction, lore, and narrative worlds with characters, places, and arcs.",
    accent: "purple",
    baseTemplateId: "writer",
  },
  product: {
    label: "Product",
    description: "Vision, features, users, and releases for digital or physical products.",
    accent: "amber",
    baseTemplateId: "product",
  },
  engineering: {
    label: "Engineering",
    description: "Systems, services, architecture, and operational workflows.",
    accent: "orange",
    baseTemplateId: "engineering",
  },
  design: {
    label: "Design",
    description: "Interfaces, systems, and visual languages for experiences.",
    accent: "pink",
    baseTemplateId: "design",
  },
  comms: {
    label: "Communications",
    description: "Campaigns, messaging, and launch narratives across channels.",
    accent: "yellow",
    baseTemplateId: "comms",
  },
  cinema: {
    label: "Cinema / Film",
    description: "Scripts, scenes, shots, and production planning for screen stories.",
    accent: "green",
    baseTemplateId: "cinema",
  },
};

export interface Suggestion {
  label: string;
  prompt: string;
}

export const DOMAIN_SUGGESTIONS: Record<ProjectType, Suggestion[]> = {
  story: [
    {
      label: "Noir detective",
      prompt:
        "A noir detective story with supernatural elements, set in a rain-soaked 1940s city where magic lurks in the shadows",
    },
    {
      label: "Space opera",
      prompt:
        "A space opera with warring factions, ancient alien artifacts, and a ragtag crew caught in the middle",
    },
    {
      label: "Cozy fantasy",
      prompt: "A cozy fantasy about a found family running a magical bakery in a small village",
    },
    {
      label: "TTRPG campaign",
      prompt:
        "A TTRPG campaign setting in a post-apocalyptic world where magic returned after the collapse",
    },
  ],
  product: [
    {
      label: "Remote team rituals",
      prompt:
        "A productivity app for remote teams focused on weekly planning, async check-ins, and habit reinforcement",
    },
    {
      label: "Teen fintech",
      prompt:
        "A consumer fintech product for teens to manage allowances, saving goals, and supervised spending",
    },
    {
      label: "Logistics analytics",
      prompt:
        "A B2B analytics dashboard for logistics managers to monitor delays, costs, and operational KPIs",
    },
  ],
  engineering: [
    {
      label: "Realtime observability",
      prompt:
        "An event-driven platform for realtime monitoring with strict uptime requirements and multi-region failover",
    },
    {
      label: "Platform enablement",
      prompt:
        "An internal engineering platform to standardize CI/CD, deployments, and service ownership for multiple teams",
    },
    {
      label: "Data streaming",
      prompt:
        "A data pipeline that ingests telemetry at scale and powers both streaming alerts and batch analytics",
    },
  ],
  design: [
    {
      label: "Fintech dashboard",
      prompt:
        "A design system for a data-dense fintech dashboard with tables, alerts, and accessibility constraints",
    },
    {
      label: "Wellness onboarding",
      prompt:
        "A mobile onboarding flow for a wellness app with a calming tone and progressive disclosure",
    },
    {
      label: "Marketing components",
      prompt:
        "A component library for a marketing site that needs strong brand expression and responsive behavior",
    },
  ],
  comms: [
    {
      label: "Sustainable launch",
      prompt:
        "A product launch campaign for sustainable apparel aimed at Gen Z with social-first storytelling",
    },
    {
      label: "Change management",
      prompt:
        "Internal comms for rolling out a new tooling platform across a fast-growing organization",
    },
    {
      label: "Series A press",
      prompt: "A press and messaging strategy for a startup announcing its Series A funding",
    },
  ],
  cinema: [
    {
      label: "Neo-noir heist",
      prompt:
        "A neo-noir heist film set in a flooded coastal city where the tide controls the schedule",
    },
    {
      label: "Generation ship",
      prompt:
        "A coming-of-age sci-fi short about a teenager rebelling aboard a generation ship",
    },
    {
      label: "Remote thriller",
      prompt:
        "A psychological thriller set in a remote research station where isolation drives paranoia",
    },
  ],
};

export interface DomainQuestion {
  id: string;
  question: string;
  placeholder?: string;
}

export const DOMAIN_QUESTIONS: Record<ProjectType, DomainQuestion[]> = {
  story: [
    { id: "genre", question: "What genre and tone should define this world?" },
    { id: "conflict", question: "What central conflict or tension drives the story?" },
    { id: "setting", question: "Where and when does it take place?" },
    { id: "cast", question: "Who are the core characters or factions?" },
    { id: "rules", question: "What rules or systems (magic, tech, society) must be respected?" },
    { id: "scope", question: "How big is the scope: intimate, city-scale, or epic?" },
  ],
  product: [
    { id: "user", question: "Who is the primary user and what job are they hiring this for?" },
    { id: "workflow", question: "What is the core workflow on day one?" },
    { id: "metrics", question: "Which success metrics matter most?" },
    { id: "constraints", question: "Any constraints (platform, integrations, compliance)?" },
    { id: "release", question: "What is the target release or milestone?" },
    { id: "edge", question: "What should differentiate this product in the market?" },
  ],
  engineering: [
    { id: "boundaries", question: "What are the system boundaries and critical services?" },
    { id: "scale", question: "What scale or SLA must it meet?" },
    { id: "data", question: "What data stores or schemas are central?" },
    { id: "ownership", question: "Who owns the services and on-call rotation?" },
    { id: "deploy", question: "Where does it run (cloud, edge, on-prem)?" },
    { id: "resilience", question: "Which failure modes need explicit handling?" },
  ],
  design: [
    { id: "platform", question: "Which platforms and primary screens matter most?" },
    { id: "principles", question: "What design principles or brand attributes should lead?" },
    { id: "components", question: "Which component families are essential?" },
    { id: "systems", question: "Do you need tokens, grids, or responsive rules?" },
    { id: "accessibility", question: "Any accessibility or localization requirements?" },
    { id: "handoff", question: "How will the design system be handed off to engineering?" },
  ],
  comms: [
    { id: "goal", question: "What is the primary goal of this communication effort?" },
    { id: "audience", question: "Who is the audience and what do they care about?" },
    { id: "message", question: "What is the core message or narrative arc?" },
    { id: "channels", question: "Which channels will carry the message?" },
    { id: "timeline", question: "What is the launch or campaign timeline?" },
    { id: "success", question: "How will success be measured?" },
  ],
  cinema: [
    { id: "genre", question: "What genre and tone should the film convey?" },
    { id: "setting", question: "Where and when does the story take place?" },
    { id: "characters", question: "Who are the core characters and relationships?" },
    { id: "format", question: "What format: feature, short, series, or episodic?" },
    { id: "visual", question: "What visual language or references inspire it?" },
    { id: "constraints", question: "Any production or budget constraints to design around?" },
  ],
};

export interface ProjectTypeBlueprint {
  focus: string[];
  entities: string[];
  relationships: string[];
  documents: string[];
}

export const PROJECT_TYPE_BLUEPRINTS: Record<ProjectType, ProjectTypeBlueprint> = {
  story: {
    focus: ["World rules", "Core cast", "Narrative arc"],
    entities: ["Characters", "Locations", "Factions", "Systems", "Events"],
    relationships: ["Alliances", "Rivalries", "Mentorships"],
    documents: ["Chapters", "Scenes", "World notes", "Timeline"],
  },
  product: {
    focus: ["User journey", "Feature scope", "Success metrics"],
    entities: ["Personas", "Features", "Epics", "Releases", "Metrics"],
    relationships: ["Depends on", "Owned by", "Measured by"],
    documents: ["PRD", "Roadmap", "Release notes", "Specs"],
  },
  engineering: {
    focus: ["Service map", "Reliability goals", "Operational runbooks"],
    entities: ["Services", "APIs", "Datastores", "Incidents", "Runbooks"],
    relationships: ["Calls", "Depends on", "Impacts"],
    documents: ["Architecture", "Runbooks", "Postmortems"],
  },
  design: {
    focus: ["Visual language", "System components", "Usage guidance"],
    entities: ["Components", "Screens", "Tokens", "Patterns"],
    relationships: ["Uses", "Variants", "Composed of"],
    documents: ["Design brief", "Guidelines", "Specs"],
  },
  comms: {
    focus: ["Audience narrative", "Channel plan", "Performance signals"],
    entities: ["Campaigns", "Messages", "Audiences", "Assets"],
    relationships: ["Targets", "Published on", "Measured by"],
    documents: ["Campaign brief", "Content calendar", "Press kit"],
  },
  cinema: {
    focus: ["Story beats", "Scene structure", "Visual planning"],
    entities: ["Characters", "Locations", "Scenes", "Shots", "Props"],
    relationships: ["Appears in", "Transitions", "Motivates"],
    documents: ["Screenplay", "Scene breakdown", "Shot list"],
  },
};
