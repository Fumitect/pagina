/* =========================================================
   app.js — Funcionalidad de la página.
   Todo arranca desde un callback registrado en el evento
   DOMContentLoaded: cuando el HTML terminó de cargar, se
   ejecuta init() y ésta inicializa cada módulo.
   ========================================================= */

"use strict";

const CONFIG = {
  whatsappNumber: "528131224125",   // 52 (México) + 81 3122 4125, sin espacios ni "+"
  scrolledOffset: 24,               // px bajados antes de darle fondo sólido al menú flotante
  splash: {
    target: ".header .logo__icon",  // a qué logo viaja (p. ej. ".scope__logo" para el del hero)
    introMs: 700,                   // aparición del logo en grande
    holdMs: 700,                    // tiempo quieto en pantalla completa
    flyMs: 900                      // viaje hasta el menú
  }
};

/* ---------- Utilidades ---------- */
const $  = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/* ---------- 1. Menú flotante ---------- */
function initHeader() {
  const header = $("#header");
  const toggle = $("#menuToggle");
  const nav    = $("#nav");
  if (!header || !toggle || !nav) return;

  let ticking = false;

  // Callback del scroll: se agrupa con requestAnimationFrame para no saturar
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("header--scrolled", y > CONFIG.scrolledOffset);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
  onScroll(); // estado correcto si la página carga ya desplazada

  const setOpen = (open) => {
    header.classList.toggle("header--open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    document.body.classList.toggle("no-scroll", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(!header.classList.contains("header--open"));
  });

  // Cerrar al elegir una opción, al presionar Esc o al pasar a escritorio
  $$("a", nav).forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  window.matchMedia("(min-width: 64em)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
}

/* ---------- 2. Resaltar la sección activa en el menú ---------- */
function initActiveLink() {
  const links = $$(".nav__link");
  const sections = links
    .map((link) => $(link.getAttribute("href")))
    .filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = `#${entry.target.id}`;
      links.forEach((link) =>
        link.classList.toggle("nav__link--active", link.getAttribute("href") === id)
      );
    });
  }, { rootMargin: "-45% 0px -50% 0px" });

  sections.forEach((section) => observer.observe(section));
}

/* ---------- 3. FAQ (acordeón, una abierta a la vez) ---------- */
function initFaq() {
  const items = $$(".faq__item");

  const close = (item) => {
    const answer = $(".faq__answer", item);
    answer.style.height = `${answer.scrollHeight}px`;
    requestAnimationFrame(() => { answer.style.height = "0px"; });
    item.classList.remove("faq__item--open");
    $(".faq__question", item).setAttribute("aria-expanded", "false");
  };

  const open = (item) => {
    const answer = $(".faq__answer", item);
    answer.style.height = `${answer.scrollHeight}px`;
    item.classList.add("faq__item--open");
    $(".faq__question", item).setAttribute("aria-expanded", "true");
  };

  items.forEach((item) => {
    const answer = $(".faq__answer", item);
    // Al terminar de abrir, altura "auto" para que se adapte si cambia el ancho
    answer.addEventListener("transitionend", () => {
      if (item.classList.contains("faq__item--open")) answer.style.height = "auto";
    });

    $(".faq__question", item).addEventListener("click", () => {
      const isOpen = item.classList.contains("faq__item--open");
      items.filter((other) => other !== item && other.classList.contains("faq__item--open")).forEach(close);
      isOpen ? close(item) : open(item);
    });
  });
}

