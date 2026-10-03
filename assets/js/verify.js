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
  const input = document.getElementById("cert-id");
  const button = document.getElementById("verify-btn");
  const result = document.getElementById("result");
  const statusLive = document.getElementById("cert-status");

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
    const res = await fetch("../data/certificates.json", { cache: "no-cache" });
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
    const card = el("article", "card");
    const status = el("span", "result__status result__status--ok");
    status.append(svgIcon("ok"), document.createTextNode(record.status || "Valid"));

    const name = el("p", "result__name");
    const bdi = document.createElement("bdi");
    bdi.textContent = record.name;
    name.append(bdi);

    const grid = el("div", "result__grid");
    grid.append(
      field("Certificate ID", id),
      field("Issued", record.date),
      field("Issued by", "Aurelle Academy")
    );

    card.append(status, name, el("p", "result__course", record.course), grid);
    result.replaceChildren(card);
    result.hidden = false;
    statusLive.textContent = "Certificate verified.";
  }

  function renderMessage(message, label) {
    const card = el("article", "card");
    const status = el("span", "result__status result__status--bad");
    status.append(svgIcon("bad"), document.createTextNode(label || "Not found"));
    card.append(status, el("p", "result__msg", message));
    result.replaceChildren(card);
    result.hidden = false;
    statusLive.textContent = message;
  }

  async function verify(raw) {
    const normalized = normalizeId(raw);
    input.removeAttribute("aria-invalid");

    if (!isValidShape(normalized)) {
      input.setAttribute("aria-invalid", "true");
      renderMessage("That ID does not look right. It should look like AUR-XXXX-XXXX. Please check the certificate and try again.", "Check ID");
      return;
    }

    button.disabled = true;
    statusLive.textContent = "Checking certificate.";
    try {
      const data = await loadRegistry();
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
    }
  }

  input.addEventListener("input", () => {
    const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (cleaned !== input.value) input.value = cleaned;
    input.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    verify(input.value);
  });

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("id");
  if (fromUrl) {
    input.value = fromUrl.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    verify(fromUrl);
  }
})();
