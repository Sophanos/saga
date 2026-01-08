import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

export interface FormattingOptions {
  underline?: boolean;
  textStyle?: boolean;
  color?: boolean;
  highlight?: { multicolor?: boolean } | boolean;
}

export const formattingExtensions = (options: FormattingOptions = {}) => {
  const extensions = [];

  if (options.underline !== false) {
    extensions.push(Underline);
  }

  if (options.textStyle !== false) {
    extensions.push(TextStyle);
  }

  if (options.color !== false) {
    extensions.push(Color);
  }

  if (options.highlight !== false) {
    const highlightConfig =
      typeof options.highlight === "object" ? options.highlight : {};
    extensions.push(
      Highlight.configure({
        multicolor: highlightConfig.multicolor ?? true,
      })
    );
  }

  return extensions;
};

export { Underline, TextStyle, Color, Highlight };
