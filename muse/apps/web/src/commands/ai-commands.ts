import {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Zap,
  Brain,
  Eye,
} from "lucide-react";
import type { Command } from "./registry";

export const aiCommands: Command[] = [
  {
    id: "ai.chat",
    label: "Ask AI About Story",
    description: "Open AI chat to ask questions about your story",
    icon: MessageSquare,
    category: "ai",
    keywords: ["chat", "ai", "ask", "question", "help", "assistant"],
    shortcut: "⌘/",
    requiredModule: "console",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("chat");
    },
  },
  {
    id: "ai.detect-entities",
    label: "Detect Entities in Selection",
    description: "Use AI to detect and suggest entities from selected text",
    icon: Sparkles,
    category: "ai",
    keywords: ["detect", "entity", "extract", "selection", "ai"],
    when: (ctx) => 
      ctx.state.project.currentProject !== null && 
      ctx.selectedText !== null && 
      ctx.selectedText.length > 0,
    execute: (ctx) => {
      // This will be implemented with AI detection
      // For now, switch to chat tab
      ctx.setActiveTab("chat");
    },
  },
  {
    id: "ai.lint",
    label: "Check Story Consistency",
    description: "Run AI linter to check for consistency issues",
    icon: AlertTriangle,
    category: "ai",
    keywords: ["lint", "check", "consistency", "errors", "issues", "validate"],
    shortcut: "⌘⇧L",
    requiredModule: "console",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("linter");
      // Trigger linter run via store action
      ctx.state.linter.isRunning = false; // Will trigger a new run
    },
  },
  {
    id: "ai.analyze",
    label: "Analyze Writing Style",
    description: "Get AI feedback on pacing, show-don't-tell, and more",
    icon: Brain,
    category: "ai",
    keywords: ["analyze", "style", "coach", "feedback", "pacing", "writing"],
    requiredModule: "console",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("coach");
    },
  },
  {
    id: "ai.dynamics",
    label: "Extract Entity Dynamics",
    description: "Analyze interactions and relationships between entities",
    icon: Zap,
    category: "ai",
    keywords: ["dynamics", "interactions", "relationships", "extract"],
    requiredModule: "console",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("dynamics");
    },
  },
  {
    id: "ai.clarity-check",
    label: "Check Clarity",
    description: "Find ambiguous pronouns, clichés, filler words, and readability issues",
    icon: Eye,
    category: "ai",
    keywords: ["clarity", "clear", "pronoun", "cliche", "filler", "readability", "check"],
    requiredModule: "console",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      // Switch to chat tab and let user invoke via quick action or chat
      ctx.setActiveTab("chat");
    },
  },
];
