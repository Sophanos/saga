import type { Project } from "@mythos/core";
import type { ExportOptions, ExportResult } from "../types";
import type { ExportBlock, ExportInline, ExportMark, ExportSection } from "../ir";
import type { GlossarySection } from "../glossary/buildGlossary";
import { FORMAT_METADATA } from "../types";

// ============================================================================
// EPUB Renderer (Using JSZip)
// ============================================================================

export interface EpubRenderParams {
  project: Project;
  sections: ExportSection[];
  glossary?: GlossarySection[];
  options: ExportOptions;
}

/**
 * Render content to EPUB format
 * 
 * EPUB is essentially a ZIP file with XHTML content and metadata.
 * Uses dynamic import to load JSZip only when needed.
 */
export async function renderEpub(params: EpubRenderParams): Promise<ExportResult> {
  const JSZip = (await import("jszip")).default;
  const { project, sections, glossary, options } = params;

  const zip = new JSZip();

  // mimetype (must be first, uncompressed)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // META-INF/container.xml
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // OEBPS/styles.css
  zip.file("OEBPS/styles.css", generateStyles(options));

  // Generate content files
  const manifestItems: { id: string; href: string; mediaType: string }[] = [];
  const spineItems: string[] = [];
  const tocItems: { id: string; title: string; href: string; level: number }[] = [];

  // Title page
  if (options.includeTitlePage) {
    const titleXhtml = generateTitlePage(project);
    zip.file("OEBPS/title.xhtml", titleXhtml);
    manifestItems.push({ id: "title", href: "title.xhtml", mediaType: "application/xhtml+xml" });
    spineItems.push("title");
  }

  // Content sections
  let sectionIndex = 0;
  for (const section of sections) {
    sectionIndex++;
    const sectionId = `section-${sectionIndex.toString().padStart(3, "0")}`;
    const sectionHref = `${sectionId}.xhtml`;
    
    const sectionXhtml = generateSectionXhtml(section, options);
    zip.file(`OEBPS/${sectionHref}`, sectionXhtml);
    
    manifestItems.push({
      id: sectionId,
      href: sectionHref,
      mediaType: "application/xhtml+xml",
    });
    spineItems.push(sectionId);
    tocItems.push({
      id: sectionId,
      title: section.title,
      href: sectionHref,
      level: section.level,
    });
  }

  // Glossary
  if (glossary && glossary.length > 0 && options.glossary.include) {
    const glossaryXhtml = generateGlossaryXhtml(glossary);
    zip.file("OEBPS/glossary.xhtml", glossaryXhtml);
    manifestItems.push({
      id: "glossary",
      href: "glossary.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItems.push("glossary");
    tocItems.push({
      id: "glossary",
      title: "Glossary",
      href: "glossary.xhtml",
      level: 1,
    });
  }

  // Add styles to manifest
  manifestItems.push({
    id: "styles",
    href: "styles.css",
    mediaType: "text/css",
  });

  // NAV (EPUB3 navigation)
  const navXhtml = generateNavXhtml(tocItems, options.includeToc);
  zip.file("OEBPS/nav.xhtml", navXhtml);
  manifestItems.push({
    id: "nav",
    href: "nav.xhtml",
    mediaType: "application/xhtml+xml",
  });

  // NCX (EPUB2 compatibility)
  const ncx = generateNcx(project, tocItems);
  zip.file("OEBPS/toc.ncx", ncx);
  manifestItems.push({
    id: "ncx",
    href: "toc.ncx",
    mediaType: "application/x-dtbncx+xml",
  });

  // content.opf (package document)
  const contentOpf = generateContentOpf(project, manifestItems, spineItems);
  zip.file("OEBPS/content.opf", contentOpf);

  // Generate the ZIP with proper EPUB structure
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: FORMAT_METADATA.epub.mimeType,
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    blob,
    mimeType: FORMAT_METADATA.epub.mimeType,
    fileName: `${project.name}${FORMAT_METADATA.epub.extension}`,
  };
}

// ============================================================================
// EPUB File Generators
// ============================================================================

function generateStyles(options: ExportOptions): string {
  return `
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 1em;
}

h1 {
  font-size: 1.8em;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

h2 {
  font-size: 1.4em;
  margin-top: 0.8em;
  margin-bottom: 0.4em;
}

h3 {
  font-size: 1.2em;
  margin-top: 0.6em;
  margin-bottom: 0.3em;
}

p {
  margin: 0.5em 0;
  text-indent: 1.5em;
}

p:first-of-type,
h1 + p,
h2 + p,
h3 + p {
  text-indent: 0;
}

blockquote {
  margin: 1em 2em;
  font-style: italic;
  border-left: 3px solid #ccc;
  padding-left: 1em;
}

code {
  font-family: "Courier New", monospace;
  background-color: #f5f5f5;
  padding: 0.1em 0.3em;
}

pre {
  font-family: "Courier New", monospace;
  background-color: #f5f5f5;
  padding: 1em;
  overflow-x: auto;
  white-space: pre-wrap;
}

.scene-break {
  text-align: center;
  margin: 2em 0;
}

.title-page {
  text-align: center;
  padding-top: 30%;
}

.title-page h1 {
  font-size: 2.5em;
}

.title-page .description {
  font-style: italic;
  margin-top: 2em;
}

.entity {
  ${options.preserveEntityMarks ? "background-color: #ffffcc;" : ""}
}

.entity-character {
  ${options.preserveEntityMarks ? "border-bottom: 1px dotted #9966cc;" : ""}
}

.entity-location {
  ${options.preserveEntityMarks ? "border-bottom: 1px dotted #66cc99;" : ""}
}

.glossary-entry {
  margin-bottom: 1.5em;
}

.glossary-entry .aliases {
  font-style: italic;
  color: #666;
}

.glossary-entry .field {
  margin-left: 1em;
}

.glossary-entry .field-label {
  font-weight: bold;
}
`.trim();
}

function generateTitlePage(project: Project): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(project.name)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="title-page">
    <h1>${escapeXml(project.name)}</h1>
    ${project.description ? `<p class="description">${escapeXml(project.description)}</p>` : ""}
  </div>
</body>
</html>`;
}

function generateSectionXhtml(section: ExportSection, options: ExportOptions): string {
  const headingTag = section.level === 1 ? "h1" : "h2";
  const bodyContent = section.blocks
    .map((block) => renderEpubBlock(block, options))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(section.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <${headingTag}>${escapeXml(section.title)}</${headingTag}>
  ${bodyContent}
</body>
</html>`;
}

