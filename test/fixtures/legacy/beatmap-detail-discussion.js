/*
 * Frozen copy of the discussion preview helpers that lived inside
 * startBeatmapDiscussionPreviewManager in src/pages/beatmap-detail.js before
 * WS-30 (snapshot of 832f943). Read by test/osu/legacy.mjs (legacySource) so
 * the src/editor golden and placement tests can keep comparing against the
 * old behaviour. Not loaded by the userscript; do not edit.
 */

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function sanitizeHttpUrl(raw) {
      if (!raw) return null;
      const candidate = String(raw).trim();
      if (!candidate) return null;
      try {
        const parsed = new URL(candidate, location.origin);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
          return null;
        return parsed.href;
      } catch (_) {
        return null;
      }
    }

    function renderMarkdownPreviewHtml(src) {
      const raw = String(src ?? "");
      if (!raw.trim()) {
        return `<p class="oep-discussion-preview__empty">Nothing to preview yet.</p>`;
      }
      const lines = raw.replace(/\r\n?/g, "\n").split("\n");
      const out = [];
      let inCode = false;
      let inUl = false;
      let inOl = false;
      let inQuote = false;

      const closeLists = () => {
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
      };
      const closeQuote = () => {
        if (inQuote) {
          out.push("</blockquote>");
          inQuote = false;
        }
      };
      const inline = (line) => {
        let s = escapeHtml(line);
        s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, altRaw, srcRaw) => {
          const src = sanitizeHttpUrl(srcRaw);
          if (!src) return escapeHtml(`![${altRaw}](${srcRaw})`);
          const alt = escapeHtml(altRaw || "");
          return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" />`;
        });
        s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
        s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
        s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
        s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
        s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
        s = s.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        );
        return s;
      };

      for (const lineRaw of lines) {
        const line = lineRaw ?? "";
        if (/^```/.test(line.trim())) {
          closeLists();
          closeQuote();
          if (!inCode) {
            out.push("<pre><code>");
            inCode = true;
          } else {
            out.push("</code></pre>");
            inCode = false;
          }
          continue;
        }
        if (inCode) {
          out.push(`${escapeHtml(line)}\n`);
          continue;
        }

        const trimmed = line.trim();
        if (!trimmed) {
          closeLists();
          closeQuote();
          continue;
        }

        const quoteMatch = line.match(/^\s*>\s?(.*)$/);
        if (quoteMatch) {
          closeLists();
          if (!inQuote) {
            out.push("<blockquote>");
            inQuote = true;
          }
          out.push(`<p>${inline(quoteMatch[1])}</p>`);
          continue;
        } else {
          closeQuote();
        }

        const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (ulMatch) {
          if (!inUl) {
            if (inOl) {
              out.push("</ol>");
              inOl = false;
            }
            out.push("<ul>");
            inUl = true;
          }
          out.push(`<li>${inline(ulMatch[1])}</li>`);
          continue;
        }

        const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (olMatch) {
          if (!inOl) {
            if (inUl) {
              out.push("</ul>");
              inUl = false;
            }
            out.push("<ol>");
            inOl = true;
          }
          out.push(`<li>${inline(olMatch[2])}</li>`);
          continue;
        }

        closeLists();
        const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
          continue;
        }
        out.push(`<p>${inline(line)}</p>`);
      }

      if (inCode) out.push("</code></pre>");
      closeLists();
      closeQuote();
      return out.join("");
    }

    function placePreviewToggleButton(composerRoot, toggleBtn, textarea) {
      const moveAsFirstChild = (parent, child) => {
        if (!(parent instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        if (
          child.parentElement === parent &&
          parent.firstElementChild === child
        )
          return;
        parent.prepend(child);
      };
      const moveBefore = (anchor, child) => {
        if (!(anchor instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        const parent = anchor.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (
          child.parentElement === parent &&
          child.nextElementSibling === anchor
        )
          return;
        anchor.insertAdjacentElement("beforebegin", child);
      };

      const replyButton = Array.from(
        composerRoot.querySelectorAll("button, [role='button']"),
      ).find((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const label = String(node.textContent || "")
          .trim()
          .toLowerCase();
        return label === "reply" || label === "respond" || label === "response";
      });
      const noteButton = Array.from(
        composerRoot.querySelectorAll("button, [role='button']"),
      ).find(
        (node) =>
          node instanceof HTMLElement && node.textContent?.trim() === "Note",
      );
      const insertParent =
        composerRoot.querySelector(".beatmap-discussion-new__footer") ||
        composerRoot.querySelector("[class*='footer']") ||
        composerRoot.querySelector("[class*='actions']");
      if (replyButton instanceof HTMLElement && replyButton.parentElement) {
        const replyGroup =
          replyButton.closest(".beatmap-discussion-post__actions-group") ||
          replyButton.parentElement;
        if (replyGroup instanceof HTMLElement) {
          moveAsFirstChild(replyGroup, toggleBtn);
        } else {
          moveBefore(replyButton, toggleBtn);
        }
      } else if (
        noteButton instanceof HTMLElement &&
        noteButton.parentElement
      ) {
        const noteGroup =
          noteButton.closest(".beatmap-discussion-post__actions-group") ||
          noteButton.parentElement;
        if (noteGroup instanceof HTMLElement) {
          moveAsFirstChild(noteGroup, toggleBtn);
        } else {
          moveBefore(noteButton, toggleBtn);
        }
      } else if (
        insertParent instanceof HTMLElement &&
        toggleBtn.parentElement !== insertParent
      ) {
        moveAsFirstChild(insertParent, toggleBtn);
      } else if (!(toggleBtn.parentElement instanceof HTMLElement)) {
        const anchor =
          textarea?.closest(".beatmap-discussion-new__message") ||
          textarea?.parentElement ||
          composerRoot;
        moveAsFirstChild(anchor, toggleBtn);
      }
    }