/* ---------- 4. Galería con lightbox (clic = imagen grande) ---------- */
function initGallery() {
  const lightbox = $("#lightbox");
  const stage    = $("#lightboxStage");
  const content  = $("#lightboxContent");
  const caption  = $("#lightboxCaption");
  const count    = $("#lightboxCount");
  const closeBtn = $("#lightboxClose");
  const prevBtn  = $("#lightboxPrev");
  const nextBtn  = $("#lightboxNext");
  const items    = $$(".gallery__item");
  if (!lightbox || !items.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SLIDE = { duration: 450, easing: "cubic-bezier(.65,0,.35,1)" };
  let index = 0;
  let animating = false;
  let lastFocus = null;

  // Copia de la foto de la galería para mostrarla en grande
  const mediaOf = (i) => {
    const media = items[i].querySelector("img, .gallery__placeholder").cloneNode(true);
    media.removeAttribute("loading");
    return media;
  };

  const updateText = () => {
    caption.textContent = items[index].dataset.caption || "";
    count.textContent = `${index + 1} / ${items.length}`;
  };

  // Precarga las fotos vecinas para que el cambio no se trabe
  const preload = () => {
    [-1, 1].forEach((d) => {
      const img = items[(index + d + items.length) % items.length].querySelector("img");
      if (img && img.loading === "lazy") img.loading = "eager";
    });
  };

  const show = (i) => {
    index = i;
    lastFocus = items[i];
    content.replaceChildren(mediaOf(i));
    updateText();
    preload();
    const single = items.length < 2;
    prevBtn.hidden = single;
    nextBtn.hidden = single;
    lightbox.hidden = false;
    document.body.classList.add("no-scroll");
    closeBtn.focus();
  };

  const hide = () => {
    lightbox.getAnimations({ subtree: true }).forEach((a) => a.finish());
    lightbox.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  };

  // dir = +1 (flecha derecha): la foto actual sale hacia la derecha y la siguiente entra por la izquierda.
  // dir = -1 (flecha izquierda): al revés, y muestra la anterior.
  const go = (dir) => {
    if (animating || items.length < 2 || lightbox.hidden) return;
    const oldMedia = content.firstElementChild;
    index = (index + dir + items.length) % items.length;
    const newMedia = mediaOf(index);
    content.appendChild(newMedia);
    updateText();
    preload();
    lastFocus = items[index];

    if (reduced || !newMedia.animate) {
      oldMedia.remove();
      return;
    }
    animating = true;
    const exit = oldMedia.animate(
      [{ transform: "translateX(0) scale(1)", opacity: 1 },
       { transform: `translateX(${dir * 115}%) scale(0.92)`, opacity: 0 }],
      { ...SLIDE, fill: "forwards" });
    newMedia.animate(
      [{ transform: `translateX(${-dir * 115}%) scale(0.92)`, opacity: 0 },
       { transform: "translateX(0) scale(1)", opacity: 1 }], SLIDE);
    exit.finished.then(() => {
      oldMedia.remove();
      animating = false;
    });
  };

  items.forEach((item, i) => item.addEventListener("click", () => show(i)));
  closeBtn.addEventListener("click", hide);
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  // Clic fuera de la foto cierra
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target === stage) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  });

  // Deslizar con el dedo: la foto sigue la dirección del dedo
  let startX = null;
  let startY = null;
  content.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  content.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? 1 : -1);
    startX = null;
  });
}

/* ---------- 5. Contadores animados del hero ---------- */
function initCounters() {
  const counters = $$("[data-count]");
  const format = new Intl.NumberFormat("es-MX");

  const animate = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const duration = 1500;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      el.textContent = format.format(Math.round(target * eased)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    counters.forEach((el) => { el.textContent = format.format(Number(el.dataset.count)) + (el.dataset.suffix || ""); });
    return;
  }

  const start = () => {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => observer.observe(el));
  };

  // Si la pantalla de inicio sigue activa, espera a que termine para que se vea el conteo
  if (document.documentElement.classList.contains("splash-active")) {
    document.addEventListener("splash:done", start, { once: true });
  } else {
    start();
  }
}

/* ---------- 6. Aparición suave de elementos al hacer scroll ---------- */
function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  const targets = $$(".pest, .step, .service, .benefit, .gallery__item, .faq__item, .chip");

  // Al terminar de aparecer se quitan las clases, para que el elemento
  // recupere sus propias transiciones de hover (colores, sombras, etc.)
  const cleanUp = (el) => {
    el.classList.remove("reveal", "reveal--visible");
    el.style.transitionDelay = "";
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add("reveal--visible");
        el.addEventListener("transitionend", () => cleanUp(el), { once: true });
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach((el, i) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("reveal");
    el.style.transitionDelay = `${(i % 4) * 80}ms`;
    observer.observe(el);
  });
}

