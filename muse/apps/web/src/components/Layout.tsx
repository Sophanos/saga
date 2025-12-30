import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { Manifest } from "./manifest/Manifest";
import { Canvas } from "./canvas/Canvas";
import { Console } from "./console/Console";
import { Header } from "./Header";
import { AsciiHud } from "./hud/AsciiHud";
import { CommandPalette } from "./command-palette";
import { ModalHost } from "./modals";
import { ChatPanel } from "./chat";
import { SaveWorkPrompt } from "./auth/SaveWorkPrompt";
import { ProgressiveNudge, ProgressiveStructureController } from "./progressive";
import { useMythosStore, useCurrentProject, useChatMode } from "../stores";
import { useGlobalShortcuts, useProgressiveLinter } from "../hooks";
import { useCollaboration } from "../hooks/useCollaboration";
import { useProgressivePanelVisibility } from "@mythos/state";

interface LayoutProps {
  /** Anonymous trial mode - shows trial variant of FloatingChat */
  isAnonymous?: boolean;
  /** Callback for signup (anonymous mode) */
  onSignUp?: () => void;
}

export function Layout({ isAnonymous = false, onSignUp }: LayoutProps) {
  // Get current project for collaboration
  const project = useCurrentProject();

  // Activate collaboration (members, presence, activity) when project is loaded
  useCollaboration(project?.id ?? null);

  const hudEntity = useMythosStore((state) => state.ui.hudEntity);
  const hudPosition = useMythosStore((state) => state.ui.hudPosition);
  const showHud = useMythosStore((state) => state.showHud);

  // Chat mode (floating vs docked)
  const chatMode = useChatMode();

  // Progressive panel visibility (gardener mode hides panels until unlocked)
  const { showManifest, showConsole } = useProgressivePanelVisibility();

  // Enable global keyboard shortcuts
  useGlobalShortcuts();

  // Progressive linter for Phase 2 → 3 transition (detects contradictions)
  useProgressiveLinter();

  const handleClickOutside = () => {
    if (hudEntity) {
      showHud(null);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={handleClickOutside}>
      <Header />
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Pane: The Manifest (hidden in gardener mode until unlocked) */}
        {showManifest && (
          <>
            <Panel
              defaultSize={20}
              minSize={15}
              maxSize={35}
              className="bg-mythos-bg-secondary"
            >
              <Manifest />
            </Panel>
            <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-primary/30 transition-colors" />
          </>
        )}

        {/* Center Pane: The Canvas */}
        <Panel defaultSize={showManifest && showConsole ? 55 : showManifest ? 80 : showConsole ? 75 : 100} minSize={30} className="bg-mythos-bg-primary">
          <Canvas />
        </Panel>

        {/* Right Pane: The Console (hidden in gardener mode until unlocked) */}
        {showConsole && (
          <>
            <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-primary/30 transition-colors" />
            <Panel
              defaultSize={25}
              minSize={20}
              maxSize={40}
              className="bg-mythos-bg-secondary"
            >
              <Console />
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* ASCII HUD overlay */}
      {hudEntity && (
        <AsciiHud
          entity={hudEntity}
          onClose={() => showHud(null)}
          position={hudPosition}
        />
      )}

      {/* Command Palette */}
      <CommandPalette />

      {/* Global Modal Host */}
      <ModalHost />

      {/* Progressive Structure Controller (manages phase transitions) */}
      <ProgressiveStructureController />

      {/* Progressive Nudge (shows subtle prompts) */}
      <ProgressiveNudge
        onTrackEntities={() => {
          // TODO: Open entity suggestion modal with pendingDetectedEntities
          console.log('[Progressive] Track entities requested');
        }}
      />

      {/* Floating Chat - always show in anonymous mode, otherwise only in floating mode */}
      {(isAnonymous || chatMode === "floating") && (
        <ChatPanel
          mode="floating"
          variant={isAnonymous ? "trial" : "full"}
          onSignUp={onSignUp}
        />
      )}

      {/* Save work prompt (anonymous mode only) */}
      {isAnonymous && onSignUp && <SaveWorkPrompt onSignUp={onSignUp} />}
    </div>
  );
}
