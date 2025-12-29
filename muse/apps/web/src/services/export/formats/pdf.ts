import type { Project } from "@mythos/core";
import type { ExportOptions, ExportResult } from "../types";
import type { ExportBlock, ExportInline, ExportSection } from "../ir";
import type { GlossarySection } from "../glossary/buildGlossary";
import { FORMAT_METADATA } from "../types";

// ============================================================================
// PDF Renderer (Using pdfmake)
// ============================================================================

export interface PdfRenderParams {
  project: Project;
  sections: ExportSection[];
  glossary?: GlossarySection[];
  options: ExportOptions;
}

// pdfmake types (simplified)
interface PdfContent {
  text?: string | PdfContent[];
  style?: string | string[];
  bold?: boolean;
  italics?: boolean;
  decoration?: string;
  link?: string;
  color?: string;
  background?: string;
  fontSize?: number;
  font?: string;
  margin?: number[];
  alignment?: string;
  ul?: PdfContent[];
  ol?: PdfContent[];
  toc?: { title: PdfContent };
  tocItem?: boolean | string | string[];
  pageBreak?: string;
  canvas?: unknown[];
}

/**
 * Render content to PDF format
 * 
 * Uses dynamic import to load pdfmake only when needed.
 */
export async function renderPdf(params: PdfRenderParams): Promise<ExportResult> {
  const { project, sections, glossary, options } = params;

  // Dynamic import pdfmake
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");

  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const pdfFonts = pdfFontsModule.default ?? pdfFontsModule;

  // Set up virtual file system for fonts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontsAny = pdfFonts as any;
  if (fontsAny?.pdfMake?.vfs) {
    pdfMake.vfs = fontsAny.pdfMake.vfs;
  } else if (fontsAny?.vfs) {
    pdfMake.vfs = fontsAny.vfs;
  }

  const content: PdfContent[] = [];

  // Title page
  if (options.includeTitlePage) {
    content.push({
      text: project.name,
      style: "title",
      margin: [0, 100, 0, 20],
    });

    if (project.description) {
      content.push({
        text: project.description,
        style: "subtitle",
        italics: true,
        margin: [0, 0, 0, 40],
      });
    }

    content.push({ text: "", pageBreak: "after" });
  }

  // Table of contents
  if (options.includeToc && sections.length > 0) {
    content.push({
      toc: {
        title: { text: "Table of Contents", style: "h1" },
      },
    });
    content.push({ text: "", pageBreak: "after" });
  }

  // Content sections
  for (const section of sections) {
    const headingStyle = section.level === 1 ? "h1" : "h2";
    
    content.push({
      text: section.title,
      style: headingStyle,
      tocItem: options.includeToc,
      margin: section.level === 1 ? [0, 20, 0, 10] : [0, 15, 0, 8],
    });

    for (const block of section.blocks) {
      const blockContent = renderPdfBlock(block, options);
      if (blockContent) {
        content.push(blockContent);
      }
    }
  }

  // Glossary
  if (glossary && glossary.length > 0 && options.glossary.include) {
    content.push({ text: "", pageBreak: "before" });

    content.push({
      text: "Glossary",
      style: "h1",
      tocItem: options.includeToc,
      margin: [0, 0, 0, 20],
    });

    for (const section of glossary) {
      content.push({
        text: section.title,
        style: "h2",
        margin: [0, 15, 0, 10],
      });

      for (const entry of section.entries) {
        content.push({
          text: entry.name,
          style: "h3",
          margin: [0, 10, 0, 5],
        });

        if (entry.aliases.length > 0) {
          content.push({
            text: `Also known as: ${entry.aliases.join(", ")}`,
            italics: true,
            margin: [0, 0, 0, 5],
          });
        }

        if (entry.description) {
          content.push({
            text: entry.description,
            margin: [0, 0, 0, 5],
          });
        }

        if (entry.fields && entry.fields.length > 0) {
          for (const field of entry.fields) {
            content.push({
              text: [
                { text: `${field.label}: `, bold: true },
                { text: field.value },
              ],
              margin: [10, 0, 0, 2],
            });
          }
        }
      }
    }
  }

  // Document definition
  const docDefinition = {
    content,
    styles: {
      title: {
        fontSize: 28,
        bold: true,
        alignment: "center",
      },
      subtitle: {
        fontSize: 16,
        alignment: "center",
      },
      h1: {
        fontSize: 20,
        bold: true,
      },
      h2: {
        fontSize: 16,
        bold: true,
      },
      h3: {
        fontSize: 14,
        bold: true,
      },
      code: {
        font: "Courier",
        fontSize: 10,
        background: "#f0f0f0",
      },
      blockquote: {
        italics: true,
        margin: [20, 5, 20, 5],
      },
    },
    defaultStyle: {
      fontSize: 12,
      lineHeight: 1.4,
    },
    pageMargins: [72, 72, 72, 72], // 1 inch margins
  };

  // Generate PDF
  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition as never);
      
      pdfDocGenerator.getBlob((blob: Blob) => {
        const metadata = FORMAT_METADATA.pdf;
        resolve({
          blob,
          mimeType: metadata.mimeType,
          fileName: `${project.name}${metadata.extension}`,
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================================================
// Block Rendering for PDF
// ============================================================================

function renderPdfBlock(
  block: ExportBlock,
  options: ExportOptions
): PdfContent | null {
  switch (block.kind) {
    case "heading": {
      const styleMap: Record<number, string> = {
        1: "h1",
        2: "h2",
        3: "h3",
        4: "h3",
        5: "h3",
        6: "h3",
      };
      return {
        text: renderPdfInlines(block.inlines, options),
        style: styleMap[block.level] ?? "h3",
        margin: [0, 10, 0, 5],
      };
    }

    case "paragraph":
      return {
        text: renderPdfInlines(block.inlines, options),
        margin: [0, 0, 0, 10],
      };

    case "blockquote": {
      const innerContent: PdfContent[] = [];
      for (const innerBlock of block.blocks) {
        const rendered = renderPdfBlock(innerBlock, options);
        if (rendered) {
          innerContent.push(rendered);
        }
      }
      return {
        text: innerContent.length > 0 ? innerContent : [{ text: "" }],
        style: "blockquote",
        margin: [20, 5, 20, 5],
      } as PdfContent;
    }

    case "bulletList":
      return {
        ul: block.items.map((item) => {
          const itemContent = item
            .map((b) => renderPdfBlock(b, options))
            .filter(Boolean);
          return itemContent.length === 1
            ? itemContent[0]!
            : { text: itemContent as PdfContent[] };
        }),
        margin: [0, 5, 0, 10],
      };

    case "orderedList":
      return {
        ol: block.items.map((item) => {
          const itemContent = item
            .map((b) => renderPdfBlock(b, options))
            .filter(Boolean);
          return itemContent.length === 1
            ? itemContent[0]!
            : { text: itemContent as PdfContent[] };
        }),
        margin: [0, 5, 0, 10],
      };

    case "codeBlock":
      return {
        text: block.text,
        style: "code",
        margin: [0, 5, 0, 10],
      };

    case "horizontalRule":
      return {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 450,
            y2: 0,
            lineWidth: 1,
            lineColor: "#cccccc",
          },
        ],
        margin: [0, 10, 0, 10],
      };

    case "sceneBreak":
      return {
        text: "* * *",
        alignment: "center",
        margin: [0, 20, 0, 20],
      };

    default:
      return null;
  }
}

// ============================================================================
// Inline Rendering for PDF
// ============================================================================

function renderPdfInlines(
  inlines: ExportInline[],
  options: ExportOptions
): PdfContent[] {
  const result: PdfContent[] = [];

  for (const inline of inlines) {
    if (inline.kind === "hardBreak") {
      result.push({ text: "\n" });
      continue;
    }

    if (inline.kind !== "text") {
      continue;
    }

    const textObj: PdfContent = { text: inline.text };

    // Apply marks
    if (inline.marks) {
      for (const mark of inline.marks) {
        switch (mark.kind) {
          case "bold":
            textObj.bold = true;
            break;
          case "italic":
            textObj.italics = true;
            break;
          case "strike":
            textObj.decoration = "lineThrough";
            break;
          case "code":
            textObj.font = "Courier";
            textObj.background = "#f0f0f0";
            break;
          case "underline":
            textObj.decoration = "underline";
            break;
          case "link":
            textObj.link = mark.href;
            textObj.color = "blue";
            textObj.decoration = "underline";
            break;
          case "entity":
            if (options.preserveEntityMarks) {
              // Highlight entity mentions
              textObj.background = "#ffffcc";
            }
            break;
        }
      }
    }

    result.push(textObj);
  }

  return result;
}