/* ---------- 7. Formulario de contacto -> WhatsApp ---------- */
function initContactForm() {
  const form   = $("#contactForm");
  const status = $("#formStatus");
  if (!form) return;

  const rules = {
    nombre:   (v) => v.trim().length >= 2 || "Escribe tu nombre.",
    telefono: (v) => /^\d{10}$/.test(v.replace(/\D/g, "")) || "El teléfono debe tener 10 dígitos.",
    correo:   (v) => v.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Correo no válido.",
    servicio: (v) => v !== "" || "Selecciona un tipo de servicio.",
    municipio: (v) => v !== "" || "Selecciona tu municipio.",
    // Solo es obligatorio cuando se eligió "Otro"
    municipioOtro: (v) => form.elements.municipio.value !== "Otro" || v.trim().length >= 3 || "Escribe tu municipio."
  };

  // Municipio: llena las opciones con la lista de Cobertura y muestra el campo "Otro"
  const municipioSelect = form.elements.municipio;
  const otroGroup = $("#municipioOtroGroup");
  const otroOption = municipioSelect.querySelector('option[value="Otro"]');
  $$("#cobertura .chip").forEach((chip) => {
    const nombre = chip.textContent.trim();
    municipioSelect.insertBefore(new Option(nombre, nombre), otroOption);
  });

  const toggleOtro = () => {
    const show = municipioSelect.value === "Otro";
    otroGroup.hidden = !show;
    if (!show) {
      form.elements.municipioOtro.value = "";
      otroGroup.classList.remove("form__group--error");
      $(".form__error", otroGroup).textContent = "";
    }
    return show;
  };
  municipioSelect.addEventListener("change", () => {
    if (toggleOtro()) form.elements.municipioOtro.focus();
  });

  const validateField = (name) => {
    const field = form.elements[name];
    const group = field.closest(".form__group");
    const result = rules[name](field.value);
    const ok = result === true;
    group.classList.toggle("form__group--error", !ok);
    field.setAttribute("aria-invalid", String(!ok));
    $(".form__error", group).textContent = ok ? "" : result;
    return ok;
  };

  // Validación en vivo después de que el usuario sale del campo
  Object.keys(rules).forEach((name) => {
    const field = form.elements[name];
    field.addEventListener("blur", () => validateField(name));
    field.addEventListener("input", () => {
      if (field.closest(".form__group").classList.contains("form__group--error")) validateField(name);
    });
  });

  // Los enlaces "Cotizar →" de Servicios preseleccionan el tipo de servicio
  $$("[data-service]").forEach((link) => {
    link.addEventListener("click", () => {
      form.elements.servicio.value = link.dataset.service;
      validateField("servicio");
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const results = Object.keys(rules).map(validateField);
    const firstInvalid = Object.keys(rules).find((_, i) => !results[i]);

    if (firstInvalid) {
      status.textContent = "Revisa los campos marcados.";
      status.className = "form__status form__status--error";
      form.elements[firstInvalid].focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const lines = [
      "Hola FUMITECT, quiero una cotización:",
      `• Nombre: ${data.nombre.trim()}`,
      `• Teléfono: ${data.telefono.trim()}`,
      data.correo   && `• Correo: ${data.correo.trim()}`,
      `• Servicio: ${data.servicio}`,
      `• Municipio: ${data.municipio === "Otro" ? data.municipioOtro.trim() : data.municipio}`,
      data.interes  && `• Plaga: ${data.interes}`,
      data.detalles && `• Detalles: ${data.detalles.trim()}`
    ].filter(Boolean);

    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");

    status.textContent = "¡Listo! Te abrimos WhatsApp con tu mensaje.";
    status.className = "form__status form__status--ok";
    form.reset();
    toggleOtro();
  });
}

/* ---------- 8. Año automático en el footer ---------- */
function initYear() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

/* ---------- 0. Pantalla de inicio: logo grande que viaja al menú ---------- */
// Técnica FLIP: se mide dónde está el logo grande (First) y dónde está el del
// menú (Last), y se anima con transform (translate + scale) entre ambos.
// Usa la Web Animations API (element.animate), nativa del navegador.
function initSplash() {
  const root   = document.documentElement;
  const splash = $("#splash");
  const logo   = $("#splashLogo");
  const brand  = $("#splashBrand");
  const bg     = $("#splashBg");
  const target = $(CONFIG.splash.target);
  const { introMs, holdMs, flyMs } = CONFIG.splash;

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    document.dispatchEvent(new Event("splash:reveal"));
  };

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    reveal();
    root.classList.remove("splash-active");
    if (splash) splash.remove();
    document.dispatchEvent(new Event("splash:done"));   // avisa a los contadores del hero
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!splash || !logo || !target || reduced || !logo.animate) {
    finish();
    return;
  }

  // Tocar la pantalla o presionar una tecla salta la animación
  let skipped = false;
  const skip = () => {
    if (skipped) return;
    skipped = true;
    splash.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(finish);
  };
  splash.addEventListener("click", skip);
  window.addEventListener("keydown", skip, { once: true });

  const ready = (img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  const wait  = (ms) => new Promise((r) => setTimeout(r, ms));
  const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();

  Promise.all([ready(logo), ready(target), fontsReady])
    .then(() => {
      if (skipped) return;
      // 1. Aparece: crece un poco y se enfoca
      const intro = { duration: introMs, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" };
      logo.animate(
        [{ opacity: 0, transform: "scale(0.85)", transformOrigin: "50% 50%" },
         { opacity: 1, transform: "scale(1)",    transformOrigin: "50% 50%" }], intro);
      brand.animate(
        [{ opacity: 0, transform: "translateY(1rem)" }, { opacity: 1, transform: "none" }],
        { ...intro, delay: introMs * 0.4 });
      return wait(introMs + holdMs);
    })
    .then(() => {
      if (skipped) return;
      // 2. Viaja: se mide origen y destino justo ahora (por si cambió el tamaño de la ventana)
      const from = logo.getBoundingClientRect();
      const to   = target.getBoundingClientRect();
      const dx = to.left - from.left;
      const dy = to.top  - from.top;
      const s  = to.width / from.width;
      const fly = { duration: flyMs, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" };

      logo.getAnimations().forEach((a) => a.cancel());
      logo.style.opacity = "1";
      const move = logo.animate(
        [{ transform: "translate(0, 0) scale(1)" },
         { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], fly);
      brand.animate([{ opacity: 1 }, { opacity: 0 }], { duration: flyMs * 0.35, fill: "forwards" });
      // El fondo se desvanece mientras el logo viaja, dejando ver la página
      bg.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: flyMs * 0.8, delay: flyMs * 0.2, easing: "ease-out", fill: "forwards" });
      splash.style.pointerEvents = "none";
      reveal();                      // la portada empieza a entrar mientras el logo viaja
      return move.finished;
    })
    .then(() => { if (!skipped) finish(); })
    .catch(finish);
}

/* ---------- 3. Método: los íconos se dibujan al aparecer, uno tras otro ---------- */
function initMethod() {
  const steps = $$(".step");
  if (!steps.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    steps.forEach((s) => s.classList.add("step--drawn"));
    return;
  }
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const i = steps.indexOf(entry.target);
      setTimeout(() => entry.target.classList.add("step--drawn"), i * 250);  // 01 → 02 → 03
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  steps.forEach((s) => observer.observe(s));
}

/* ---------- 4. Plagas: en pantallas táctiles se "eliminan" al aparecer ---------- */
function initPests() {
  const canHover = window.matchMedia("(hover: hover)").matches;
  if (canHover || !("IntersectionObserver" in window)) return;   // en computadora lo hace el :hover
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("pest--hit");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.7 });
  $$(".pest").forEach((pest) => observer.observe(pest));
}

/* ---------- 5. Portada: el título entra palabra por palabra ---------- */
function initHeroIntro() {
  const hero  = $(".hero");
  const title = $(".hero__title");
  if (!hero || !title) return;

  // Envuelve cada palabra en <span class="word"><span class="word__inner">
  let i = 0;
  const wrapWords = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const word = document.createElement("span");
          word.className = "word";
          const inner = document.createElement("span");
          inner.className = "word__inner";
          inner.style.setProperty("--i", i++);
          inner.textContent = part;
          word.appendChild(inner);
          frag.appendChild(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
        wrapWords(child);
      }
    });
  };
  title.setAttribute("aria-label", title.innerText.replace(/\s+/g, " ").trim());
  wrapWords(title);

  const show = () => requestAnimationFrame(() => hero.classList.add("hero--ready"));
  if (document.documentElement.classList.contains("splash-active")) {
    document.addEventListener("splash:reveal", show, { once: true });
  } else {
    show();
  }
}

/* ---------- Arranque ---------- */
function init() {
  initHeroIntro();      // antes del splash: prepara el título para cuando termine
  initSplash();
  initMethod();
  initPests();
  initHeader();
  initActiveLink();
  initFaq();
  initGallery();
  initCounters();
  initReveal();
  initContactForm();
  initYear();
}

// Callback: se ejecuta en cuanto el HTML está listo
document.addEventListener("DOMContentLoaded", init);
