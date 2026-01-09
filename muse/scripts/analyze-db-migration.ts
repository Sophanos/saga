#!/usr/bin/env bun
/**
 * Analyze @mythos/db imports and suggest Convex replacements
 *
 * Run: bun scripts/analyze-db-migration.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, relative, join } from "path";

const ROOT = resolve(import.meta.dirname, "..");

// ============================================================================
// Convex API Mapping
// ============================================================================

const CONVEX_REPLACEMENTS: Record<string, {
  convexModule: string;
  convexFunction: string;
  hook?: string;
  notes?: string;
}> = {
  // Project operations
  createProject: {
    convexModule: "projects",
    convexFunction: "create",
    hook: "useMutation(api.projects.create)",
    notes: "Use useMutation from convex/react",
  },
  getProject: {
    convexModule: "projects",
    convexFunction: "get",
    hook: "useQuery(api.projects.get, { id })",
  },
  listProjects: {
    convexModule: "projects",
    convexFunction: "list",
    hook: "useQuery(api.projects.list)",
  },
  updateProject: {
    convexModule: "projects",
    convexFunction: "update",
    hook: "useMutation(api.projects.update)",
  },
  deleteProject: {
    convexModule: "projects",
    convexFunction: "remove",
    hook: "useMutation(api.projects.remove)",
  },

  // Document operations
  createDocument: {
    convexModule: "documents",
    convexFunction: "create",
    hook: "useMutation(api.documents.create)",
  },
  getDocument: {
    convexModule: "documents",
    convexFunction: "get",
    hook: "useQuery(api.documents.get, { id })",
  },
  updateDocument: {
    convexModule: "documents",
    convexFunction: "update",
    hook: "useMutation(api.documents.update)",
  },
  deleteDocument: {
    convexModule: "documents",
    convexFunction: "remove",
    hook: "useMutation(api.documents.remove)",
  },
  listDocuments: {
    convexModule: "documents",
    convexFunction: "list",
    hook: "useQuery(api.documents.list, { projectId })",
  },
  mapDbDocumentToDocument: {
    convexModule: "N/A",
    convexFunction: "N/A",
    notes: "Remove - Convex returns proper types directly",
  },

  // Entity operations
  createEntity: {
    convexModule: "entities",
    convexFunction: "create",
    hook: "useMutation(api.entities.create)",
  },
  getEntity: {
    convexModule: "entities",
    convexFunction: "get",
    hook: "useQuery(api.entities.get, { id })",
  },
  updateEntity: {
    convexModule: "entities",
    convexFunction: "update",
    hook: "useMutation(api.entities.update)",
  },
  deleteEntity: {
    convexModule: "entities",
    convexFunction: "remove",
    hook: "useMutation(api.entities.remove)",
  },
  listEntities: {
    convexModule: "entities",
    convexFunction: "list",
    hook: "useQuery(api.entities.list, { projectId })",
  },
  mapDbEntityToEntity: {
    convexModule: "N/A",
    convexFunction: "N/A",
    notes: "Remove - Convex returns proper types directly",
  },

  // Relationship operations
  createRelationship: {
    convexModule: "relationships",
    convexFunction: "create",
    hook: "useMutation(api.relationships.create)",
  },
  getRelationship: {
    convexModule: "relationships",
    convexFunction: "get",
    hook: "useQuery(api.relationships.get, { id })",
  },
  updateRelationship: {
    convexModule: "relationships",
    convexFunction: "update",
    hook: "useMutation(api.relationships.update)",
  },
  deleteRelationship: {
    convexModule: "relationships",
    convexFunction: "remove",
    hook: "useMutation(api.relationships.remove)",
  },
  listRelationships: {
    convexModule: "relationships",
    convexFunction: "list",
    hook: "useQuery(api.relationships.list, { projectId })",
  },

  // Collaboration operations
  createInvitation: {
    convexModule: "collaboration",
    convexFunction: "createInvite",
    hook: "useMutation(api.collaboration.createInvite)",
  },
  getInvitationByToken: {
    convexModule: "collaboration",
    convexFunction: "getInviteByToken",
    hook: "useQuery(api.collaboration.getInviteByToken, { token })",
  },
  acceptInvitation: {
    convexModule: "collaboration",
    convexFunction: "acceptInvite",
    hook: "useMutation(api.collaboration.acceptInvite)",
  },
  listProjectMembers: {
    convexModule: "collaboration",
    convexFunction: "listMembers",
    hook: "useQuery(api.collaboration.listMembers, { projectId })",
  },
  updateMemberRole: {
    convexModule: "collaboration",
    convexFunction: "updateMemberRole",
    hook: "useMutation(api.collaboration.updateMemberRole)",
  },
  removeMember: {
    convexModule: "collaboration",
    convexFunction: "removeMember",
    hook: "useMutation(api.collaboration.removeMember)",
  },
  listInvitations: {
    convexModule: "collaboration",
    convexFunction: "listInvites",
    hook: "useQuery(api.collaboration.listInvites, { projectId })",
  },
  cancelInvitation: {
    convexModule: "collaboration",
    convexFunction: "cancelInvite",
    hook: "useMutation(api.collaboration.cancelInvite)",
  },

  // Activity operations
  listProjectActivity: {
    convexModule: "collaboration",
    convexFunction: "listActivity",
    hook: "useQuery(api.collaboration.listActivity, { projectId })",
  },
  createActivityEvent: {
    convexModule: "collaboration",
    convexFunction: "logActivity",
    hook: "useMutation(api.collaboration.logActivity)",
  },

  // Presence operations
  updatePresence: {
    convexModule: "collaboration",
    convexFunction: "updatePresence",
    hook: "useMutation(api.collaboration.updatePresence)",
  },
  subscribeToPresence: {
    convexModule: "collaboration",
    convexFunction: "getPresence",
    hook: "useQuery(api.collaboration.getPresence, { projectId })",
    notes: "Convex queries are automatically reactive",
  },

  // Supabase-specific (need complete rewrite)
  getSupabaseClient: {
    convexModule: "N/A",
    convexFunction: "N/A",
    notes: "REMOVE - Use Convex client from ConvexProvider context",
  },
  isSupabaseInitialized: {
    convexModule: "N/A",
    convexFunction: "N/A",
    notes: "REMOVE - Convex is always available via provider",
  },

  // Types
  Database: {
    convexModule: "N/A",
    convexFunction: "N/A",
    notes: "Use types from convex/_generated/dataModel instead",
  },
  DbProgressiveProjectState: {
    convexModule: "N/A",
    convexFunction: "N/A",
    notes: "Define locally or import from @mythos/core",
  },
};

// ============================================================================
// Analysis Functions
// ============================================================================

interface ImportInfo {
  file: string;
  imports: string[];
  isTypeOnly: boolean;
  line: number;
  lineContent: string;
}

interface FileAnalysis {
  file: string;
  relativePath: string;
  imports: ImportInfo[];
  suggestions: Array<{
    importName: string;
    replacement: typeof CONVEX_REPLACEMENTS[string] | null;
    action: "replace" | "remove" | "manual";
  }>;
}

function extractImports(filePath: string): ImportInfo[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const imports: ImportInfo[] = [];

  const importRegex = /^(import\s+(?:type\s+)?)\{([^}]+)\}\s+from\s+['"]@mythos\/db['"]/;
  const singleImportRegex = /^(import\s+(?:type\s+)?)(\w+)\s+from\s+['"]@mythos\/db['"]/;

  lines.forEach((line, index) => {
    const match = line.match(importRegex);
    if (match) {
      const isTypeOnly = match[1]?.includes("type") ?? false;
      const importList = match[2]!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim());

      imports.push({
        file: filePath,
        imports: importList,
        isTypeOnly,
        line: index + 1,
        lineContent: line,
      });
    }

    const singleMatch = line.match(singleImportRegex);
    if (singleMatch) {
      imports.push({
        file: filePath,
        imports: [singleMatch[2]!],
        isTypeOnly: singleMatch[1]?.includes("type") ?? false,
        line: index + 1,
        lineContent: line,
      });
    }
  });

  return imports;
}

function analyzeFile(filePath: string): FileAnalysis {
  const imports = extractImports(filePath);
  const suggestions: FileAnalysis["suggestions"] = [];

  for (const importInfo of imports) {
    for (const importName of importInfo.imports) {
      const replacement = CONVEX_REPLACEMENTS[importName];

      if (replacement) {
        if (replacement.convexModule === "N/A") {
          suggestions.push({
            importName,
            replacement,
            action: replacement.notes?.includes("Remove") ? "remove" : "manual",
          });
        } else {
          suggestions.push({
            importName,
            replacement,
            action: "replace",
          });
        }
      } else {
        suggestions.push({
          importName,
          replacement: null,
          action: "manual",
        });
      }
    }
  }

  return {
    file: filePath,
    relativePath: relative(ROOT, filePath),
    imports,
    suggestions,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(analyses: FileAnalysis[]): string {
  let report = `# @mythos/db Migration Report
Generated: ${new Date().toISOString()}

## Summary
- Total files with @mythos/db imports: ${analyses.length}
- Total imports to migrate: ${analyses.reduce((sum, a) => sum + a.suggestions.length, 0)}

## Files by Priority

### High Priority (Hooks - need Convex hooks)
${analyses
  .filter((a) => a.relativePath.includes("/hooks/"))
  .map((a) => `- \`${a.relativePath}\` (${a.suggestions.length} imports)`)
  .join("\n")}

### Medium Priority (Components)
${analyses
  .filter((a) => a.relativePath.includes("/components/"))
  .map((a) => `- \`${a.relativePath}\` (${a.suggestions.length} imports)`)
  .join("\n")}

### Low Priority (Services/Utils)
${analyses
  .filter((a) => a.relativePath.includes("/services/") || a.relativePath.includes("/utils/"))
  .map((a) => `- \`${a.relativePath}\` (${a.suggestions.length} imports)`)
  .join("\n")}

### Other
${analyses
  .filter(
    (a) =>
      !a.relativePath.includes("/hooks/") &&
      !a.relativePath.includes("/components/") &&
      !a.relativePath.includes("/services/") &&
      !a.relativePath.includes("/utils/")
  )
  .map((a) => `- \`${a.relativePath}\` (${a.suggestions.length} imports)`)
  .join("\n")}

## Detailed Migration Guide

`;

  for (const analysis of analyses) {
    report += `### \`${analysis.relativePath}\`\n\n`;

    if (analysis.imports.length === 0) {
      report += `No imports found.\n\n`;
      continue;
    }

    report += `**Current imports:**\n`;
    for (const imp of analysis.imports) {
      report += `\`\`\`typescript\n// Line ${imp.line}\n${imp.lineContent}\n\`\`\`\n`;
    }

    report += `\n**Migration steps:**\n\n`;

    for (const suggestion of analysis.suggestions) {
      if (suggestion.action === "replace" && suggestion.replacement) {
        report += `- \`${suggestion.importName}\` → \`${suggestion.replacement.hook}\`\n`;
        if (suggestion.replacement.notes) {
          report += `  - Note: ${suggestion.replacement.notes}\n`;
        }
      } else if (suggestion.action === "remove") {
        report += `- \`${suggestion.importName}\` → **REMOVE**\n`;
        if (suggestion.replacement?.notes) {
          report += `  - ${suggestion.replacement.notes}\n`;
        }
      } else {
        report += `- \`${suggestion.importName}\` → **MANUAL REVIEW REQUIRED**\n`;
        if (suggestion.replacement?.notes) {
          report += `  - ${suggestion.replacement.notes}\n`;
        }
      }
    }

    report += `\n`;
  }

  report += `## Convex Import Template

Add these imports to replace @mythos/db:

\`\`\`typescript
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id, Doc } from "../../../../convex/_generated/dataModel";
\`\`\`

## Common Patterns

### Before (Supabase)
\`\`\`typescript
import { createDocument, getDocument } from "@" + "mythos/db";

// Usage
const doc = await createDocument({ title: "My Doc", projectId });
\`\`\`

### After (Convex)
\`\`\`typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

// In component
const createDocument = useMutation(api.documents.create);
const document = useQuery(api.documents.get, { id: documentId });

// Usage
await createDocument({ title: "My Doc", projectId });
\`\`\`
`;

  return report;
}

// ============================================================================
// Main
// ============================================================================

function walkDir(dir: string, fileList: string[] = []): string[] {
  const ignoreDirs = ["node_modules", "dist", ".turbo", ".git", ".next", "build"];

  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          if (!ignoreDirs.includes(file)) {
            walkDir(filePath, fileList);
          }
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          fileList.push(filePath);
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return fileList;
}

async function main() {
  console.log("🔍 Analyzing @mythos/db imports...\n");

  // Find all TypeScript files
  const files = walkDir(ROOT);

  const analyses: FileAnalysis[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    if (content.includes("@mythos/db")) {
      const analysis = analyzeFile(file);
      if (analysis.imports.length > 0) {
        analyses.push(analysis);
      }
    }
  }

  // Sort by priority (hooks first)
  analyses.sort((a, b) => {
    const aIsHook = a.relativePath.includes("/hooks/") ? 0 : 1;
    const bIsHook = b.relativePath.includes("/hooks/") ? 0 : 1;
    return aIsHook - bIsHook || a.relativePath.localeCompare(b.relativePath);
  });

  // Generate report
  const report = generateReport(analyses);
  const reportPath = resolve(ROOT, "DB_MIGRATION_REPORT.md");
  writeFileSync(reportPath, report);

  console.log(`📊 Found ${analyses.length} files with @mythos/db imports`);
  console.log(`📝 Report written to: ${reportPath}\n`);

  // Print summary
  console.log("Summary by action type:");
  const actionCounts = { replace: 0, remove: 0, manual: 0 };
  for (const analysis of analyses) {
    for (const suggestion of analysis.suggestions) {
      actionCounts[suggestion.action]++;
    }
  }
  console.log(`  ✅ Can auto-replace: ${actionCounts.replace}`);
  console.log(`  🗑️  Can remove: ${actionCounts.remove}`);
  console.log(`  ⚠️  Manual review: ${actionCounts.manual}`);

  // Print files that need work
  console.log("\nFiles requiring migration:");
  for (const analysis of analyses) {
    const icon = analysis.relativePath.includes("/hooks/")
      ? "🪝"
      : analysis.relativePath.includes("/components/")
        ? "🧩"
        : "📄";
    console.log(`  ${icon} ${analysis.relativePath}`);
  }
}

main().catch(console.error);
