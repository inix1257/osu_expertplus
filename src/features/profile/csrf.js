/**
 * osu-web's CSRF token from the page meta tag (WS-41).
 */
export function maybeCsrfToken() {
  const m = document.querySelector('meta[name="csrf-token"]');
  if (!(m instanceof HTMLMetaElement)) return "";
  return String(m.content || "").trim();
}