function generateGlossaryXhtml(glossary: GlossarySection[]): string {
  const sections = glossary
    .map((section) => {
      const entries = section.entries
        .map((entry) => {
          let html = `<div class="glossary-entry" id="entity-${entry.id}">`;
          html += `<h3>${escapeXml(entry.name)}</h3>`;

          if (entry.aliases.length > 0) {
            html += `<p class="aliases">Also known as: ${escapeXml(entry.aliases.join(", "))}</p>`;
          }

          if (entry.description) {
            html += `<p>${escapeXml(entry.description)}</p>`;
          }

          if (entry.fields && entry.fields.length > 0) {
            for (const field of entry.fields) {
              html += `<p class="field"><span class="field-label">${escapeXml(field.label)}:</span> ${escapeXml(field.value)}</p>`;
            }
          }

          html += "</div>";
          return html;
        })
        .join("\n");

      return `<h2>${escapeXml(section.title)}</h2>\n${entries}`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Glossary</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>Glossary</h1>
  ${sections}
</body>
</html>`;
}

function generateNavXhtml(
  tocItems: { id: string; title: string; href: string; level: number }[],
  _includeToc: boolean
): string {
  const navItems = tocItems
    .map((item) => {
      const indent = item.level === 2 ? "      " : "    ";
      return `${indent}<li><a href="${item.href}">${escapeXml(item.title)}</a></li>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;
}

function generateNcx(
  project: Project,
  tocItems: { id: string; title: string; href: string; level: number }[]
): string {
  const navPoints = tocItems
    .map((item, index) => {
      return `    <navPoint id="navpoint-${index + 1}">
      <navLabel><text>${escapeXml(item.title)}</text></navLabel>
      <content src="${item.href}"/>
    </navPoint>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${project.id}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(project.name)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

function generateContentOpf(
  project: Project,
  manifestItems: { id: string; href: string; mediaType: string }[],
  spineItems: string[]
): string {
  const manifest = manifestItems
    .map((item) => {
      const properties = item.id === "nav" ? ' properties="nav"' : "";
      return `    <item id="${item.id}" href="${item.href}" media-type="${item.mediaType}"${properties}/>`;
    })
    .join("\n");

  const spine = spineItems
    .map((id) => `    <itemref idref="${id}"/>`)
    .join("\n");

  const now = new Date().toISOString().split(".")[0] + "Z";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${project.id}</dc:identifier>
    <dc:title>${escapeXml(project.name)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${now}</meta>
    ${project.description ? `<dc:description>${escapeXml(project.description)}</dc:description>` : ""}
  </metadata>
  <manifest>
${manifest}
  </manifest>
  <spine toc="ncx">
${spine}
  </spine>
</package>`;
}

// ============================================================================
// Block Rendering for EPUB
// ============================================================================

function renderEpubBlock(block: ExportBlock, options: ExportOptions): string {
  switch (block.kind) {
    case "heading": {
      const tag = `h${Math.min(block.level + 1, 6)}`;
      const content = renderEpubInlines(block.inlines, options);
      return `<${tag}>${content}</${tag}>`;
    }

    case "paragraph": {
      const content = renderEpubInlines(block.inlines, options);
      return `<p>${content}</p>`;
    }

    case "blockquote": {
      const innerContent = block.blocks
        .map((b) => renderEpubBlock(b, options))
        .join("\n");
      return `<blockquote>${innerContent}</blockquote>`;
    }

    case "bulletList": {
      const items = block.items
        .map((item) => {
          const content = item.map((b) => renderEpubBlock(b, options)).join("");
          return `<li>${content}</li>`;
        })
        .join("\n");
      return `<ul>\n${items}\n</ul>`;
    }

    case "orderedList": {
      const start = block.start && block.start !== 1 ? ` start="${block.start}"` : "";
      const items = block.items
        .map((item) => {
          const content = item.map((b) => renderEpubBlock(b, options)).join("");
          return `<li>${content}</li>`;
        })
        .join("\n");
      return `<ol${start}>\n${items}\n</ol>`;
    }

    case "codeBlock":
      return `<pre><code>${escapeXml(block.text)}</code></pre>`;

    case "horizontalRule":
      return "<hr/>";

    case "sceneBreak":
      return '<p class="scene-break">* * *</p>';

    default:
      return "";
  }
}

// ============================================================================
// Inline Rendering for EPUB
// ============================================================================

function renderEpubInlines(inlines: ExportInline[], options: ExportOptions): string {
  return inlines.map((inline) => renderEpubInline(inline, options)).join("");
}

function renderEpubInline(inline: ExportInline, options: ExportOptions): string {
  if (inline.kind === "hardBreak") {
    return "<br/>";
  }

  if (inline.kind !== "text") {
    return "";
  }

  let text = escapeXml(inline.text);

  // Apply marks (inside out)
  if (inline.marks) {
    for (const mark of inline.marks) {
      text = applyEpubMark(text, mark, options);
    }
  }

  return text;
}

function applyEpubMark(text: string, mark: ExportMark, options: ExportOptions): string {
  switch (mark.kind) {
    case "bold":
      return `<strong>${text}</strong>`;
    case "italic":
      return `<em>${text}</em>`;
    case "strike":
      return `<del>${text}</del>`;
    case "code":
      return `<code>${text}</code>`;
    case "underline":
      return `<u>${text}</u>`;
    case "link":
      return `<a href="${escapeXml(mark.href)}">${text}</a>`;
    case "entity":
      if (options.preserveEntityMarks) {
        const classes = `entity entity-${mark.entityType}`;
        if (options.glossary.include) {
          return `<a href="glossary.xhtml#entity-${mark.entityId}" class="${classes}">${text}</a>`;
        }
        return `<span class="${classes}">${text}</span>`;
      }
      return text;
    default:
      return text;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
