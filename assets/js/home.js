/* home.js - Aurelle Academy High-End Luxury Interactions
   Includes: Lenis Smooth Inertia Scroll, 3D Perspective Tilt, Specular Reflection, and Admissions Loader */
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

  async function initAdmissions() {
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

  // 1. Lenis Smooth Inertia Scroll (Weight & Fluid Momentum)
  function initLenis() {
    if (typeof Lenis === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const lenis = new Lenis({
        duration: 1.25,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false
      });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    } catch (_) {}
  }

  // 2. Interactive 3D Perspective Tilt with Specular Reflection
  function init3DTilt() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = document.querySelectorAll(".cert-mockup, .hero__art-card");
    cards.forEach((card) => {
      let isHovered = false;
      card.addEventListener("mouseenter", () => { isHovered = true; });
      card.addEventListener("mousemove", (e) => {
        if (!isHovered) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        
        const tiltX = ((y / rect.height) - 0.5) * -12;
        const tiltY = ((x / rect.width) - 0.5) * 12;

        card.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
        card.style.setProperty("--mouse-x", `${xPercent.toFixed(1)}%`);
        card.style.setProperty("--mouse-y", `${yPercent.toFixed(1)}%`);
      });
      card.addEventListener("mouseleave", () => {
        isHovered = false;
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
      });
    });
  }

  // 3. Fallback Staggered Scroll Reveal
  function initScrollReveal() {
    const reveals = document.querySelectorAll("[data-reveal]");
    if (!reveals.length) return;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -40px 0px", threshold: 0.1 });
      reveals.forEach((el) => observer.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add("is-revealed"));
    }
  }

  // 4. Subtle Magnetic Physics for Action Buttons
  function initMagneticButtons() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const buttons = document.querySelectorAll(".btn--gold");
    buttons.forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.14}px, ${y * 0.14}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  // Initialize all interactive modules
  function bootstrap() {
    initAdmissions();
    initLenis();
    init3DTilt();
    initScrollReveal();
    initMagneticButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
