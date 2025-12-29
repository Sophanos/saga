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
import { ProgressiveNudge, ProgressiveStructureController } from "./progressive";
import { useMythosStore } from "../stores";
import { useGlobalShortcuts } from "../hooks";
import { useProgressivePanelVisibility } from "@mythos/state";

export function Layout() {
  const hudEntity = useMythosStore((state) => state.ui.hudEntity);
  const hudPosition = useMythosStore((state) => state.ui.hudPosition);
  const showHud = useMythosStore((state) => state.showHud);

  // Progressive panel visibility (gardener mode hides panels until unlocked)
  const { showManifest, showConsole } = useProgressivePanelVisibility();

  // Enable global keyboard shortcuts
  useGlobalShortcuts();

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
            <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-cyan/30 transition-colors" />
          </>
        )}

        {/* Center Pane: The Canvas */}
        <Panel defaultSize={showManifest && showConsole ? 55 : showManifest || showConsole ? 75 : 100} minSize={30} className="bg-mythos-bg-primary">
          <Canvas />
        </Panel>

        {/* Right Pane: The Console (hidden in gardener mode until unlocked) */}
        {showConsole && (
          <>
            <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-cyan/30 transition-colors" />
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
      <ProgressiveNudge />
    </div>
  );
}
