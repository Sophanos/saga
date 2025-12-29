/**
 * Inbox / Capture Types
 *
 * Types for the Mobile Capture Hub including:
 * - Text notes, voice memos, photos
 * - Flagged passages from documents
 * - AI chat suggestions/plans
 */

/**
 * Capture kinds representing different types of mobile captures
 */
export type CaptureKind = "text" | "voice" | "photo" | "flag" | "chat_plan";

/**
 * Status of a capture in the processing pipeline
 */
export type CaptureStatus = "inbox" | "processed" | "archived";

/**
 * Source of the capture
 */
export type CaptureSource = "mobile" | "web";

/**
 * Voice capture specific payload
 */
export interface VoiceCapturePayload {
  /** Duration of the voice memo in milliseconds */
  durationMs?: number;
  /** Transcription text from speech-to-text */
  transcription?: string;
  /** Language code of the recording */
  language?: string;
  /** Local file URI (only for unsynced captures) */
  localUri?: string;
}

/**
 * Photo capture specific payload
 */
export interface PhotoCapturePayload {
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** AI-generated or user-provided description */
  description?: string;
  /** Local file URI (only for unsynced captures) */
  localUri?: string;
}

/**
 * Flag capture specific payload (flagging a passage)
 */
export interface FlagCapturePayload {
  /** ID of the document containing the flagged passage */
  documentId: string;
  /** The flagged text excerpt */
  excerpt: string;
  /** Paragraph index within the document */
  paragraphIndex?: number;
  /** Selection start offset */
  selectionStart?: number;
  /** Selection end offset */
  selectionEnd?: number;
}

/**
 * Chat plan capture payload
 */
export interface ChatPlanCapturePayload {
  /** ID of the chat conversation this plan came from */
  conversationId?: string;
  /** AI response to save */
  responseToSave?: string;
  /** List of suggested actions from AI */
  suggestedActions?: string[];
}

/**
 * Union type for all capture payloads
 */
export type CapturePayload =
  | VoiceCapturePayload
  | PhotoCapturePayload
  | FlagCapturePayload
  | ChatPlanCapturePayload
  | Record<string, unknown>;

/**
 * Main capture record interface
 */
export interface CaptureRecord {
  /** Unique capture ID */
  id: string;
  /** Project this capture belongs to */
  projectId: string;
  /** User who created the capture */
  createdBy: string;
  /** Type of capture */
  kind: CaptureKind;
  /** Processing status */
  status: CaptureStatus;
  /** Optional title for the capture */
  title?: string;
  /** Text content of the capture */
  content?: string;
  /** URL to uploaded media (after sync) */
  mediaUrl?: string;
  /** MIME type of the media */
  mediaMimeType?: string;
  /** Type-specific payload data */
  payload: CapturePayload;
  /** Where the capture originated */
  source: CaptureSource;
  /** When the capture was created */
  createdAt: string;
  /** When the capture was last updated */
  updatedAt: string;
  /** When the capture was processed (if processed) */
  processedAt?: string;
}

/**
 * Input for creating a new capture
 */
export interface CaptureInput {
  /** Project this capture belongs to */
  projectId: string;
  /** User creating the capture */
  createdBy: string;
  /** Type of capture */
  kind: CaptureKind;
  /** Optional title for the capture */
  title?: string;
  /** Text content of the capture */
  content?: string;
  /** URL to uploaded media */
  mediaUrl?: string;
  /** MIME type of the media */
  mediaMimeType?: string;
  /** Type-specific payload data */
  payload?: CapturePayload;
  /** Where the capture originated (defaults to 'mobile') */
  source?: CaptureSource;
}

/**
 * Capture update input
 */
export interface CaptureUpdate {
  /** Updated title */
  title?: string;
  /** Updated content */
  content?: string;
  /** Updated status */
  status?: CaptureStatus;
  /** Updated media URL */
  mediaUrl?: string;
  /** Updated media MIME type */
  mediaMimeType?: string;
  /** Updated payload */
  payload?: CapturePayload;
  /** When the capture was processed */
  processedAt?: string;
}

/**
 * Helper to check if a capture has media
 */
export function captureHasMedia(capture: CaptureRecord): boolean {
  return !!capture.mediaUrl || capture.kind === "voice" || capture.kind === "photo";
}

/**
 * Helper to check if a capture needs processing
 */
export function captureNeedsProcessing(capture: CaptureRecord): boolean {
  if (capture.status !== "inbox") return false;

  switch (capture.kind) {
    case "voice":
      // Needs transcription
      return !(capture.payload as VoiceCapturePayload)?.transcription;
    case "photo":
      // Needs description
      return !(capture.payload as PhotoCapturePayload)?.description;
    default:
      return false;
  }
}

/**
 * Get display label for capture kind
 */
export function getCaptureKindLabel(kind: CaptureKind): string {
  const labels: Record<CaptureKind, string> = {
    text: "Text Note",
    voice: "Voice Memo",
    photo: "Photo",
    flag: "Flagged Passage",
    chat_plan: "AI Suggestion",
  };
  return labels[kind];
}

/**
 * Get icon name for capture kind (for lucide-react-native)
 */
export function getCaptureKindIcon(kind: CaptureKind): string {
  const icons: Record<CaptureKind, string> = {
    text: "FileText",
    voice: "Mic",
    photo: "Camera",
    flag: "Flag",
    chat_plan: "MessageSquare",
  };
  return icons[kind];
}
