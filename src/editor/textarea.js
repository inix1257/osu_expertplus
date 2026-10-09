/**
 * Textarea editing helpers shared by the BBCode toolbar (user-profile) and
 * the markdown toolbar (beatmap discussion). They replace
 * user-profile `_replaceTextareaRange` / `_toggleBbcodeWrap` and
 * beatmap-detail `replaceRangeUndoable` / `toggleWrap`.
 */

/**
 * Replace `[from, to)` with `replacement` so that it lands on the native
 * undo stack where supported (`execCommand("insertText")`, Chromium and
 * Firefox), falling back to `setRangeText`. The caret ends after the
 * inserted text.
 * @param {HTMLTextAreaElement} textarea
 * @param {number} from
 * @param {number} to
 * @param {string} replacement
 * @param {{ dispatchInput?: boolean }} [options] dispatch a bubbling `input`
 *   event afterwards (default true, like `_replaceTextareaRange`;
 *   beatmap-detail's `replaceRangeUndoable` did not, its callers did)
 * @returns {boolean} true when the native undo path was used
 */
export function replaceRange(textarea, from, to, replacement, options = {}) {
  const doc = textarea.ownerDocument;
  textarea.focus();
  textarea.setSelectionRange(from, to);
  let native = false;
  try {
    if (typeof doc.execCommand === "function") {
      native = doc.execCommand("insertText", false, replacement) === true;
    }
  } catch (_) {
    native = false;
  }
  if (!native) textarea.setRangeText(replacement, from, to, "end");
  if (options.dispatchInput !== false) dispatchInput(textarea);
  return native;
}

/** @param {HTMLTextAreaElement} textarea */
function dispatchInput(textarea) {
  const view = textarea.ownerDocument.defaultView;
  const EventCtor = view?.Event ?? Event;
  textarea.dispatchEvent(new EventCtor("input", { bubbles: true }));
}

/**
 * Toggle `open`/`close` markers around the selection (or at the caret):
 * 1. the selection itself starts with `open` and ends with `close` → strip
 *    them, select the inner text (only with `matchInside`, default true);
 * 2. the markers sit right outside the selection → strip them, keep the
 *    text selected;
 * 3. caret (no selection) between an empty pair `open|close` → remove the
 *    pair;
 * 4. otherwise wrap: the selected text stays selected; with no selection
 *    the `placeholder` is inserted and selected, or with no placeholder the
 *    caret goes between the markers.
 *
 * Cases 1–4 without a placeholder are user-profile `_toggleBbcodeWrap`.
 * beatmap-detail `toggleWrap` had cases 2–4 with a placeholder (case 3 via
 * its "outer wrap" check); pass `{ matchInside: false, placeholder }` to keep
 * that exactly (with `matchInside`, selecting `**bold**` and pressing the
 * italic `*` button gives `*bold*` instead of `***bold***`).
 *
 * One `input` event is dispatched after the final selection is set.
 * @param {HTMLTextAreaElement} textarea
 * @param {string} open
 * @param {string} close
 * @param {{ placeholder?: string, matchInside?: boolean }} [options]
 * @returns {"unwrapped" | "wrapped"}
 */
export function toggleWrap(textarea, open, close, options = {}) {
  const placeholder = String(options.placeholder ?? "");
  const matchInside = options.matchInside !== false;
  const value = textarea.value || "";
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const hasSelection = end > start;
  const selected = value.slice(start, end);
  const quiet = { dispatchInput: false };

  const selectedIsWrapped =
    matchInside &&
    hasSelection &&
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close);
  const outsideIsWrapped =
    start >= open.length &&
    value.slice(start - open.length, start) === open &&
    value.slice(end, end + close.length) === close;

  let result;
  let nextStart;
  let nextEnd;
  if (selectedIsWrapped) {
    const inner = selected.slice(open.length, selected.length - close.length);
    replaceRange(textarea, start, end, inner, quiet);
    nextStart = start;
    nextEnd = start + inner.length;
    result = "unwrapped";
  } else if (outsideIsWrapped) {
    nextStart = start - open.length;
    replaceRange(textarea, nextStart, end + close.length, selected, quiet);
    nextEnd = nextStart + selected.length;
    result = "unwrapped";
  } else {
    const body = selected || placeholder;
    replaceRange(textarea, start, end, `${open}${body}${close}`, quiet);
    nextStart = start + open.length;
    nextEnd = nextStart + body.length;
    result = "wrapped";
  }
  textarea.setSelectionRange(nextStart, nextEnd);
  dispatchInput(textarea);
  return result;
}
