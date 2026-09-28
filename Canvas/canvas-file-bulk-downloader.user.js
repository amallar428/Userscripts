// ==UserScript==
// @name         MIT Canvas Page/Module File Downloader
// @namespace    local.mit.canvas.file.downloader
// @version      1.0
// @description  Browse, select, and download linked files from MIT Canvas pages/modules.
// @author       local
// @match        https://canvas.mit.edu/courses/*/pages/*
// @match        https://canvas.mit.edu/courses/*/modules*
// @match        https://canvas.mit.edu/courses/*/modules/items/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      canvas.mit.edu
// ==/UserScript==

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────────

  GM_addStyle(`
    #cmd-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 999999;
      background: #a31f34;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 11px 18px;
      font-size: 14px;
      font-weight: 650;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28);
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #cmd-fab:hover {
      background: #86182a;
    }

    #cmd-panel {
      position: fixed;
      bottom: 76px;
      right: 28px;
      z-index: 999999;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 10px;
      width: 380px;
      max-height: 80vh;
      display: none;
      flex-direction: column;
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      overflow: hidden;
    }

    #cmd-panel.open {
      display: flex;
    }

    #cmd-panel-header {
      padding: 13px 14px 10px;
      border-bottom: 1px solid #eee;
      flex-shrink: 0;
    }

    #cmd-panel-header h3 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #222;
    }

    #cmd-mode-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .cmd-small-btn {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 5px;
      background: #fafafa;
      cursor: pointer;
      font-size: 12px;
      color: #333;
    }

    .cmd-small-btn:hover {
      background: #f2f2f2;
    }

    #cmd-module-select {
      width: 100%;
      padding: 6px 7px;
      border: 1px solid #ccc;
      border-radius: 5px;
      font-size: 13px;
      color: #333;
      display: none;
    }

    #cmd-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 10px 14px;
      min-height: 72px;
    }

    #cmd-sel-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 2px 8px;
      border-bottom: 1px solid #eee;
      margin-bottom: 4px;
    }

    #cmd-sel-bar input {
      accent-color: #a31f34;
      cursor: pointer;
    }

    #cmd-sel-bar label {
      font-size: 12px;
      color: #555;
      cursor: pointer;
      flex: 1;
    }

    #cmd-sel-count {
      font-size: 12px;
      color: #a31f34;
      font-weight: 650;
      white-space: nowrap;
    }

    #cmd-file-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .cmd-file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 2px;
      border-bottom: 1px solid #f2f2f2;
      cursor: pointer;
    }

    .cmd-file-row:last-child {
      border-bottom: none;
    }

    .cmd-file-row:hover {
      background: #fff7f8;
      border-radius: 4px;
    }

    .cmd-file-row input[type=checkbox] {
      flex-shrink: 0;
      width: 15px;
      height: 15px;
      accent-color: #a31f34;
      cursor: pointer;
    }

    .cmd-file-row label {
      flex: 1;
      cursor: pointer;
      color: #333;
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }

    .cmd-file-row .cmd-file-kind {
      color: #888;
      font-size: 11px;
      margin-left: 4px;
    }

    .cmd-file-row .cmd-st {
      flex-shrink: 0;
      font-size: 13px;
      width: 18px;
      text-align: center;
    }

    #cmd-panel-footer {
      padding: 10px 14px;
      border-top: 1px solid #eee;
      flex-shrink: 0;
    }

    #cmd-status-text {
      font-size: 12px;
      color: #666;
      min-height: 16px;
      margin-bottom: 7px;
      word-break: break-word;
    }

    #cmd-progress-wrap {
      background: #eee;
      border-radius: 4px;
      height: 6px;
      margin-bottom: 8px;
      overflow: hidden;
      display: none;
    }

    #cmd-progress-bar {
      height: 100%;
      width: 0%;
      background: #a31f34;
      border-radius: 4px;
      transition: width 0.25s;
    }

    #cmd-dl-btn {
      width: 100%;
      padding: 8px;
      background: #a31f34;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
    }

    #cmd-dl-btn:hover:not(:disabled) {
      background: #86182a;
    }

    #cmd-dl-btn:disabled {
      background: #bbb;
      cursor: not-allowed;
    }

    .cmd-hint {
      color: #999;
      font-size: 12px;
      text-align: center;
      padding: 20px 0;
      margin: 0;
      line-height: 1.4;
    }
  `);

  // ─────────────────────────────────────────────────────────────
  // State / constants
  // ─────────────────────────────────────────────────────────────

  const origin = location.origin;
  const courseMatch = location.pathname.match(/\/courses\/(\d+)/);
  const courseId = courseMatch ? courseMatch[1] : null;

  let files = []; // { name, url, kind }[]
  let isRunning = false;

  const FILE_EXTENSIONS = [
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "csv", "txt", "zip", "png", "jpg", "jpeg", "gif", "svg"
  ];

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function sanitizeFilename(name) {
    return String(name || "canvas_file")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getExtensionFromName(nameOrUrl) {
    const clean = String(nameOrUrl || "").split("?")[0].split("#")[0];
    const match = clean.match(/\.([A-Za-z0-9]{2,5})$/);
    return match ? match[1].toLowerCase() : "";
  }

  function looksLikeFileLink(a) {
    const href = a.href || "";
    const text = (a.textContent || "").trim();
    const extPattern = new RegExp(`\\.(${FILE_EXTENSIONS.join("|")})(\\?|#|$)`, "i");

    if (href.includes("/files/")) return true;
    if (extPattern.test(href)) return true;
    if (extPattern.test(text)) return true;

    return false;
  }

  function inferFilenameFromAnchor(a, index) {
    const text = (a.textContent || "").trim();

    if (text && text.length < 220) {
      return sanitizeFilename(text);
    }

    try {
      const url = new URL(a.href);
      const lastPart = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
      if (lastPart) return sanitizeFilename(lastPart);
    } catch (_) {}

    return `canvas_file_${String(index).padStart(2, "0")}`;
  }

  function forceDownloadUrl(url) {
    if (url.includes("/files/") && !url.includes("download=")) {
      return url + (url.includes("?") ? "&download=1" : "?download=1");
    }
    return url;
  }

  function apiGetRaw(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { Accept: "application/json" },
        withCredentials: true,
        onload: resolve,
        onerror: reject
      });
    });
  }

  function apiGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { Accept: "application/json" },
        withCredentials: true,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            try {
              resolve(JSON.parse(response.responseText));
            } catch (_) {
              reject(new Error("JSON parse error"));
            }
          } else {
            reject(new Error(`HTTP ${response.status}`));
          }
        },
        onerror: reject
      });
    });
  }

  async function apiGetAll(url) {
    let results = [];
    let next = url + (url.includes("?") ? "&" : "?") + "per_page=100";

    while (next) {
      const response = await apiGetRaw(next);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}`);
      }

      results = results.concat(JSON.parse(response.responseText));

      const linkHeader = response.responseHeaders.match(/Link:([^\n]*)/i);
      const nextMatch = linkHeader && linkHeader[1].match(/<([^>]+)>;\s*rel="next"/);
      next = nextMatch ? nextMatch[1] : null;
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────
  // DOM
  // ─────────────────────────────────────────────────────────────

  document.body.insertAdjacentHTML("beforeend", `
    <button id="cmd-fab">📥 Files</button>

    <div id="cmd-panel">
      <div id="cmd-panel-header">
        <h3>📥 Canvas File Downloader</h3>

        <div id="cmd-mode-row">
          <button type="button" class="cmd-small-btn" id="cmd-scan-page-btn">
            Scan current page
          </button>
          <button type="button" class="cmd-small-btn" id="cmd-load-modules-btn">
            Browse modules
          </button>
        </div>

        <select id="cmd-module-select">
          <option value="">Loading modules…</option>
        </select>
      </div>

      <div id="cmd-panel-body">
        <p class="cmd-hint">Scan this page, or browse a module to collect files.</p>
      </div>

      <div id="cmd-panel-footer">
        <div id="cmd-status-text"></div>
        <div id="cmd-progress-wrap"><div id="cmd-progress-bar"></div></div>
        <button id="cmd-dl-btn" disabled>⬇️ Download selected</button>
      </div>
    </div>
  `);

  $("cmd-fab").addEventListener("click", () => {
    $("cmd-panel").classList.toggle("open");
  });

  $("cmd-scan-page-btn").addEventListener("click", scanCurrentPage);
  $("cmd-load-modules-btn").addEventListener("click", loadModules);
  $("cmd-module-select").addEventListener("change", loadSelectedModuleFiles);
  $("cmd-dl-btn").addEventListener("click", downloadSelected);

  // Auto-scan on ordinary page URLs because that is probably what you want.
  if (location.pathname.includes("/pages/") || location.pathname.includes("/modules/items/")) {
    setTimeout(scanCurrentPage, 700);
  }

  // ─────────────────────────────────────────────────────────────
  // Page scanning mode
  // ─────────────────────────────────────────────────────────────

function extractCanvasFileIdFromUrl(url) {
  try {
    const u = new URL(url);

    // /courses/:course_id/files/:file_id
    let m = u.pathname.match(/\/courses\/\d+\/files\/(\d+)/);
    if (m) return m[1];

    // /files/:file_id
    m = u.pathname.match(/\/files\/(\d+)/);
    if (m) return m[1];

    return null;
  } catch (_) {
    return null;
  }
}

function extractModuleItemIdFromUrl(url) {
  try {
    const u = new URL(url);

    // /courses/:course_id/modules/items/:module_item_id
    let m = u.pathname.match(/\/courses\/\d+\/modules\/items\/(\d+)/);
    if (m) return m[1];

    // ?module_item_id=1514887
    const q = u.searchParams.get("module_item_id");
    if (q) return q;

    return null;
  } catch (_) {
    return null;
  }
}

function sameOriginCanvasDownloadUrl(fileId) {
  // Keeps the download on canvas.mit.edu instead of relying on info.url,
  // which may redirect to a signed external URL.
  return `${origin}/files/${fileId}/download?download_frd=1`;
}

async function resolveCanvasLinkToFile(anchor, index) {
  const href = anchor.href;
  const fallbackName = inferFilenameFromAnchor(anchor, index);

  // Case 1: Canvas file link
  const fileId = extractCanvasFileIdFromUrl(href);
  if (fileId) {
    const info = await apiGet(`${origin}/api/v1/files/${fileId}`);
    const name = info.display_name || info.filename || fallbackName;

    return {
      name,
      url: sameOriginCanvasDownloadUrl(fileId),
      kind: (getExtensionFromName(name) || "file").toUpperCase()
    };
  }

  // Case 2: Canvas module item link
  const moduleItemId = extractModuleItemIdFromUrl(href);
  if (moduleItemId && courseId) {
    const item = await apiGet(
      `${origin}/api/v1/courses/${courseId}/modules/items/${moduleItemId}`
    );

    if (item.type === "File" && item.content_id) {
      const info = await apiGet(`${origin}/api/v1/files/${item.content_id}`);
      const name = info.display_name || info.filename || item.title || fallbackName;

      return {
        name,
        url: sameOriginCanvasDownloadUrl(item.content_id),
        kind: (getExtensionFromName(name) || "file").toUpperCase()
      };
    }
  }

  // Case 3: ordinary direct file-looking link
  return {
    name: fallbackName,
    url: forceDownloadUrl(href),
    kind: (
      getExtensionFromName(fallbackName) ||
      getExtensionFromName(href) ||
      "file"
    ).toUpperCase()
  };
}

async function scanCurrentPage() {
  resetProgress();
  $("cmd-module-select").style.display = "none";

  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const candidates = anchors.filter(looksLikeFileLink);

  const seen = new Set();
  const collected = [];

  $("cmd-panel-body").innerHTML =
    `<p class="cmd-hint">⏳ Resolving ${candidates.length} possible file link(s)…</p>`;

  for (const a of candidates) {
    try {
      const resolved = await resolveCanvasLinkToFile(a, collected.length + 1);
      if (!resolved || !resolved.url) continue;

      const key = `${resolved.name}::${resolved.url}`;
      if (seen.has(key)) continue;
      seen.add(key);

      collected.push(resolved);
    } catch (e) {
      console.warn("[Canvas downloader] Could not resolve link:", a.href, e);
    }
  }

  files = collected;

  if (!files.length) {
    $("cmd-panel-body").innerHTML =
      `<p class="cmd-hint">No downloadable file links found on this page.</p>`;
    syncSelectionUI();
    return;
  }

  $("cmd-status-text").textContent = `Found ${files.length} resolved file(s).`;
  renderChecklist();
}

  // ─────────────────────────────────────────────────────────────
  // Module browsing mode
  // ─────────────────────────────────────────────────────────────

  async function loadModules() {
    resetProgress();
    $("cmd-module-select").style.display = "block";
    $("cmd-panel-body").innerHTML =
      `<p class="cmd-hint">Loading modules…</p>`;

    if (!courseId) {
      $("cmd-module-select").innerHTML = `<option>Could not detect course ID</option>`;
      return;
    }

    try {
      const modules = await apiGetAll(`${origin}/api/v1/courses/${courseId}/modules`);
      $("cmd-module-select").innerHTML =
        `<option value="">— choose a module —</option>` +
        modules.map(m =>
          `<option value="${escHtml(m.id)}">${escHtml(m.name)}${m.items_count ? ` (${m.items_count})` : ""}</option>`
        ).join("");

      $("cmd-panel-body").innerHTML =
        `<p class="cmd-hint">Select a module above to see its files.</p>`;
    } catch (e) {
      $("cmd-module-select").innerHTML = `<option>Error loading modules</option>`;
      $("cmd-panel-body").innerHTML =
        `<p class="cmd-hint">❌ Error loading modules: ${escHtml(e.message)}</p>`;
    }
  }

  async function loadSelectedModuleFiles() {
    const moduleId = $("cmd-module-select").value;

    files = [];
    resetProgress();
    syncSelectionUI();

    if (!moduleId) {
      $("cmd-panel-body").innerHTML =
        `<p class="cmd-hint">Select a module above to see its files.</p>`;
      return;
    }

    $("cmd-panel-body").innerHTML =
      `<p class="cmd-hint">⏳ Loading files…</p>`;

    try {
      const items = await apiGetAll(
        `${origin}/api/v1/courses/${courseId}/modules/${moduleId}/items?include[]=content_details`
      );

      const fileItems = items.filter(item => item.type === "File");

      if (!fileItems.length) {
        $("cmd-panel-body").innerHTML =
          `<p class="cmd-hint">No file items found in this module.</p>`;
        return;
      }

      $("cmd-status-text").textContent = `Checking ${fileItems.length} file item(s)…`;

      const collected = [];

      for (const item of fileItems) {
        try {
          const info = await apiGet(`${origin}/api/v1/files/${item.content_id}`);
          const name = info.display_name || info.filename || item.title || `canvas_file_${item.content_id}`;
          const url = info.url || item.url;
          const ext = getExtensionFromName(name) || info["content-type"] || "file";

          if (url) {
            collected.push({
              name,
              url,
              kind: String(ext).replace("application/", "").toUpperCase()
            });
          }
        } catch (_) {
          // Skip inaccessible files quietly.
        }
      }

      files = collected;
      $("cmd-status-text").textContent = "";

      if (!files.length) {
        $("cmd-panel-body").innerHTML =
          `<p class="cmd-hint">No downloadable files found in this module.</p>`;
        return;
      }

      renderChecklist();

    } catch (e) {
      $("cmd-panel-body").innerHTML =
        `<p class="cmd-hint">❌ ${escHtml(e.message)}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Checklist rendering
  // ─────────────────────────────────────────────────────────────

  function renderChecklist() {
    $("cmd-panel-body").innerHTML = `
      <div id="cmd-sel-bar">
        <input type="checkbox" id="cmd-chk-all" checked>
        <label for="cmd-chk-all">Select all</label>
        <span id="cmd-sel-count">${files.length} / ${files.length}</span>
      </div>

      <ul id="cmd-file-list">
        ${files.map((f, i) => `
          <li class="cmd-file-row">
            <input type="checkbox" id="cmd-chk-${i}" class="cmd-chk" checked>
            <label for="cmd-chk-${i}">
              ${escHtml(f.name)}
              <span class="cmd-file-kind">${escHtml(f.kind || "")}</span>
            </label>
            <span class="cmd-st" id="cmd-st-${i}"></span>
          </li>
        `).join("")}
      </ul>
    `;

    $("cmd-chk-all").addEventListener("change", e => {
      document.querySelectorAll(".cmd-chk").forEach(c => {
        c.checked = e.target.checked;
      });
      syncSelectionUI();
    });

    document.querySelectorAll(".cmd-chk").forEach(c => {
      c.addEventListener("change", syncSelectionUI);
    });

    document.querySelectorAll(".cmd-file-row").forEach(row => {
      row.addEventListener("click", e => {
        if (e.target.closest("input, label")) return;
        const chk = row.querySelector("input");
        chk.checked = !chk.checked;
        syncSelectionUI();
      });
    });

    syncSelectionUI();
  }

  function syncSelectionUI() {
    const all = Array.from(document.querySelectorAll(".cmd-chk"));
    const checked = all.filter(c => c.checked);
    const n = checked.length;

    const chkAll = $("cmd-chk-all");
    if (chkAll) {
      chkAll.indeterminate = n > 0 && n < all.length;
      chkAll.checked = all.length > 0 && n === all.length;
    }

    const countEl = $("cmd-sel-count");
    if (countEl) countEl.textContent = `${n} / ${all.length}`;

    const btn = $("cmd-dl-btn");
    btn.disabled = n === 0 || isRunning;
    btn.textContent = n === 0
      ? "⬇️ Download selected"
      : `⬇️ Download ${n} file${n !== 1 ? "s" : ""}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Downloading
  // ─────────────────────────────────────────────────────────────

  async function downloadSelected() {
    if (isRunning) return;

    const selected = files
      .map((f, i) => ({ ...f, i }))
      .filter(({ i }) => {
        const chk = $(`cmd-chk-${i}`);
        return chk && chk.checked;
      });

    if (!selected.length) return;

    isRunning = true;
    $("cmd-dl-btn").disabled = true;
    $("cmd-progress-wrap").style.display = "block";
    $("cmd-progress-bar").style.width = "0%";

    let done = 0;

    for (const file of selected) {
      const st = $(`cmd-st-${file.i}`);
      if (st) st.textContent = "⬇️";

      $("cmd-status-text").textContent =
        `Downloading ${done + 1} / ${selected.length}: ${file.name}`;

      try {
        await new Promise((resolve, reject) => {
          GM_download({
            url: file.url,
            name: sanitizeFilename(file.name),
            saveAs: false,
            onload: resolve,
            onerror: reject,
            ontimeout: reject
          });
        });

        if (st) st.textContent = "✅";
      } catch (e) {
        console.error("[Canvas downloader] Download failed:", file.name, e);
        if (st) st.textContent = "❌";
      }

      done++;
      $("cmd-progress-bar").style.width =
        `${Math.round((done / selected.length) * 100)}%`;

      await sleep(700);
    }

    $("cmd-status-text").textContent =
      `Done — attempted ${done} download${done !== 1 ? "s" : ""}.`;

    isRunning = false;
    syncSelectionUI();
  }

  function resetProgress() {
    $("cmd-status-text").textContent = "";
    $("cmd-progress-wrap").style.display = "none";
    $("cmd-progress-bar").style.width = "0%";
  }
})();