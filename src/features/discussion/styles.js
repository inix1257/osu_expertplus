/**
 * Styles for the discussion page features (WS-30, moved out of the
 * beatmap-detail stylesheet).
 */

export const DISCUSSION_STYLE_ID = "osu-expertplus-beatmap-discussion-css";

export const DISCUSSION_CSS = `
  .oep-discussion-preview-toggle {
    margin-left: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b4, 333 18% 18%));
    color: hsl(var(--hsl-l1, 0 0% 90%));
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .oep-discussion-preview-toggle:hover {
    background: hsl(var(--hsl-b5, 333 18% 24%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
  }
  .oep-discussion-preview-toggle[aria-pressed="true"] {
    background: hsl(var(--hsl-c1, 333 89% 68%) / 0.2);
    border-color: hsl(var(--hsl-c1, 333 89% 58%));
    color: hsl(var(--hsl-l1, 0 0% 100%));
  }
  .oep-discussion-preview {
    margin-top: 10px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    background: hsl(var(--hsl-b3, 333 18% 14%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
    font-size: 13px;
    line-height: 1.55;
    word-break: break-word;
  }
  .oep-discussion-preview[hidden] {
    display: none !important;
  }
  .oep-discussion-preview__title {
    margin: 0 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .oep-discussion-preview__body pre,
  .oep-discussion-preview__body code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  .oep-discussion-preview__body pre {
    overflow-x: auto;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    background: hsl(var(--hsl-b2, 333 18% 10%));
  }
  .oep-discussion-preview__body p,
  .oep-discussion-preview__body ul,
  .oep-discussion-preview__body ol,
  .oep-discussion-preview__body blockquote {
    margin: 0 0 8px;
  }
  .oep-discussion-preview__body p:last-child,
  .oep-discussion-preview__body ul:last-child,
  .oep-discussion-preview__body ol:last-child,
  .oep-discussion-preview__body blockquote:last-child {
    margin-bottom: 0;
  }
  .oep-discussion-preview__body blockquote {
    border-left: 3px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    padding-left: 10px;
    color: hsl(var(--hsl-l2, 0 0% 78%));
  }
  .oep-discussion-preview__body img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 8px 0;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    background: hsl(var(--hsl-b2, 333 18% 10%));
  }
  .oep-discussion-preview__empty {
    color: hsl(var(--hsl-l2, 0 0% 68%));
    font-style: italic;
  }
  .oep-markdown-helper {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-sizing: border-box;
  }
  .oep-markdown-helper__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .oep-markdown-helper--new-discussion {
    margin: 0 0 10px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    background: hsl(var(--hsl-b2, 333 18% 10%) / 0.65);
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__row {
    gap: 6px;
  }
  .oep-markdown-helper--reply {
    margin: 10px 10px 10px;
    padding: 0 0 6px;
    border: none;
    border-radius: 0;
    border-bottom: 1px solid hsl(var(--hsl-b5, 333 18% 22%) / 0.55);
    background: transparent;
    box-shadow: none;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__row {
    flex-wrap: nowrap;
    gap: 4px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--hsl-b5, 333 18% 30%)) transparent;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar {
    height: 4px;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: hsl(var(--hsl-b5, 333 18% 32%));
  }
  .oep-markdown-helper__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 5px 8px;
    min-height: 26px;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b3, 333 18% 14%));
    color: hsl(var(--hsl-l2, 0 0% 82%));
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    white-space: nowrap;
    margin: 0;
    box-shadow: none;
    transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn {
    padding: 5px 9px;
    min-height: 28px;
    border-radius: 6px;
    border-color: hsl(var(--hsl-b5, 333 18% 26%));
    background: hsl(var(--hsl-b3, 333 18% 16%));
    color: hsl(var(--hsl-l1, 0 0% 94%));
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:hover {
    background: hsl(var(--hsl-b4, 333 18% 20%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
    color: hsl(var(--hsl-l1, 0 0% 98%));
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.65);
    outline-offset: 2px;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn {
    flex: 0 0 auto;
    padding: 3px 6px;
    min-height: 24px;
    gap: 3px;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 600;
    border-color: hsl(var(--hsl-b5, 333 18% 26%) / 0.85);
    background: hsl(var(--hsl-b3, 333 18% 13%) / 0.9);
    color: hsl(var(--hsl-l2, 0 0% 80%));
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn:hover {
    background: hsl(var(--hsl-b4, 333 18% 18%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.35);
    color: hsl(var(--hsl-l1, 0 0% 94%));
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
    outline-offset: 1px;
  }
  .oep-markdown-helper__btn:hover {
    background: hsl(var(--hsl-b4, 333 18% 19%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.38);
    color: hsl(var(--hsl-l1, 0 0% 96%));
  }
  .oep-markdown-helper__btn i {
    font-size: 10px;
    opacity: 0.88;
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn i {
    font-size: 11px;
    opacity: 0.9;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn i {
    font-size: 9px;
    opacity: 0.85;
  }
  .oep-discussion-voters-tooltip {
    min-width: min(216px, 70vw);
    max-width: min(252px, 78vw);
    padding: 0 !important;
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 22%));
    background: hsl(var(--hsl-b1, 333 18% 8%));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }
  .oep-discussion-voters-tooltip__list {
    max-height: min(320px, 52vh);
    overflow: auto;
    background: hsl(var(--hsl-b1, 333 18% 8%));
  }
  .oep-discussion-voters-tooltip__row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 9px;
    margin: 4px;
    text-decoration: none;
    color: hsl(var(--hsl-l1, 0 0% 92%));
    border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
    border-radius: 8px;
    background: hsl(var(--hsl-b2, 333 18% 10%));
    transition: background 120ms ease;
  }
  .oep-discussion-voters-tooltip__row:last-child {
    margin-bottom: 6px;
  }
  .oep-discussion-voters-tooltip__row:hover {
    background: hsl(var(--hsl-b3, 333 18% 13%));
  }
  .oep-discussion-voters-tooltip__avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
  }
  .oep-discussion-voters-tooltip__name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
