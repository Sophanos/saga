import type { ExportResult } from "../types";
import { FORMAT_METADATA } from "../types";

export type ArtifactPdfPage = {
  title: string;
  subtitle?: string;
  svg?: string;
  imageDataUrl?: string;
  text?: string;
};

// pdfmake types (simplified)
interface PdfContent {
  text?: string | PdfContent[];
  style?: string | string[];
  fontSize?: number;
  bold?: boolean;
  margin?: number[];
  pageBreak?: "before" | "after";
  image?: string;
  svg?: string;
  width?: number;
}

function decodeSvgDataUrl(dataUrl: string): string | null {
  if (!dataUrl.startsWith("data:image/svg+xml")) return null;

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;

  const payload = dataUrl.slice(commaIndex + 1);
  const isBase64 = dataUrl.slice(0, commaIndex).includes(";base64");

  try {
    if (isBase64) {
      const atobFn = typeof atob === "function" ? atob : null;
      if (!atobFn) return null;
      return atobFn(payload);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

export async function renderArtifactsPdf(params: {
  title: string;
  pages: ArtifactPdfPage[];
  fileName?: string;
}): Promise<ExportResult> {
  const { title, pages } = params;

  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");

  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const pdfFonts = pdfFontsModule.default ?? pdfFontsModule;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontsAny = pdfFonts as any;
  if (fontsAny?.pdfMake?.vfs) {
    pdfMake.vfs = fontsAny.pdfMake.vfs;
  } else if (fontsAny?.vfs) {
    pdfMake.vfs = fontsAny.vfs;
  }

  const content: PdfContent[] = [];

  content.push({
    text: title,
    style: "title",
    margin: [0, 0, 0, 16],
  });

  for (const [index, page] of pages.entries()) {
    content.push({
      text: page.title,
      style: "h1",
      margin: [0, index === 0 ? 0 : 12, 0, 6],
    });

    if (page.subtitle) {
      content.push({
        text: page.subtitle,
        style: "subtitle",
        margin: [0, 0, 0, 10],
      });
    }

    if (page.svg) {
      content.push({
        svg: page.svg,
        width: 520,
        margin: [0, 0, 0, 10],
      });
    } else if (page.imageDataUrl) {
      content.push({
        image: page.imageDataUrl,
        width: 520,
        margin: [0, 0, 0, 10],
      });
    } else if (page.text) {
      content.push({
        text: page.text,
        style: "mono",
        margin: [0, 0, 0, 10],
      });
    } else {
      content.push({
        text: "No exportable content.",
        style: "subtitle",
        margin: [0, 0, 0, 10],
      });
    }

    if (index < pages.length - 1) {
      content.push({ text: "", pageBreak: "after" });
    }
  }

  const docDefinition = {
    content,
    styles: {
      title: { fontSize: 18, bold: true },
      h1: { fontSize: 14, bold: true },
      subtitle: { fontSize: 10, color: "#64748b" },
      mono: { fontSize: 9, font: "Courier" },
    },
    pageMargins: [48, 48, 48, 48],
  };

  const metadata = FORMAT_METADATA.pdf;
  const fileName = params.fileName ?? `${title}${metadata.extension}`;

  return new Promise((resolve, reject) => {
    try {
      const generator = pdfMake.createPdf(docDefinition as never);
      generator.getBlob((blob: Blob) => {
        resolve({ blob, mimeType: metadata.mimeType, fileName });
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function decodeSvgDataUrlToSvg(svgDataUrl: string): string | null {
  return decodeSvgDataUrl(svgDataUrl);
}

