import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Swup from "swup";
import SwupHeadPlugin from "@swup/head-plugin";

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __siteBooted?: boolean;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let ctx: gsap.Context | undefined;

export function killMotion() {
  ctx?.revert();
  ctx = undefined;
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

export function initMotion() {
  killMotion();
  if (prefersReducedMotion()) return;

  ctx = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>('[data-animate="scale-img"]').forEach((el) => {
      const trigger = el.parentElement ?? el;
      gsap.fromTo(
        el,
        { scale: 1.18 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    });

    gsap.utils.toArray<HTMLElement>('[data-animate="fade-up"]').forEach((el) => {
      gsap.from(el, {
        y: 36,
        opacity: 0,
        duration: 0.85,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
        },
      });
    });

    const tiles = gsap.utils.toArray<HTMLElement>('[data-animate="tile"]');
    if (tiles.length) {
      gsap.from(tiles, {
        y: 48,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.out",
      });
    }

    gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
      const end = Number(el.dataset.count);
      if (Number.isNaN(end)) return;
      const obj = { n: 0 };
      gsap.to(obj, {
        n: end,
        duration: 1.4,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
        },
        onUpdate: () => {
          el.textContent = Math.round(obj.n).toLocaleString("en-US");
        },
      });
    });
  });

  ScrollTrigger.refresh();
}

export function syncNav() {
  const raw = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]").forEach((anchor) => {
    const href = (anchor.getAttribute("href") || "/").replace(/\/$/, "") || "/";
    const active =
      href === "/" ? raw === "/" : raw === href || raw.startsWith(`${href}/`);
    if (active) anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  });
}

export function boot() {
  initMotion();
  syncNav();

  if (window.__siteBooted) return;
  window.__siteBooted = true;

  const swup = new Swup({
    containers: ["#swup"],
    animateHistoryBrowsing: true,
    plugins: [new SwupHeadPlugin()],
    ignoreVisit: (url, { el } = {}) =>
      !!el?.closest("[data-no-swup]") ||
      !!el?.hasAttribute("download") ||
      /\.(pdf|docx)(\?|$)/i.test(url),
  });

  swup.hooks.on("visit:start", () => {
    killMotion();
    document.getElementById("nav-bar")?.classList.add("hidden");
  });

  swup.hooks.on("page:view", () => {
    initMotion();
    syncNav();
  });
}
