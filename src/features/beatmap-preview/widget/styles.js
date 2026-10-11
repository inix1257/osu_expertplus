/**
 * Styles for the gameplay preview widget (WS-51).
 */

/** Class prefix of every preview element (`${WRAP_CLASS}__panel`, ...). */
export const WRAP_CLASS = "oep-beatmap-preview";

export const PREVIEW_CSS = `
  .${WRAP_CLASS} { margin-top: 4px; }
  .${WRAP_CLASS}__toggle.btn-osu-big {
    --btn-bg: hsl(var(--hsl-b5, 333 18% 28%));
    margin-top: 6px;
  }
  .${WRAP_CLASS}__panel {
    margin-top: 10px;
    border-radius: 6px;
    overflow: hidden;
    background: hsl(var(--hsl-b5, 333 18% 8%));
    border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
  }
  .${WRAP_CLASS}__canvas-host {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 180px;
    background: #000;
    cursor: pointer;
    outline: none;
  }
  .${WRAP_CLASS}__canvas-host:focus-visible {
    box-shadow: inset 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${WRAP_CLASS}__canvas-host--disabled {
    cursor: not-allowed;
    opacity: 0.85;
  }
  .${WRAP_CLASS}__panel:not(.${WRAP_CLASS}__panel--unsupported) .${WRAP_CLASS}__unsupported {
    display: none;
  }
  .${WRAP_CLASS}__panel.${WRAP_CLASS}__panel--unsupported .${WRAP_CLASS}__canvas-host,
  .${WRAP_CLASS}__panel.${WRAP_CLASS}__panel--unsupported .${WRAP_CLASS}__seek {
    display: none;
  }
  .${WRAP_CLASS}__unsupported {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    min-height: 180px;
    padding: 16px;
    text-align: center;
    color: hsl(var(--hsl-l2, 0 0% 75%));
    font-size: 13px;
    line-height: 1.45;
    box-sizing: border-box;
  }
  .${WRAP_CLASS}__engine-slot {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  .${WRAP_CLASS}__engine-slot canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none;
  }
  .${WRAP_CLASS}__transport-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.4s ease;
    background: rgba(0, 0, 0, 0.12);
  }
  .${WRAP_CLASS}__transport-overlay--visible {
    opacity: 1;
  }
  .${WRAP_CLASS}__transport-glyph {
    font-size: clamp(3rem, 14vw, 5.5rem);
    color: hsl(var(--hsl-l1, 0 0% 98%));
    filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.65));
    line-height: 1;
  }
  .${WRAP_CLASS}__transport-glyph .fa-fw {
    width: 1.15em;
    text-align: center;
  }
  .${WRAP_CLASS}__seek {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 10px;
    background: hsl(var(--hsl-b4, 333 18% 14%));
    border-top: 1px solid hsl(var(--hsl-b5, 333 18% 10%));
    font-size: 12px;
    color: hsl(var(--hsl-l2, 0 0% 75%));
  }
  .${WRAP_CLASS}__seek button {
    flex: 0 0 auto;
    padding: 4px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font: inherit;
    background: hsl(var(--hsl-b5, 333 18% 28%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  .${WRAP_CLASS}__seek button:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .${WRAP_CLASS}__seek button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__status {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    text-align: right;
  }
  .${WRAP_CLASS}__seek-time {
    flex: 0 0 auto;
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--hsl-l2, 0 0% 75%));
    white-space: nowrap;
  }
  .${WRAP_CLASS}__seek-range {
    flex: 1 1 0;
    min-width: 72px;
    width: 0;
    height: 22px;
    accent-color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${WRAP_CLASS}__seek-range:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__volume {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }
  .${WRAP_CLASS}__volume-icon {
    color: hsl(var(--hsl-l2, 0 0% 75%));
    font-size: 12px;
    line-height: 1;
    opacity: 0.9;
  }
  .${WRAP_CLASS}__volume-range {
    width: 72px;
    min-width: 56px;
    max-width: 100px;
    height: 22px;
    flex: 0 0 72px;
    accent-color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${WRAP_CLASS}__volume-range:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__offset-input {
    width: 4.25em;
    min-width: 3.25em;
    max-width: 6em;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b5, 333 18% 12%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
    font: inherit;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    box-sizing: border-box;
  }
  .${WRAP_CLASS}__offset-input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__offset-input:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
  }
  .${WRAP_CLASS}__offset-unit {
    flex: 0 0 auto;
    font-size: 11px;
    color: hsl(var(--hsl-l2, 0 0% 75%));
    user-select: none;
  }
  .oep-beatmap-preview-section {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 20px 12px;
  }
  @media (min-width: 900px) {
    .oep-beatmap-preview-section {
      padding: 12px 40px 16px;
    }
  }
  .oep-beatmap-preview-section > .beatmapset-info__row {
    display: flex;
    flex-direction: column;
    padding-bottom: 0;
    min-width: 0;
  }
`;
