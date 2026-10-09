/**
 * ImageMap helper logic without DOM (WS-40): area geometry in percent of the
 * image, osu-web link rules, and `[imagemap]` parsing and generation.
 *
 * osu-web BBCodeFromDB::parseImagemap only matches link lines when the URL
 * is `#`, `http(s)://…` (no spaces), or `mailto:…` — see ppy/osu-web.
 */

/** Smallest area side, in percent, while moving or resizing. */
export const IMAP_MIN_RECT_PCT = 1;

export function formatImapPct(v) {
  const n = Math.max(0, Math.min(100, Number(v)));
  const r = Math.round(n * 100) / 100;
  return String(r.toFixed(2)).replace(/\.?0+$/, "");
}

export function normalizeImapLinkUrlForOsu(raw) {
  const u = String(raw || "").trim();
  if (!u) return null;
  if (u === "#") return "#";
  if (/^https?:\/\/\S+$/i.test(u)) return u;
  if (/^mailto:\S+$/i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `https://osu.ppy.sh${u}`;
  return null;
}

export function parseImagemapFromText(text) {
  const m = String(text || "").match(
    /\[imagemap\]\s*([\s\S]*?)\s*\[\/imagemap\]/i,
  );
  if (!m) return null;
  const rawBody = m[1].replace(/\r\n/g, "\n").trim();
  if (!rawBody) return null;
  const lines = rawBody
    .split("\n")
    .map((l) => l.trim())
    .filter((ln) => ln.length > 0);
  if (!lines.length) return null;
  const imageUrl = lines[0];
  const areas = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    const rm = line.match(
      /^([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+(\S+)(?:\s+(.*))?$/,
    );
    if (!rm) continue;
    const x = Number(rm[1]);
    const y = Number(rm[2]);
    const w = Number(rm[3]);
    const h = Number(rm[4]);
    if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
    areas.push({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      w: Math.max(0, Math.min(100, w)),
      h: Math.max(0, Math.min(100, h)),
      url: rm[5],
      title: (rm[6] || "").trim(),
    });
  }
  return { imageUrl, areas };
}

export function generateImagemapBbcode(imageUrl, hotspots) {
  const imgUrl = String(imageUrl || "").trim();
  if (!imgUrl) return "";
  const valid = hotspots
    .map((hs) => ({
      hs,
      link: normalizeImapLinkUrlForOsu(hs.url),
    }))
    .filter((o) => o.link);
  if (!valid.length) return "";
  const lines = [imgUrl];
  valid.forEach(({ hs, link }) => {
    const { x, y, w, h, title } = hs;
    let line = `${formatImapPct(x)} ${formatImapPct(y)} ${formatImapPct(w)} ${formatImapPct(h)} ${link}`;
    const t = String(title || "").trim();
    if (t) line += ` ${t}`;
    lines.push(line);
  });
  return `[imagemap]\n${lines.join("\n")}\n[/imagemap]`;
}

export function formatBbcodeForSingleLineDisplay(multiline) {
  if (!multiline) return "";
  return String(multiline).replace(/\r?\n/g, " ").trim();
}

export function clampImapRect(o, minSz = IMAP_MIN_RECT_PCT) {
  let x = o.x;
  let y = o.y;
  let w = Math.max(minSz, o.w);
  let h = Math.max(minSz, o.h);
  x = Math.max(0, Math.min(100 - w, x));
  y = Math.max(0, Math.min(100 - h, y));
  if (x + w > 100) w = 100 - x;
  if (y + h > 100) h = 100 - y;
  w = Math.max(minSz, w);
  h = Math.max(minSz, h);
  return { x, y, w, h };
}

export function computeResizeRect(corner, s, pt, minSz = IMAP_MIN_RECT_PCT) {
  const px = Math.max(0, Math.min(100, pt.x));
  const py = Math.max(0, Math.min(100, pt.y));
  const rx = s.x + s.w;
  const by = s.y + s.h;
  let x = s.x;
  let y = s.y;
  let w = s.w;
  let h = s.h;
  if (corner === "se") {
    x = s.x;
    y = s.y;
    w = px - x;
    h = py - y;
  } else if (corner === "nw") {
    w = Math.max(minSz, rx - px);
    h = Math.max(minSz, by - py);
    x = rx - w;
    y = by - h;
  } else if (corner === "ne") {
    x = s.x;
    y = Math.min(py, by - minSz);
    w = Math.max(minSz, px - x);
    h = by - y;
  } else if (corner === "sw") {
    x = Math.min(px, rx - minSz);
    y = s.y;
    w = rx - x;
    h = Math.max(minSz, py - y);
  }
  return clampImapRect({ x, y, w, h }, minSz);
}

export function pctRawFromEvent(ev, bounds) {
  if (!bounds.width || !bounds.height) return null;
  return {
    x: ((ev.clientX - bounds.left) / bounds.width) * 100,
    y: ((ev.clientY - bounds.top) / bounds.height) * 100,
  };
}

/** Intersect drag box (two corners, possibly outside 0–100%) with the image. */
export function selectionRectFromDragPct(sx, sy, ex, ey) {
  const xLo = Math.min(sx, ex);
  const xHi = Math.max(sx, ex);
  const yLo = Math.min(sy, ey);
  const yHi = Math.max(sy, ey);
  const cxLo = Math.max(0, Math.min(100, xLo));
  const cxHi = Math.max(0, Math.min(100, xHi));
  const cyLo = Math.max(0, Math.min(100, yLo));
  const cyHi = Math.max(0, Math.min(100, yHi));
  return {
    x: cxLo,
    y: cyLo,
    w: Math.max(0, cxHi - cxLo),
    h: Math.max(0, cyHi - cyLo),
  };
}
