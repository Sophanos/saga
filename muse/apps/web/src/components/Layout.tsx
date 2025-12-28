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
import { useMythosStore } from "../stores";

export function Layout() {
  const hudEntity = useMythosStore((state) => state.ui.hudEntity);
  const hudPosition = useMythosStore((state) => state.ui.hudPosition);
  const showHud = useMythosStore((state) => state.showHud);

  const handleClickOutside = () => {
    if (hudEntity) {
      showHud(null);
    }
  };

  return (
    <div className="flex flex-col h-full" onClick={handleClickOutside}>
      <Header />
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Pane: The Manifest */}
        <Panel
          defaultSize={20}
          minSize={15}
          maxSize={35}
          className="bg-mythos-bg-secondary"
        >
          <Manifest />
        </Panel>

        <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-cyan/30 transition-colors" />

        {/* Center Pane: The Canvas */}
        <Panel defaultSize={55} minSize={30} className="bg-mythos-bg-primary">
          <Canvas />
        </Panel>

        <PanelResizeHandle className="w-1 bg-mythos-bg-tertiary hover:bg-mythos-accent-cyan/30 transition-colors" />

        {/* Right Pane: The Console */}
        <Panel
          defaultSize={25}
          minSize={20}
          maxSize={40}
          className="bg-mythos-bg-secondary"
        >
          <Console />
        </Panel>
      </PanelGroup>

      {/* ASCII HUD overlay */}
      {hudEntity && (
        <AsciiHud
          entity={hudEntity}
          onClose={() => showHud(null)}
          position={hudPosition}
        />
      )}
    </div>
  );
}
