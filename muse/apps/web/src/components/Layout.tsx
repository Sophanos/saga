import { useEffect } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { ProjectPickerSidebar } from "./projects/ProjectPickerSidebar";
import { Canvas } from "./canvas/Canvas";
import { Console } from "./console/Console";
import { Header } from "./Header";
import { AsciiHud } from "./hud/AsciiHud";
import { CommandPalette } from "./command-palette";
import { ModalHost } from "./modals";
import { ChatPanel } from "./chat";
import { WidgetProgressTile } from "./widgets/WidgetProgressTile";
import { WidgetPreviewModal } from "./widgets/WidgetPreviewModal";
import { SaveWorkPrompt } from "./auth/SaveWorkPrompt";
import { ProgressiveNudge, ProgressiveStructureController } from "./progressive";
import { TryBootstrapController } from "./try/TryBootstrapController";
import { TryPersonalizationModal } from "./try/TryPersonalizationModal";
import { FlowOverlay } from "./flow";
import { useMythosStore, useCurrentProject, useChatMode } from "../stores";
import { useGlobalShortcuts, useProgressiveLinter } from "../hooks";
import { useCollaboration } from "../hooks/useCollaboration";
import { useAuthStore } from "../stores/auth";
import { useProgressivePanelVisibility } from "@mythos/state";
import { Toaster } from "@mythos/ui";

interface LayoutProps {
  /** Anonymous trial mode - shows trial variant of FloatingChat */
  isAnonymous?: boolean;
  /** Callback for signup (anonymous mode) */
  onSignUp?: () => void;
  /** Show inline project start flow when no project exists */
  showProjectStart?: boolean;
  /** Callback when a new project is created */
  onProjectCreated?: (projectId: string) => void;
}

function CollaborationController({ projectId }: { projectId: string }) {
  useCollaboration(projectId);
  return null;
}

export function Layout({
  isAnonymous = false,
  onSignUp,
  showProjectStart = false,
  onProjectCreated,
}: LayoutProps) {
  // Get current project for collaboration
  const project = useCurrentProject();
  const currentUser = useAuthStore((s) => s.user);

  const hudEntity = useMythosStore((state) => state.ui.hudEntity);
  const hudPosition = useMythosStore((state) => state.ui.hudPosition);
  const showHud = useMythosStore((state) => state.showHud);
  const setChatMode = useMythosStore((state) => state.setChatMode);
  const setActiveTab = useMythosStore((state) => state.setActiveTab);

  // Chat mode (floating vs docked)
  const chatMode = useChatMode();

  // Flow mode (distraction-free writing)
  const wordCount = useMythosStore((s) => s.editor.wordCount);

  // Progressive panel visibility (gardener mode hides panels until unlocked)
  const { showManifest, showConsole } = useProgressivePanelVisibility();
  const manifestVisible = isAnonymous || showProjectStart ? true : showManifest;
  const consoleVisible = isAnonymous || showProjectStart ? true : showConsole;

  // Enable global keyboard shortcuts
  useGlobalShortcuts();

  // Progressive linter for Phase 2 → 3 transition (detects contradictions)
  useProgressiveLinter({ enabled: !isAnonymous && !showProjectStart });

  useEffect(() => {
    if (!showProjectStart) return;
    setChatMode("docked");
    setActiveTab("chat");
  }, [showProjectStart, setChatMode, setActiveTab]);

  const handleClickOutside = () => {
    if (hudEntity) {
      showHud(null);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={handleClickOutside}>
      {project?.id && currentUser ? (
        <CollaborationController projectId={project.id} />
      ) : null}
      <Header />
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Pane: Project Picker (hidden in gardener mode until unlocked) */}
        {manifestVisible && (
          <>
            <Panel
              defaultSize={20}
              minSize={15}
              maxSize={35}
              className="bg-mythos-bg-secondary"
            >
              <ProjectPickerSidebar />
            </Panel>
            <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-primary/30 transition-colors" />
          </>
        )}

        {/* Center Pane: The Canvas */}
        <Panel defaultSize={manifestVisible && consoleVisible ? 55 : manifestVisible ? 80 : consoleVisible ? 75 : 100} minSize={30} className="bg-mythos-bg-primary">
          <Canvas
            showProjectStart={showProjectStart}
            onProjectCreated={onProjectCreated}
            autoAnalysis={!isAnonymous && !showProjectStart}
          />
        </Panel>

        {/* Right Pane: The Console (hidden in gardener mode until unlocked) */}
        {consoleVisible && (
          <>
            <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-primary/30 transition-colors" />
            <Panel
              defaultSize={25}
              minSize={20}
              maxSize={40}
              className="bg-mythos-bg-secondary"
            >
              <Console isAnonymous={isAnonymous} onSignUp={onSignUp} />
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

      {/* Widget execution overlays */}
      <WidgetProgressTile />
      <WidgetPreviewModal />

      {/* Global Modal Host */}
      <ModalHost />

      {/* Toast Notifications */}
      <Toaster />

      {isAnonymous && <TryBootstrapController />}
      {isAnonymous && <TryPersonalizationModal />}

      {/* Progressive Structure Controller (manages phase transitions) */}
      <ProgressiveStructureController />

      {/* Progressive Nudge (shows subtle prompts) */}
      <ProgressiveNudge
        onTrackEntities={() => {
          // TODO: Open entity suggestion modal with pendingDetectedEntities
          console.log('[Progressive] Track entities requested');
        }}
      />

      {/* Floating Chat - show when chatMode is "floating" for all users */}
      {chatMode === "floating" && (
        <ChatPanel
          mode="floating"
          variant={isAnonymous ? "trial" : "full"}
          onSignUp={onSignUp}
        />
      )}

      {/* Save work prompt (anonymous mode only) */}
      {isAnonymous && onSignUp && <SaveWorkPrompt onSignUp={onSignUp} />}

      {/* Flow Mode Overlay */}
      <FlowOverlay wordCount={wordCount} />
    </div>
  );
}
