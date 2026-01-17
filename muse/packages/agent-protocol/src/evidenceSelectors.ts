/**
 * Evidence selector helpers (W3C Media Fragments).
 */

export type NormalizedRect = { x: number; y: number; w: number; h: number };

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatPercent(value: number): string {
  return (clamp01(value) * 100).toFixed(2);
}

export function rectToXywhPercent(rect: NormalizedRect): string {
  const x = formatPercent(rect.x);
  const y = formatPercent(rect.y);
  const w = formatPercent(rect.w);
  const h = formatPercent(rect.h);
  return `xywh=percent:${x},${y},${w},${h}`;
}

export function xywhPercentToRect(value: string): NormalizedRect | null {
  const match = value.trim().match(/^xywh=percent:([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)$/i);
  if (!match) return null;

  const x = Number.parseFloat(match[1]);
  const y = Number.parseFloat(match[2]);
  const w = Number.parseFloat(match[3]);
  const h = Number.parseFloat(match[4]);

  if (![x, y, w, h].every((item) => Number.isFinite(item))) return null;

  return {
    x: clamp01(x / 100),
    y: clamp01(y / 100),
    w: clamp01(w / 100),
    h: clamp01(h / 100),
  };
}
