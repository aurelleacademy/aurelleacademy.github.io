/* home.js - fills the contact section from data/site.json (hidden while empty). */
(function () {
  "use strict";

  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.6-4.6A8.5 8.5 0 1 1 8 19.6L3 21Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
  };

  function buildLinks(site) {
    const links = [];
    const ig = String(site.instagram || "").trim().replace(/^@/, "");
    const wa = String(site.whatsapp || "").replace(/\D/g, "");
    const mail = String(site.email || "").trim();

    if (ig) links.push({ key: "instagram", label: "Instagram", href: "https://www.instagram.com/" + encodeURIComponent(ig) + "/" });
    if (wa) links.push({ key: "whatsapp", label: "WhatsApp", href: "https://wa.me/" + wa });
    if (mail) links.push({ key: "email", label: "Email", href: "mailto:" + mail });
    return links;
  }

  async function init() {
    const section = document.querySelector("[data-contact-section]");
    const list = document.querySelector("[data-contact-list]");
    const navLink = document.querySelector("[data-contact-link]");
    if (!section || !list) return;

    let site = {};
    try {
      const res = await fetch("data/site.json", { cache: "no-cache" });
      if (res.ok) site = await res.json();
    } catch (_) {
      return;
    }

    const links = buildLinks(site);
    if (!links.length) return;

    links.forEach((item) => {
      const a = document.createElement("a");
      a.className = "btn btn--ghost";
      a.href = item.href;
      a.rel = "noopener noreferrer";
      if (item.key !== "email") a.target = "_blank";
      a.innerHTML = ICONS[item.key];
      a.append(document.createTextNode(item.label));
      list.append(a);
    });

    section.hidden = false;
    if (navLink) navLink.hidden = false;
  }

  init();
})();
