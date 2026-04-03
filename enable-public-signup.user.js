// ==UserScript==
// @name         Challonge – Enable Public Sign-Up for Monthly SGOCE Brackets
// @namespace    https://challonge.com/
// @version      1.5
// @description  Navigates to each SGOCE bracket's settings page for the current month and ensures the "Public Sign-Up" checkbox is ticked.
// @match        https://challonge.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────
  // Rules (year 2026):
  //   • Counting starts from Jan 14 (not Jan 1).
  //   • January: every Thursday gets a Newbbats.
  //   • February onward: Newbbats on every *other* Thursday (skipWeek toggle).
  //   • Quickbats: every Friday *except* the last Friday of the month.
  //   • Ranbats: the last Friday of the month (one per month, appended last).
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a Date for the last Friday of the given month.
   * @param {number} year
   * @param {number} month  1-indexed (1 = Jan … 12 = Dec)
   */
  function lastFridayOfMonth(year, month) {
    // new Date(year, month, 0) — passing day=0 rolls back to the last day
    // of the *previous* month.  Because `month` here is 1-indexed, passing
    // it as-is to the 0-indexed Date constructor gives us the last day of
    // the desired month.  e.g. new Date(2026, 4, 0) → 30 Apr 2026.
    const d = new Date(year, month, 0);
    while (d.getDay() !== 5) {
      // 5 = Friday in JS (0=Sun … 6=Sat)
      d.setDate(d.getDate() - 1);
    }
    return d;
  }

  /** True when two Date objects fall on the same calendar day. */
  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  /**
   * Generates bracket URLs for the given year/month in chronological order
   * @param {number} year
   * @param {number} month  1-indexed
   * @returns {string[]}
   */
  function generateBracketURLs(year, month) {
    const MONTH_ABBRS = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];

    const urls = [];

    // 2026 override: counting begins Jan 14, not Jan 1
    let dayCounter =
      year === 2026
        ? new Date(year, 0, 14) // Jan 14
        : new Date(year, 0, 1); // Jan  1

    let newbbatsCounter = 1;
    let quickbatsCounter = 1;
    let skipWeek = true;

    // ── Phase 1: advance counters through all months before the target ──
    //
    // dayCounter.getMonth() is 0-indexed; +1 converts to 1-indexed to
    // compare against `month`.
    while (dayCounter.getMonth() + 1 !== month) {
      const dow = dayCounter.getDay(); // 0=Sun, 3=Wed, 4=Thu, 5=Fri

      if (dow === 4 && dayCounter.getMonth() < 4) {
        // Thursday
        // In 2026, jan-apr newbbats are on thursdays
        // getMonth() > 0  →  after January (0-indexed)
        if (dayCounter.getMonth() > 0 && skipWeek) {
          skipWeek = false;
        } else {
          newbbatsCounter++;
          skipWeek = true;
        }
      }

      if (dow === 3 && dayCounter.getMonth() >= 4) {
        // Wednesday
        // In 2026, may and onwards newbbats are on wednesdays
        if (skipWeek) {
          skipWeek = false;
        } else {
          newbbatsCounter++;
          skipWeek = true;
        }
      }

      if (dow === 5) {
        // Friday
        const lfm = lastFridayOfMonth(year, dayCounter.getMonth() + 1);
        if (!isSameDay(dayCounter, lfm)) {
          quickbatsCounter++;
        }
      }

      dayCounter.setDate(dayCounter.getDate() + 1);
    }

    // ── Phase 2: generate a queue of bracket URLs for the target month ──

    dayCounter =
      year === 2026 && month === 1
        ? new Date(year, 0, 14) // Jan special-case
        : new Date(year, month - 1, 1); // first day of target month

    const lastFriday = lastFridayOfMonth(year, month);

    while (dayCounter.getMonth() + 1 === month) {
      const dow = dayCounter.getDay();

      if (dow === 4 && dayCounter.getMonth() < 4) {
        // Thursday → Newbbats (conditional)
        // In 2026, jan-apr newbbats are on thursdays
        if (dayCounter.getMonth() > 0 && skipWeek) {
          skipWeek = false;
        } else {
          urls.push(
            `https://challonge.com/sgoce${year}newbbats${newbbatsCounter}`,
          );
          newbbatsCounter++;
          skipWeek = true;
        }
      }

      if (dow === 3 && dayCounter.getMonth() >= 4) {
        // Wednesday
        // In 2026, may and onwards newbbats are on wednesdays
        if (skipWeek) {
          skipWeek = false; // skip this Thursday
        } else {
          urls.push(
            `https://challonge.com/sgoce${year}newbbats${newbbatsCounter}`,
          );
          newbbatsCounter++;
          skipWeek = true;
        }
      }

      if (dow === 5 && !isSameDay(dayCounter, lastFriday)) {
        // Friday that is NOT the last Friday → Quickbats
        urls.push(
          `https://challonge.com/sgoce${year}quickbats${quickbatsCounter}`,
        );
        quickbatsCounter++;
      }

      dayCounter.setDate(dayCounter.getDate() + 1);
    }

    // Ranbats always on the last Friday of the month (appended last, as in
    // main.py which calls create_ranbats() outside the day loop)
    urls.push(
      `https://challonge.com/sgoce${year}ranbats${MONTH_ABBRS[month - 1]}`,
    );

    return urls;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GM storage helpers
  // GM_setValue / GM_getValue are sandboxed to this userscript — no other
  // page script can read or tamper with these values.
  // ─────────────────────────────────────────────────────────────────────────

  function loadQueue() {
    try {
      // JSON.parse on a trusted, script-internal string — no eval
      return JSON.parse(GM_getValue("sgoce_queue", "[]"));
    } catch (_) {
      return [];
    }
  }

  function loadIndex() {
    return parseInt(GM_getValue("sgoce_index", "0"), 10) || 0;
  }

  function saveQueue(queue) {
    GM_setValue("sgoce_queue", JSON.stringify(queue));
  }

  function saveIndex(idx) {
    GM_setValue("sgoce_index", String(idx));
  }

  function clearState() {
    GM_setValue("sgoce_queue", "[]");
    GM_setValue("sgoce_index", "0");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI helpers
  // All DOM construction uses createElement / textContent — never innerHTML —
  // to prevent any inadvertent XSS if bracket names were ever user-controlled.
  // ─────────────────────────────────────────────────────────────────────────

  function buildPanel(message, showStop) {
    const existing = document.getElementById("sgoce-panel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "sgoce-panel";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      background: "#1a1a2e",
      color: "#eee",
      border: "2px solid #2ec4b6",
      borderRadius: "8px",
      padding: "12px 16px",
      fontFamily: "monospace",
      fontSize: "13px",
      zIndex: "99999",
      maxWidth: "340px",
      lineHeight: "1.5",
      boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
      whiteSpace: "pre-wrap",
    });

    const title = document.createElement("strong");
    title.style.color = "#2ec4b6";
    title.textContent = "SGOCE Bracket Setup\n";
    panel.appendChild(title);

    const msg = document.createElement("span");
    msg.textContent = message; // textContent, not innerHTML
    panel.appendChild(msg);

    if (showStop) {
      const btn = document.createElement("button");
      btn.textContent = "■ Stop";
      Object.assign(btn.style, {
        display: "block",
        marginTop: "8px",
        background: "#178077",
        color: "white",
        border: "none",
        borderRadius: "4px",
        padding: "4px 12px",
        cursor: "pointer",
        fontSize: "12px",
      });
      btn.addEventListener("click", () => {
        clearState();
        panel.remove();
      });
      panel.appendChild(btn);
    }

    document.body.appendChild(panel);
    return panel;
  }

  function buildStartButton() {
    const btn = document.createElement("button");
    btn.id = "sgoce-start-btn";
    btn.textContent = "▶ Enable Public Sign-Up (This Month)";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      background: "#178077",
      color: "white",
      border: "none",
      borderRadius: "6px",
      padding: "10px 16px",
      cursor: "pointer",
      fontSize: "13px",
      fontFamily: "monospace",
      zIndex: "99999",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    });
    btn.addEventListener("click", startProcess);
    document.body.appendChild(btn);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core process
  // ─────────────────────────────────────────────────────────────────────────

  function startProcess() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // convert 0-indexed to 1-indexed

    const urls = generateBracketURLs(year, month);
    saveQueue(urls);
    saveIndex(0);

    // Navigate to the first bracket's settings page
    window.location.href = urls[0] + "/settings";
  }

  function advanceQueue(queue, index) {
    const next = index + 1;
    if (next >= queue.length) {
      clearState();
      buildPanel(`✅ Done! All ${queue.length} bracket(s) processed.`, false);
    } else {
      saveIndex(next);
      // Brief pause so the user can see progress before navigating
      setTimeout(() => {
        window.location.href = queue[next] + "/settings";
      }, 600);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entry point — runs on every challonge.com page load
  // ─────────────────────────────────────────────────────────────────────────

  const queue = loadQueue();
  const index = loadIndex();

  // If the queue is populated but index is past the end, the last bracket was
  // just processed (index was advanced before the final save).  Show the
  // completion message on this landing page and then clean up.
  if (queue.length > 0 && index >= queue.length) {
    const total = queue.length;
    clearState();
    buildPanel(`✅ Done! All ${total} bracket(s) processed.`, false);
    return;
  }

  const hasActive = queue.length > 0 && index < queue.length;

  if (!hasActive) {
    // No run in progress — show the trigger button
    buildStartButton();
    return;
  }

  const expectedSettings = queue[index] + "/settings";

  // Strip query string and trailing slash before comparing, so the check
  // works whether Challonge redirects with params or not after a save.
  const currentPath = window.location.href.split("?")[0].replace(/\/$/, "");

  if (currentPath !== expectedSettings) {
    // Not on the right page yet — navigate there
    buildPanel(`Navigating to settings ${index + 1} / ${queue.length}…`, true);
    setTimeout(() => {
      window.location.href = expectedSettings;
    }, 600);
    return;
  }

  // ── We are on the correct settings page ──

  const checkbox = document.querySelector(
    'input[type="checkbox"][name="tournament[public_sign_up]"]',
  );

  if (!checkbox) {
    // Checkbox wasn't found — page may have an unexpected structure; skip
    buildPanel(
      `⚠ Checkbox not found on settings ${index + 1}/${queue.length}.\nSkipping in 3 s…`,
      true,
    );
    setTimeout(() => advanceQueue(queue, index), 3000);
    return;
  }

  if (checkbox.checked) {
    // Already ticked — nothing to change, move on immediately
    buildPanel(
      `✓ Already enabled (${index + 1}/${queue.length}).\nMoving on…`,
      true,
    );
    setTimeout(() => advanceQueue(queue, index), 800);
    return;
  }

  // ── Tick the checkbox and save ──

  const bracketSlug = queue[index].split("/").pop();
  buildPanel(
    `Enabling sign-up (${index + 1}/${queue.length}):\n${bracketSlug}…`,
    true,
  );

  // Advance the queue index NOW, before the form submits.  This breaks the
  // infinite loop: if the save redirects back to the same /settings page the
  // script will see the updated index and navigate away rather than retrying.
  saveIndex(index + 1);

  // Set the property directly rather than calling checkbox.click(), which
  // *toggles* the value and can be intercepted by framework event handlers.
  // Dispatching "change" and "input" notifies Parsley.js / jQuery listeners.
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  checkbox.dispatchEvent(new Event("input", { bubbles: true }));

  // Belt-and-braces: if a styled <label> is present (some Challonge themes
  // visually hide the raw <input>), clicking it is the most natural trigger.
  // Only do so if the direct approach above left the box unchecked.
  const label = document.querySelector(`label[for="${checkbox.id}"]`);
  if (label && !checkbox.checked) {
    label.click();
  }

  setTimeout(() => {
    // Target the "Save Changes" submit button specifically (name="commit" is
    // the Rails convention used by Challonge's settings form).  Fall back to
    // any submit button on the page, then to form.submit() as last resort.
    const form = checkbox.closest("form");
    const saveBtn = (form || document).querySelector(
      'input[type="submit"][name="commit"], input[type="submit"], button[type="submit"]',
    );

    if (saveBtn) {
      saveBtn.click();
    } else if (form) {
      form.submit();
    } else {
      // No save mechanism found — index already advanced, so just navigate on
      buildPanel(
        `⚠ Could not find save button (${index + 1}/${queue.length}).\nMoving on…`,
        true,
      );
      setTimeout(() => {
        const q = loadQueue();
        const i = loadIndex();
        if (i < q.length) window.location.href = q[i] + "/settings";
      }, 2000);
    }
  }, 400); // short delay ensures checkbox state is committed before submit
})();