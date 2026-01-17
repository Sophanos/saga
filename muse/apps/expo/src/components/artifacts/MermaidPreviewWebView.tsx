import { useMemo } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/design-system";

interface MermaidPreviewWebViewProps {
  content: string;
}

function buildMermaidHtml(content: string, theme: "dark" | "default"): string {
  // Only escape < to prevent script injection, preserve > for mermaid arrows
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
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.3/dist/mermaid.min.js"></script>
  </head>
  <body>
    <pre class="mermaid">${safeContent}</pre>
    <script>
      mermaid.initialize({
        startOnLoad: true,
        securityLevel: "loose",
        theme: "${theme}",
      });
    </script>
  </body>
</html>`;
}

export function MermaidPreviewWebView({ content }: MermaidPreviewWebViewProps) {
  const { isDark } = useTheme();

  const html = useMemo(() => {
    return buildMermaidHtml(content, isDark ? "dark" : "default");
  }, [content, isDark]);

  if (Platform.OS === "web") {
    return (
      <View style={{ height: 240 }}>
        <iframe
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none" }}
          sandbox="allow-scripts allow-same-origin"
        />
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      style={{ height: 240 }}
    />
  );
}
