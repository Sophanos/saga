import { useMemo } from "react";
import { WebView } from "react-native-webview";
import { useTheme } from "@/design-system";

interface MermaidPreviewWebViewProps {
  content: string;
}

function buildMermaidHtml(content: string, theme: "dark" | "default"): string {
  const safeContent = content.replace(/</g, "&lt;");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 12px;
        background: transparent;
      }
      .mermaid {
        display: block;
      }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  </head>
  <body>
    <div class="mermaid">${safeContent}</div>
    <script>
      if (window.mermaid) {
        window.mermaid.initialize({
          startOnLoad: true,
          securityLevel: "strict",
          theme: "${theme}",
        });
      }
    </script>
  </body>
</html>`;
}

export function MermaidPreviewWebView({ content }: MermaidPreviewWebViewProps) {
  const { isDark } = useTheme();

  const html = useMemo(() => {
    return buildMermaidHtml(content, isDark ? "dark" : "default");
  }, [content, isDark]);

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      style={{ height: 240 }}
    />
  );
}
