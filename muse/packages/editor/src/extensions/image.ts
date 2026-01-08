import Image from "@tiptap/extension-image";

export interface ImageOptions {
  inline?: boolean;
  allowBase64?: boolean;
}

export const imageExtension = (options: ImageOptions = {}) =>
  Image.configure({
    inline: options.inline ?? false,
    allowBase64: options.allowBase64 ?? true,
    HTMLAttributes: {
      class: "editor-image",
      loading: "lazy",
    },
  });

export { Image };
