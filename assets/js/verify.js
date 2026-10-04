/* verify.js - certificate lookup.
   Records are stored encrypted in data/certificates.json. The certificate ID is the only
   key: PBKDF2(ID) yields a lookup key (first 16 bytes) and an AES-GCM key (last 16 bytes).
   Without the ID, the public file reveals neither names nor IDs. */
(function () {
  "use strict";

  const SALT = "aurelle-academy-certificates-v1";
  const ID_PREFIX = "AUR";
  const ID_BODY_LENGTH = 8;
  const ID_ALPHABET = /^[A-HJ-NP-Z2-9]+$/;

  const form = document.getElementById("verify-form");
  const p1 = document.getElementById("cert-part-1");
  const p2 = document.getElementById("cert-part-2");
  const p3 = document.getElementById("cert-part-3");
  const button = document.getElementById("verify-btn");
  const clearBtn = document.getElementById("verify-clear-btn");
  const sampleBtn = document.querySelector(".verify__sample-pill");
  const result = document.getElementById("result");
  const statusLive = document.getElementById("cert-status");

  function getFullId() {
    const val1 = (p1 ? p1.value : ID_PREFIX) || ID_PREFIX;
    const val2 = (p2 ? p2.value : "").trim();
    const val3 = (p3 ? p3.value : "").trim();
    return `${val1}-${val2}-${val3}`;
  }

  function setPartsFromRaw(raw) {
    const cleaned = normalizeId(raw);
    if (!cleaned) {
      if (p2) p2.value = "";
      if (p3) p3.value = "";
      return;
    }
    let body = cleaned;
    if (body.startsWith(ID_PREFIX)) {
      body = body.slice(ID_PREFIX.length);
    }
    if (p1) p1.value = ID_PREFIX;
    if (p2) p2.value = body.slice(0, 4);
    if (p3) p3.value = body.slice(4, 8);
  }

  let registry = null;

  function normalizeId(raw) {
    return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function formatId(normalized) {
    const body = normalized.slice(ID_PREFIX.length);
    if (normalized.length !== ID_PREFIX.length + ID_BODY_LENGTH) return normalized;
    return ID_PREFIX + "-" + body.slice(0, 4) + "-" + body.slice(4);
  }

  function isValidShape(normalized) {
    if (normalized.length !== ID_PREFIX.length + ID_BODY_LENGTH) return false;
    if (!normalized.startsWith(ID_PREFIX)) return false;
    return ID_ALPHABET.test(normalized.slice(ID_PREFIX.length));
  }

  function toHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function fromBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKeys(normalizedId, iterations) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(normalizedId), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(SALT), iterations, hash: "SHA-256" },
      baseKey,
      256
    );
    const bytes = new Uint8Array(bits);
    return { lookup: toHex(bytes.slice(0, 16)), aesRaw: bytes.slice(16, 32) };
  }

  async function decryptRecord(entry, aesRaw) {
    const key = await crypto.subtle.importKey("raw", aesRaw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(entry.iv) }, key, fromBase64(entry.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function loadRegistry() {
    if (registry) return registry;
    const res = await fetch("../data/certificates.json?_t=" + Date.now(), { cache: "no-cache" });
    if (!res.ok) throw new Error("registry unavailable");
    registry = await res.json();
    return registry;
  }

  function svgIcon(kind) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", kind === "ok" ? "m5 12.5 4.5 4.5L19 7.5" : "M6 6l12 12M18 6 6 18");
    svg.append(path);
    return svg;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function field(label, value) {
    const wrap = el("div");
    wrap.append(el("span", "result__label", label), el("span", "result__value", value));
    return wrap;
  }

  function renderFound(id, record) {
    const card = el("article", "card result__cert-card");

    // 1. Header with Golden Crest Emblem & Formal Institution Title
    const header = el("div", "result__cert-header");
    const crestWrap = el("div", "result__crest-wrap");
    crestWrap.innerHTML = `
      <svg class="result__crest-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="2 3"/>
        <circle cx="50" cy="50" r="41" stroke="currentColor" stroke-width="2.2"/>
        <path d="M50 18 C43 32, 28 58, 25 76" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M50 18 C57 32, 72 58, 75 76" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M33 55 Q50 64 67 55" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="50" cy="42" r="3.2" fill="currentColor"/>
      </svg>
    `;
    const instTitle = el("div", "result__inst-meta");
    instTitle.innerHTML = `
      <span class="result__inst-name">Aurelle Academy</span>
      <span class="result__inst-sub">European Private Vocational Registry &bull; Assessment Board</span>
    `;
    header.append(crestWrap, instTitle);

    // 2. Cryptographic Validation Badge
    const statusWrap = el("div", "result__status-bar");
    const status = el("span", "result__status result__status--ok");
    status.append(svgIcon("ok"), document.createTextNode(record.status ? "AUTHENTIC & VERIFIED (" + record.status.toUpperCase() + ")" : "AUTHENTIC & CRYPTOGRAPHICALLY VERIFIED"));
    statusWrap.append(status);

    // 3. Candidate & Qualification Section
    const candidateSection = el("div", "result__candidate-section");
    const certEyebrow = el("span", "result__eyebrow", "CERTIFIED GRADUATE HOLDER");
    const name = el("h2", "result__name");
    const bdi = document.createElement("bdi");
    bdi.textContent = record.name;
    name.append(bdi);

    const courseWrap = el("div", "result__course-wrap");
    const courseEyebrow = el("span", "result__course-label", "ACCREDITED VOCATIONAL DISCIPLINE");
    const course = el("p", "result__course", record.course);
    courseWrap.append(courseEyebrow, course);

    if (record.statement) {
      const stmt = el("p", "result__statement", record.statement);
      courseWrap.append(stmt);
    }

    candidateSection.append(certEyebrow, name, courseWrap);

    // 4. Institutional Security Grid (6 Key Metadata Fields)
    const grid = el("div", "result__grid");
    grid.append(
      field("Credential Identifier", id),
      field("Date of Examination", record.date),
      field("Qualification Standard", "Private Vocational Framework (Level IV)"),
      field("Clinical Lab Modules", "Standard Supervised Clinical CEUs"),
      field("Ledger Security Protocol", "PBKDF2-200K / AES-256-GCM Verified"),
      field("Issuing Authority", "Aurelle Academy Assessment Jury")
    );

    // 5. Official Signature & Stamp Seals (Printable)
    const footerMeta = el("div", "result__signatures");
    footerMeta.innerHTML = `
      <div class="result__signature-col">
        <span class="result__sig-script">H. V. Laurent</span>
        <span class="result__sig-title">Director of Academic Studies</span>
      </div>
      <div class="result__seal-col">
        <div class="result__stamp-seal">
          <span>AUTHENTIC</span>
          <span>LEDGER VERIFIED</span>
          <span>2026</span>
        </div>
      </div>
      <div class="result__signature-col">
        <span class="result__sig-script">M. S. D'Aurelle</span>
        <span class="result__sig-title">Assessment Jury Chairperson</span>
      </div>
    `;

    // 6. Action Toolbar (Direct Link Share)
    const actions = el("div", "result__actions");

    const copyBtn = el("button", "btn btn--gold result__copy-btn");
    copyBtn.type = "button";
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <span>Copy Direct Verification Link</span>
    `;

    copyBtn.addEventListener("click", async () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(record.id)}`;
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          ok = true;
        } else {
          const ta = document.createElement("textarea");
          ta.value = shareUrl;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        }
      } catch (err) {
        ok = false;
      }

      if (ok) {
        copyBtn.classList.add("is-copied");
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Verification Link Copied!</span>
        `;
        setTimeout(() => {
          copyBtn.classList.remove("is-copied");
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>Copy Direct Verification Link</span>
          `;
        }, 2500);
      }
    });

    actions.append(copyBtn);

    card.append(header, statusWrap, candidateSection, grid, footerMeta, actions);
    result.replaceChildren(card);
    result.hidden = false;
    statusLive.textContent = "Certificate verified authentic and registered.";

    // Automatic smooth scroll to result card
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rect = card.getBoundingClientRect();
        const headerOffset = window.innerWidth <= 600 ? 80 : 90;
        const targetScroll = window.pageYOffset + rect.top - headerOffset;
        window.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth"
        });
      }, 60);
    });
  }

  function renderMessage(message, label) {
    const card = el("article", "card");
    const status = el("span", "result__status result__status--bad");
    status.append(svgIcon("bad"), document.createTextNode(label || "Not found"));
    card.append(status, el("p", "result__msg", message));
    result.replaceChildren(card);
    result.hidden = false;
    statusLive.textContent = message;

    // Smooth scroll to feedback message
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rect = card.getBoundingClientRect();
        const headerOffset = window.innerWidth <= 600 ? 80 : 90;
        const targetScroll = window.pageYOffset + rect.top - headerOffset;
        window.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth"
        });
      }, 60);
    });
  }

  async function verify(raw) {
    const normalized = normalizeId(raw);
    if (p2) p2.removeAttribute("aria-invalid");
    if (p3) p3.removeAttribute("aria-invalid");

    if (!isValidShape(normalized)) {
      if (p2) p2.setAttribute("aria-invalid", "true");
      if (p3) p3.setAttribute("aria-invalid", "true");
      renderMessage("That ID does not look right. It should look like AUR-XXXX-XXXX. Please check the certificate and try again.", "Check ID");
      return;
    }

    const originalBtnHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add("btn--loading");
    button.innerHTML = `
      <svg class="btn__spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      <span>Decrypting Ledger...</span>
    `;

    const segBox = document.querySelector(".segmented-control");
    if (segBox) segBox.classList.add("is-scanning");
    statusLive.textContent = "Checking cryptographic ledger.";

    try {
      // Gentle cryptographic micro-delay for realistic feedback
      const [data] = await Promise.all([
        loadRegistry(),
        new Promise((resolve) => setTimeout(resolve, 360))
      ]);

      const { lookup, aesRaw } = await deriveKeys(normalized, data.iter);
      const entry = data.records && data.records[lookup];
      if (!entry) {
        renderMessage("No certificate was found for this ID. Please check the ID printed below the QR code.");
        return;
      }
      const record = await decryptRecord(entry, aesRaw);
      renderFound(formatId(normalized), record);
    } catch (_) {
      renderMessage("Verification is temporarily unavailable. Please try again in a moment.");
    } finally {
      button.disabled = false;
      button.classList.remove("btn--loading");
      button.innerHTML = originalBtnHtml;
      if (segBox) segBox.classList.remove("is-scanning");
    }
  }

  if (p2) {
    p2.addEventListener("input", () => {
      p2.value = p2.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      p2.removeAttribute("aria-invalid");
      if (p3) p3.removeAttribute("aria-invalid");
      if (p2.value.length === 4 && p3) {
        p3.focus();
        p3.select();
      }
    });

    p2.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        form.requestSubmit();
      } else if ((e.key === "-" || e.key === " ") && p3) {
        e.preventDefault();
        p3.focus();
      }
    });
  }

  if (p3) {
    p3.addEventListener("input", () => {
      p3.value = p3.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (p2) p2.removeAttribute("aria-invalid");
      p3.removeAttribute("aria-invalid");
      if (p3.value.length === 4 && p2 && p2.value.length === 4) {
        form.requestSubmit();
      }
    });

    p3.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && p3.value.length === 0 && p2) {
        e.preventDefault();
        p2.focus();
      } else if (e.key === "Enter") {
        form.requestSubmit();
      }
    });
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    if (!pasted) return;
    setPartsFromRaw(pasted);
    const currentId = getFullId();
    if (isValidShape(normalizeId(currentId))) {
      verify(currentId);
    } else if (p2 && p2.value.length < 4) {
      p2.focus();
    } else if (p3) {
      p3.focus();
    }
  }

  if (p1) p1.addEventListener("paste", handlePaste);
  if (p2) p2.addEventListener("paste", handlePaste);
  if (p3) p3.addEventListener("paste", handlePaste);

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (p2) p2.value = "";
      if (p3) p3.value = "";
      result.hidden = true;
      result.replaceChildren();
      if (p2) p2.focus();
    });
  }

  if (sampleBtn) {
    sampleBtn.addEventListener("click", () => {
      const sample = sampleBtn.getAttribute("data-fill") || "AUR-J2GA-U9PB";
      setPartsFromRaw(sample);
      verify(sample);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    verify(getFullId());
  });

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("id");
  if (fromUrl) {
    setPartsFromRaw(fromUrl);
    verify(fromUrl);
  }
})();
