import { useEditor, EditorContent, StarterKit, Placeholder } from "@mythos/editor";
import { EntityMark } from "@mythos/editor";
import { useEntityClick } from "../../hooks/useEntityClick";

const INITIAL_CONTENT = `<p>The ancient city of <span data-entity-id="loc1" data-entity-type="location" class="entity-location">Valdris</span> stretched before him, its spires catching the last light of sunset. <span data-entity-id="char1" data-entity-type="character" class="entity-character">Kael</span> adjusted the worn leather of his cloak and stepped through the gate.</p>

<p>"You're late," said <span data-entity-id="char2" data-entity-type="character" class="entity-character">Master Theron</span>, emerging from the shadows. The old man's eyes gleamed with something between amusement and concern. "The council has been waiting."</p>

<p>Kael's hand instinctively moved to the <span data-entity-id="item1" data-entity-type="item" class="entity-item">Blade of Whispers</span> at his side. He could feel its familiar hum, a reminder of the power—and the burden—he carried.</p>

<p>"Let them wait," he replied, though he quickened his pace. "What I've discovered changes everything."</p>`;

export function MythosEditor() {
  const { handleEntityClick } = useEntityClick();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Begin your story...",
      }),
      EntityMark,
    ],
    content: INITIAL_CONTENT,
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-lg max-w-none focus:outline-none font-serif",
      },
    },
  });

  return (
    <div className="mythos-editor" onClick={handleEntityClick}>
      <EditorContent editor={editor} />
    </div>
  );
}
