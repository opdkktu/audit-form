/**
 * api.js
 * ------
 * Talks to the Google Apps Script (GAS) backend, and provides the
 * shared loading-overlay / toast helpers used across all pages.
 *
 * IMPORTANT — why requests look the way they do:
 * Apps Script Web Apps return permissive CORS headers automatically,
 * but ONLY for "simple" cross-origin requests (no custom headers, and
 * for POST: Content-Type must be one of the form-safelisted types).
 * A JSON POST with "Content-Type: application/json" triggers a
 * pre-flight OPTIONS call that Apps Script cannot answer, and the
 * request fails with a CORS error in the browser.
 *
 * The fix used everywhere below: send POST bodies as plain text
 * (Content-Type: text/plain) containing a JSON string, and have the
 * Apps Script side do JSON.parse(e.postData.contents). GET requests
 * are simple by nature, so they are used for public, non-sensitive
 * reads (e.g. the daerah/klinik dropdown list).
 */

(function () {
  const CFG = window.APP_CONFIG || {};

  if (!CFG.GAS_URL || CFG.GAS_URL.indexOf("PASTE_") === 0) {
    console.warn(
      "[config] GAS_URL is not set. Copy assets/js/config.sample.js to " +
      "assets/js/config.js for local testing, or check the deploy workflow."
    );
  }

  /** GET request — used for public reads only (no secrets in the URL). */
  async function gasGet(action, params) {
    const url = new URL(CFG.GAS_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("token", CFG.SHARED_TOKEN || "");
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error("Rangkaian gagal (" + res.status + ")");
    return res.json();
  }

  /** POST request (text/plain trick) — used for writes and PIN-gated reads. */
  async function gasPost(action, payload) {
    const body = JSON.stringify(Object.assign({ action, token: CFG.SHARED_TOKEN || "" }, payload || {}));
    const res = await fetch(CFG.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });
    if (!res.ok) throw new Error("Rangkaian gagal (" + res.status + ")");
    return res.json();
  }

  window.Api = { gasGet, gasPost };
  /* ---------------------------------------------------------------- */
  /* Loading overlay                                                  */
  /* ---------------------------------------------------------------- */

  let overlayEl, overlayTextEl, overlayCount = 0;

  function ensureOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.className = "loading-overlay";
    overlayEl.innerHTML =
      '<div class="loading-spinner" role="status" aria-label="Memuatkan"></div>' +
      '<div class="loading-text"></div>';
    document.body.appendChild(overlayEl);
    overlayTextEl = overlayEl.querySelector(".loading-text");
  }

  function showLoading(text) {
    ensureOverlay();
    overlayTextEl.textContent = text || "Memuatkan...";
    overlayCount++;
    overlayEl.classList.add("is-visible");
  }

  function hideLoading() {
    if (!overlayEl) return;
    overlayCount = Math.max(0, overlayCount - 1);
    if (overlayCount === 0) overlayEl.classList.remove("is-visible");
  }

  /** Wrap an async function call with the overlay, always hiding it after. */
  async function withLoading(text, fn) {
    showLoading(text);
    try {
      return await fn();
    } finally {
      hideLoading();
    }
  }

  window.Loading = { show: showLoading, hide: hideLoading, withLoading };

  /* ---------------------------------------------------------------- */
  /* Toast                                                             */
  /* ---------------------------------------------------------------- */

  let toastEl, toastTimer;

  function toast(message, kind) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.style.background = kind === "error" ? "var(--color-danger)" : "var(--color-primary-dark)";
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 3200);
  }

  window.toast = toast;

  /* ---------------------------------------------------------------- */
  /* Lazy script loader (used to defer Chart.js / jsPDF until needed) */
  /* ---------------------------------------------------------------- */

  const loadedScripts = {};
  function loadScript(src) {
    if (loadedScripts[src]) return loadedScripts[src];
    loadedScripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Gagal memuatkan " + src));
      document.head.appendChild(s);
    });
    return loadedScripts[src];
  }
  window.loadScript = loadScript;
})();
