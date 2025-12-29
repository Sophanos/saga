import type { Project } from "@mythos/core";
import type { ExportOptions, ExportResult } from "../types";
import type { ExportBlock, ExportInline, ExportSection } from "../ir";
import type { GlossarySection } from "../glossary/buildGlossary";
import { FORMAT_METADATA } from "../types";

// ============================================================================
// DOCX Renderer (Dynamic Import)
// ============================================================================

export interface DocxRenderParams {
  project: Project;
  sections: ExportSection[];
  glossary?: GlossarySection[];
  options: ExportOptions;
}

/**
 * Render content to DOCX format
 * 
 * Uses dynamic import to load the docx library only when needed.
 */
export async function renderDocx(params: DocxRenderParams): Promise<ExportResult> {
  // Dynamic import to reduce initial bundle size
  const docx = await import("docx");
  const {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    PageBreak,
    Packer,
  } = docx;

  const { project, sections, glossary, options } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // Title page
  if (options.includeTitlePage) {
    children.push(
      new Paragraph({
        text: project.name,
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      })
    );

    if (project.description) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: project.description,
              italics: true,
            }),
          ],
          spacing: { after: 400 },
        })
      );
    }

    // Page break after title
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // Table of contents - simplified version without TableOfContents component
  if (options.includeToc && sections.length > 0) {
    children.push(
      new Paragraph({
        text: "Table of Contents",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    // Manual TOC as simple list
    for (const section of sections) {
      const indent = section.level === 2 ? 720 : 0;
      children.push(
        new Paragraph({
          text: section.title,
          indent: { left: indent },
          spacing: { after: 60 },
        })
      );
    }

    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // Content sections
  for (const section of sections) {
    const headingLevel =
      section.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;

    children.push(
      new Paragraph({
        text: section.title,
        heading: headingLevel,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const block of section.blocks) {
      const blockParagraphs = renderDocxBlock(block, options, docx);
      children.push(...blockParagraphs);
    }
  }

  // Glossary
  if (glossary && glossary.length > 0 && options.glossary.include) {
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    children.push(
      new Paragraph({
        text: "Glossary",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    for (const section of glossary) {
      children.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      for (const entry of section.entries) {
        children.push(
          new Paragraph({
            text: entry.name,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100 },
          })
        );

        if (entry.aliases.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Also known as: ${entry.aliases.join(", ")}`,
                  italics: true,
                }),
              ],
            })
          );
        }

        if (entry.description) {
          children.push(
            new Paragraph({
              text: entry.description,
            })
          );
        }

        if (entry.fields && entry.fields.length > 0) {
          for (const field of entry.fields) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${field.label}: `,
                    bold: true,
                  }),
                  new TextRun({
                    text: field.value,
                  }),
                ],
              })
            );
          }
        }
      }
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: "Times New Roman",
            size: 24, // 12pt
          },
          paragraph: {
            spacing: { line: 360, after: 200 },
          },
        },
      ],
    },
  });

  // Generate blob
  const buffer = await Packer.toBlob(doc);
  const metadata = FORMAT_METADATA.docx;

  return {
    blob: buffer,
    mimeType: metadata.mimeType,
    fileName: `${project.name}${metadata.extension}`,
  };
}

// ============================================================================
// Block Rendering for DOCX
// ============================================================================

function renderDocxBlock(
  block: ExportBlock,
  options: ExportOptions,
  docx: typeof import("docx")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const { Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = docx;

  switch (block.kind) {
    case "heading": {
      const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      return [
        new Paragraph({
          children: renderDocxInlines(block.inlines, options, docx),
          heading: levelMap[block.level] ?? HeadingLevel.HEADING_3,
        }),
      ];
    }

    case "paragraph":
      return [
        new Paragraph({
          children: renderDocxInlines(block.inlines, options, docx),
        }),
      ];

    case "blockquote": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paragraphs: any[] = [];
      for (const innerBlock of block.blocks) {
        const innerParagraphs = renderDocxBlock(innerBlock, options, docx);
        for (const _p of innerParagraphs) {
          paragraphs.push(
            new Paragraph({
              children: renderDocxInlines(
                innerBlock.kind === "paragraph" ? innerBlock.inlines : [],
                options,
                docx
              ),
              indent: { left: 720 },
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: "999999",
                },
              },
            })
          );
        }
      }
      return paragraphs;
    }

    case "bulletList": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paragraphs: any[] = [];
      for (const item of block.items) {
        for (const b of item) {
          if (b.kind === "paragraph") {
            paragraphs.push(
              new Paragraph({
                children: renderDocxInlines(b.inlines, options, docx),
                bullet: { level: 0 },
              })
            );
          }
        }
      }
      return paragraphs;
    }

    case "orderedList": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paragraphs: any[] = [];
      for (const item of block.items) {
        for (const b of item) {
          if (b.kind === "paragraph") {
            paragraphs.push(
              new Paragraph({
                children: renderDocxInlines(b.inlines, options, docx),
                numbering: { reference: "default-numbering", level: 0 },
              })
            );
          }
        }
      }
      return paragraphs;
    }

    case "codeBlock":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              font: "Courier New",
              size: 20,
            }),
          ],
          shading: {
            fill: "f0f0f0",
          },
        }),
      ];

    case "horizontalRule":
      return [
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: "auto",
            },
          },
          spacing: { before: 200, after: 200 },
        }),
      ];

    case "sceneBreak":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: "* * *",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 400 },
        }),
      ];

    default:
      return [];
  }
}

// ============================================================================
// Inline Rendering for DOCX
// ============================================================================

function renderDocxInlines(
  inlines: ExportInline[],
  options: ExportOptions,
  docx: typeof import("docx")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const { TextRun, UnderlineType } = docx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runs: any[] = [];

  for (const inline of inlines) {
    if (inline.kind === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }

    if (inline.kind !== "text") {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runOptions: Record<string, any> = {
      text: inline.text,
    };

    // Apply marks
    if (inline.marks) {
      for (const mark of inline.marks) {
        switch (mark.kind) {
          case "bold":
            runOptions["bold"] = true;
            break;
          case "italic":
            runOptions["italics"] = true;
            break;
          case "strike":
            runOptions["strike"] = true;
            break;
          case "code":
            runOptions["font"] = "Courier New";
            runOptions["shading"] = { fill: "f0f0f0" };
            break;
          case "underline":
            runOptions["underline"] = { type: UnderlineType.SINGLE };
            break;
          case "entity":
            if (options.preserveEntityMarks) {
              runOptions["highlight"] = "yellow";
            }
            break;
        }
      }
    }

    runs.push(new TextRun(runOptions));
  }

  return runs;
}
