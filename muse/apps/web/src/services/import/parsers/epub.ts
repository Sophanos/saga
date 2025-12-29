import type { ExportBlock } from "../../export/ir";
import { htmlToBlocks } from "./markdown";

// ============================================================================
// EPUB Parser
// ============================================================================

/**
 * Parse EPUB file into IR blocks.
 * 
 * Strategy:
 * - Use JSZip to extract EPUB contents
 * - Parse container.xml to find OPF file
 * - Parse OPF to get spine order
 * - Extract and concatenate XHTML content in reading order
 * - Convert HTML to IR blocks
 */
export async function parseEpub(buffer: ArrayBuffer): Promise<ExportBlock[]> {
  // Dynamic import to reduce bundle size
  const JSZip = (await import("jszip")).default;

  const zip = await JSZip.loadAsync(buffer);

  // Step 1: Find the OPF file path from container.xml
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) {
    throw new Error("Invalid EPUB: missing META-INF/container.xml");
  }

  const opfPath = extractOpfPath(containerXml);
  if (!opfPath) {
    throw new Error("Invalid EPUB: could not find OPF file path");
  }

  // Step 2: Parse the OPF file
  const opfContent = await zip.file(opfPath)?.async("text");
  if (!opfContent) {
    throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);
  }

  const opfDir = opfPath.includes("/") 
    ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) 
    : "";

  const { manifest, spine } = parseOpf(opfContent);

  // Step 3: Extract content in spine order
  const allBlocks: ExportBlock[] = [];

  for (const idref of spine) {
    const item = manifest.get(idref);
    if (!item) {
      console.warn(`[epub import] Spine item not found in manifest: ${idref}`);
      continue;
    }

    // Skip non-XHTML content
    if (!item.mediaType.includes("html") && !item.mediaType.includes("xml")) {
      continue;
    }

    // Resolve href relative to OPF directory
    const contentPath = opfDir + item.href;
    const content = await zip.file(contentPath)?.async("text");

    if (!content) {
      console.warn(`[epub import] Could not read content file: ${contentPath}`);
      continue;
    }

    // Extract body content from XHTML
    const bodyHtml = extractBodyContent(content);
    if (bodyHtml) {
      const blocks = htmlToBlocks(bodyHtml);
      allBlocks.push(...blocks);
    }
  }

  return allBlocks;
}

// ============================================================================
// EPUB Parsing Helpers
// ============================================================================

/**
 * Extract OPF file path from container.xml
 */
function extractOpfPath(containerXml: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(containerXml, "application/xml");
  
  // Find rootfile element
  const rootfile = doc.querySelector("rootfile[full-path]");
  return rootfile?.getAttribute("full-path") ?? null;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

interface OpfData {
  manifest: Map<string, ManifestItem>;
  spine: string[];
}

/**
 * Parse OPF file to extract manifest and spine
 */
function parseOpf(opfContent: string): OpfData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, "application/xml");

  // Build manifest map
  const manifest = new Map<string, ManifestItem>();
  const manifestItems = doc.querySelectorAll("manifest > item");
  
  for (const item of Array.from(manifestItems)) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type");
    
    if (id && href && mediaType) {
      manifest.set(id, { id, href, mediaType });
    }
  }

  // Build spine order
  const spine: string[] = [];
  const spineItems = doc.querySelectorAll("spine > itemref");
  
  for (const itemref of Array.from(spineItems)) {
    const idref = itemref.getAttribute("idref");
    if (idref) {
      spine.push(idref);
    }
  }

  return { manifest, spine };
}

/**
 * Extract body content from XHTML document
 */
function extractBodyContent(xhtml: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, "application/xhtml+xml");
  
  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    // Try parsing as HTML instead
    const htmlDoc = parser.parseFromString(xhtml, "text/html");
    return htmlDoc.body?.innerHTML ?? null;
  }
  
  return doc.body?.innerHTML ?? null;
}
