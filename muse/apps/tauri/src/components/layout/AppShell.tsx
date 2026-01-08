import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

// macOS traffic lights offset (overlay titlebar)
const TRAFFIC_LIGHTS_OFFSET = 78; // Width to leave for traffic lights

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-full flex flex-col bg-mythos-bg">
      {/* Titlebar area for macOS traffic lights - overlay style */}
      <div
        className="h-10 flex-shrink-0 flex items-center"
        style={{
          WebkitAppRegion: 'drag',
          background: 'var(--mythos-surface)',
          borderBottom: '1px solid var(--mythos-border)',
          paddingLeft: TRAFFIC_LIGHTS_OFFSET,
        } as React.CSSProperties}
      >
        {/* Title centered in remaining space */}
        <span
          className="text-sm font-medium text-mythos-text-secondary flex-1 text-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          Mythos
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
