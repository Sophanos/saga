import { useCallback } from "react";
import { Button } from "@mythos/ui";
import { useSagaAgent } from "../../hooks/useSagaAgent";

export interface AISuggestEvidenceButtonProps {
  assetId: string;
  imageUrl?: string;
  disabled?: boolean;
  onSuggested?: () => void;
}

export function AISuggestEvidenceButton({
  assetId,
  imageUrl,
  disabled = false,
  onSuggested,
}: AISuggestEvidenceButtonProps): JSX.Element {
  const { sendMessage, isStreaming } = useSagaAgent();

  const handleClick = useCallback(async () => {
    if (!imageUrl) return;

    await sendMessage(
      `Analyze this image and propose evidence_mutation ops.\n\n- If you can identify regions, add region.create ops (rect) with normalized coords.\n- Then add link.create ops with assetId: ${assetId} linking entities/documents/memories.\n- Use relation = "depicts" when visual identity is strong.\nReturn tool calls only; no prose.`,
      {
        attachments: [
          {
            kind: "image",
            assetId,
            url: imageUrl,
          },
        ],
      }
    );

    onSuggested?.();
  }, [assetId, imageUrl, onSuggested, sendMessage]);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || isStreaming || !imageUrl}
      onClick={handleClick}
    >
      Suggest evidence
    </Button>
  );
}
