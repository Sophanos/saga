import type { Project } from "@mythos/core";
import type { ExportOptions, ExportResult } from "../types";
import type { ExportBlock, ExportInline, ExportMark, ExportSection } from "../ir";
import type { GlossarySection } from "../glossary/buildGlossary";
import { FORMAT_METADATA } from "../types";
import { slugify } from "../utils/sanitizeFileName";

// ============================================================================
// Markdown Renderer
// ============================================================================

export interface MarkdownRenderParams {
  project: Project;
  sections: ExportSection[];
  glossary?: GlossarySection[];
  options: ExportOptions;
}

/**
 * Render content to Markdown format
 */
export function renderMarkdown(params: MarkdownRenderParams): ExportResult {
  const { project, sections, glossary, options } = params;
  const lines: string[] = [];

  // Title page
  if (options.includeTitlePage) {
    lines.push(`# ${project.name}`);
    lines.push("");
    if (project.description) {
      lines.push(`*${project.description}*`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  // Table of contents
  if (options.includeToc && sections.length > 0) {
    lines.push("## Table of Contents");
    lines.push("");
    for (const section of sections) {
      const indent = section.level === 2 ? "  " : "";
      const slug = slugify(section.title);
      lines.push(`${indent}- [${section.title}](#${slug})`);
    }
    if (glossary && glossary.length > 0 && options.glossary.include) {
      lines.push("- [Glossary](#glossary)");
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Content sections
  for (const section of sections) {
    const headingPrefix = section.level === 1 ? "# " : "## ";
    lines.push(`${headingPrefix}${section.title}`);
    lines.push("");

    for (const block of section.blocks) {
      const blockLines = renderBlock(block, options);
      lines.push(...blockLines);
    }

    lines.push("");
  }

  // Glossary
  if (glossary && glossary.length > 0 && options.glossary.include) {
    lines.push("---");
    lines.push("");
    lines.push("# Glossary");
    lines.push("");

    for (const section of glossary) {
      lines.push(`## ${section.title}`);
      lines.push("");

      for (const entry of section.entries) {
        // Anchor for linking
        lines.push(`<a id="entity-${entry.id}"></a>`);
        lines.push("");
        lines.push(`### ${entry.name}`);
        lines.push("");

        if (entry.aliases.length > 0) {
          lines.push(`*Also known as: ${entry.aliases.join(", ")}*`);
          lines.push("");
        }

        if (entry.description) {
          lines.push(entry.description);
          lines.push("");
        }

        if (entry.fields && entry.fields.length > 0) {
          for (const field of entry.fields) {
            lines.push(`- **${field.label}:** ${field.value}`);
          }
          lines.push("");
        }
      }
    }
  }

  const content = lines.join("\n");
  const metadata = FORMAT_METADATA.markdown;

  return {
    blob: new Blob([content], { type: `${metadata.mimeType};charset=utf-8` }),
    mimeType: metadata.mimeType,
    fileName: `${project.name}${metadata.extension}`,
  };
}

// ============================================================================
// Block Rendering
// ============================================================================

function renderBlock(block: ExportBlock, options: ExportOptions): string[] {
  switch (block.kind) {
    case "heading": {
      const prefix = "#".repeat(Math.min(block.level + 1, 6)) + " ";
      const text = renderInlines(block.inlines, options);
      return [prefix + text, ""];
    }

    case "paragraph": {
      const text = renderInlines(block.inlines, options);
      return [text, ""];
    }

    case "blockquote": {
      const lines: string[] = [];
      for (const innerBlock of block.blocks) {
        const innerLines = renderBlock(innerBlock, options);
        for (const line of innerLines) {
          lines.push(line ? `> ${line}` : ">");
        }
      }
      return [...lines, ""];
    }

    case "bulletList": {
      const lines: string[] = [];
      for (const item of block.items) {
        const itemContent = item
          .flatMap((b) => renderBlock(b, options))
          .filter((l) => l.trim())
          .join(" ");
        lines.push(`- ${itemContent}`);
      }
      return [...lines, ""];
    }

    case "orderedList": {
      const lines: string[] = [];
      const start = block.start ?? 1;
      for (let i = 0; i < block.items.length; i++) {
        const item = block.items[i];
        const itemContent = item
          .flatMap((b) => renderBlock(b, options))
          .filter((l) => l.trim())
          .join(" ");
        lines.push(`${start + i}. ${itemContent}`);
      }
      return [...lines, ""];
    }

    case "codeBlock": {
      const lang = block.language ?? "";
      return [`\`\`\`${lang}`, block.text, "```", ""];
    }

    case "horizontalRule":
      return ["---", ""];

    case "sceneBreak":
      return ["", "* * *", ""];

    default:
      return [];
  }
}

// ============================================================================
// Inline Rendering
// ============================================================================

function renderInlines(inlines: ExportInline[], options: ExportOptions): string {
  return inlines.map((inline) => renderInline(inline, options)).join("");
}

function renderInline(inline: ExportInline, options: ExportOptions): string {
  if (inline.kind === "hardBreak") {
    return "  \n";
  }

  if (inline.kind !== "text") {
    return "";
  }

  let text = inline.text;

  // Escape markdown special characters in text
  text = escapeMarkdown(text);

  // Apply marks
  if (inline.marks) {
    text = applyMarks(text, inline.marks, options);
  }

  return text;
}

function applyMarks(
  text: string,
  marks: ExportMark[],
  options: ExportOptions
): string {
  let result = text;

  // Sort marks to apply in consistent order (inner to outer)
  const sortedMarks = [...marks].sort((a, b) => {
    const order: Record<string, number> = {
      code: 0,
      entity: 1,
      link: 2,
      strike: 3,
      italic: 4,
      bold: 5,
    };
    return (order[a.kind] ?? 99) - (order[b.kind] ?? 99);
  });

  for (const mark of sortedMarks) {
    switch (mark.kind) {
      case "bold":
        result = `**${result}**`;
        break;

      case "italic":
        result = `*${result}*`;
        break;

      case "strike":
        result = `~~${result}~~`;
        break;

      case "code":
        result = `\`${result}\``;
        break;

      case "underline":
        // Markdown doesn't support underline natively, use HTML
        result = `<u>${result}</u>`;
        break;

      case "link":
        result = `[${result}](${mark.href})`;
        break;

      case "entity":
        if (options.preserveEntityMarks && options.glossary.include) {
          // Link to glossary entry
          result = `[${result}](#entity-${mark.entityId})`;
        }
        // Otherwise, just leave as plain text
        break;
    }
  }

  return result;
}

/**
 * Escape special markdown characters
 */
function escapeMarkdown(text: string): string {
  // Escape characters that have special meaning in markdown
  // But be careful not to escape inside code spans
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, "\\$1");
}
