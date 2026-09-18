/* =============================================================
   app.js — Interface (partagé par toutes les pages)
   ============================================================= */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ---------------------------------------------------------
     1. Voile de chargement
     --------------------------------------------------------- */
  (function veil() {
    var el = $(".veil");
    if (!el) { document.body.classList.add("is-ready"); return; }

    var bar = $(".veil__line i", el);
    var num = $(".veil__num", el);
    var seen = false;
    try { seen = sessionStorage.getItem("nd-seen") === "1"; } catch (e) {}

    document.body.classList.add("is-locked");

    function done() {
      el.classList.add("is-out");
      document.body.classList.remove("is-locked");
      document.body.classList.add("is-ready");
      try { sessionStorage.setItem("nd-seen", "1"); } catch (e) {}
      setTimeout(function () { el.remove(); }, 800);
    }

    // Déjà visité dans cette session : on ne rejoue pas le compteur.
    if (seen || reduced) { setTimeout(done, 220); return; }

    var p = 0, loaded = false, finished = false;
    window.addEventListener("load", function () { loaded = true; });

    var t = setInterval(function () {
      var cap = loaded ? 100 : 88;
      p += Math.max(0.8, (cap - p) * 0.08);
      if (p > cap) p = cap;
      if (bar) bar.style.transform = "scaleX(" + (p / 100) + ")";
      if (num) num.textContent = String(Math.round(p)).padStart(3, "0");
      if (p >= 99.5 && !finished) { finished = true; clearInterval(t); setTimeout(done, 340); }
    }, 32);

    setTimeout(function () { if (!finished) { finished = true; clearInterval(t); done(); } }, 4500);
  })();

  /* ---------------------------------------------------------
     2. Curseur
     --------------------------------------------------------- */
  if (!coarse && !reduced) {
    var cur = document.createElement("div");
    cur.className = "cur";
    document.body.appendChild(cur);

    var cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    document.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function run() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cur.style.transform = "translate(" + cx + "px," + cy + "px)";
      requestAnimationFrame(run);
    })();

    var BIG = "a, button, .row, .acc__h, input, textarea, [data-big]";
    document.addEventListener("pointerover", function (e) {
      if (e.target.closest && e.target.closest('[data-scene="gallery"]')) { cur.classList.add("is-drag"); return; }
      if (e.target.closest && e.target.closest(BIG)) cur.classList.add("is-lg");
    });
    document.addEventListener("pointerout", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest('[data-scene="gallery"]')) cur.classList.remove("is-drag");
      if (e.target.closest(BIG)) cur.classList.remove("is-lg");
    });
  }

  /* ---------------------------------------------------------
     3. Navigation
     --------------------------------------------------------- */
  (function nav() {
    var nav = $(".nav");
    var sheet = $(".sheet");
    var burger = $(".burger");
    var bar = $(".progress");
    var up = $(".up");
    var last = 0;

    // Lien actif d'après l'URL
    var here = location.pathname.split("/").pop() || "index.html";
    $$(".menu a, .sheet a").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("#")[0];
      if (href && href === here) a.classList.add("on");
    });

    function onScroll() {
      var y = window.scrollY;
      if (nav) {
        nav.classList.toggle("is-stuck", y > 30);
        if (!document.body.classList.contains("menu-open")) {
          nav.classList.toggle("is-up", y > last && y > 400);
        }
      }
      last = y;
      var max = document.body.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
      if (up) up.classList.toggle("on", y > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (burger && sheet) {
      burger.addEventListener("click", function () {
        var open = !sheet.classList.contains("is-open");
        sheet.classList.toggle("is-open", open);
        document.body.classList.toggle("menu-open", open);
        document.body.classList.toggle("is-locked", open);
      });
    }

    if (up) up.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });

    // Ancres internes
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (!id || id === "#") return;
        var t = $(id);
        if (!t) return;
        e.preventDefault();
        if (sheet) { sheet.classList.remove("is-open"); document.body.classList.remove("menu-open", "is-locked"); }
        window.scrollTo({
          top: t.getBoundingClientRect().top + window.scrollY - 80,
          behavior: reduced ? "auto" : "smooth"
        });
      });
    });
  })();

  /* ---------------------------------------------------------
     4. Transition entre pages
     --------------------------------------------------------- */
  (function swipe() {
    if (reduced) return;
    var el = document.createElement("div");
    el.className = "swipe";
    document.body.appendChild(el);

    $$('a[href$=".html"]').forEach(function (a) {
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        var href = a.getAttribute("href");
        if (!href || href.indexOf("http") === 0) return;
        e.preventDefault();
        el.classList.add("is-in");
        setTimeout(function () { location.href = href; }, 620);
      });
    });

    // Retour arrière depuis le cache : on nettoie le voile
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted) el.classList.remove("is-in");
    });
  })();

  /* ---------------------------------------------------------
     5. Apparitions & découpe de titres
     --------------------------------------------------------- */
  (function rise() {
    $$(".spl").forEach(function (el) {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w, i) {
        return '<span class="w"><i style="transition-delay:' + (i * 0.04).toFixed(2) + 's">' + w + "</i></span> ";
      }).join("");
    });

    var els = $$("[data-rise], .spl");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = parseFloat(en.target.dataset.delay || 0);
        setTimeout(function () { en.target.classList.add("in"); }, d * 1000);
        io.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ---------------------------------------------------------
     6. Machine à écrire
     --------------------------------------------------------- */
  (function typed() {
    var el = $("#typed");
    if (!el) return;
    var words = (el.dataset.words || "").split("|").filter(Boolean);
    if (!words.length) return;
    if (reduced) { el.textContent = words[0]; return; }
    var w = 0, c = 0, back = false;
    (function step() {
      var word = words[w];
      c += back ? -1 : 1;
      el.textContent = word.slice(0, c);
      var wait = back ? 34 : 68;
      if (!back && c === word.length) { back = true; wait = 1900; }
      else if (back && c === 0) { back = false; w = (w + 1) % words.length; wait = 320; }
      setTimeout(step, wait);
    })();
  })();

  /* ---------------------------------------------------------
     7. Compteurs & jauges
     --------------------------------------------------------- */
  (function numbers() {
    var counts = $$("[data-count]");
    var meters = $$(".meter__b i");
    if (!("IntersectionObserver" in window)) {
      counts.forEach(function (e) { e.textContent = e.dataset.count; });
      meters.forEach(function (e) { e.style.width = e.dataset.value + "%"; });
      return;
    }
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        if (el.dataset.value !== undefined) { el.style.width = el.dataset.value + "%"; return; }
        var end = parseFloat(el.dataset.count), t0 = performance.now();
        (function run(now) {
          var p = Math.min((now - t0) / 1400, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(run); else el.textContent = end;
        })(t0);
      });
    }, { threshold: 0.45 });
    counts.concat(meters).forEach(function (e) { io.observe(e); });
  })();

  /* ---------------------------------------------------------
     8. Accordéon
     --------------------------------------------------------- */
  $$(".acc__h").forEach(function (h) {
    h.addEventListener("click", function () {
      var item = h.closest(".acc__i");
      var open = item.classList.contains("is-open");
      var group = h.closest(".acc");
      if (group && !open) {
        $$(".acc__i", group).forEach(function (o) {
          o.classList.remove("is-open");
          var hh = $(".acc__h", o);
          if (hh) hh.setAttribute("aria-expanded", "false");
        });
      }
      item.classList.toggle("is-open", !open);
      h.setAttribute("aria-expanded", String(!open));
    });
  });

  /* ---------------------------------------------------------
     9. Modale projet — exposée en global (la galerie 3D l'appelle)
     --------------------------------------------------------- */
  (function modal() {
    var modal = $("#modal");
    if (!modal) { window.openProject = function () {}; return; }
    var win = $(".modal__win", modal);
    var slot = $("#modal-slot", modal);
    var from = null;

    window.openProject = function (key) {
      var tpl = document.getElementById("tpl-" + key);
      if (!tpl) return;
      slot.innerHTML = "";
      slot.appendChild(tpl.content.cloneNode(true));
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-locked");
      win.scrollTop = 0;
      var x = $(".modal__x", modal);
      if (x) x.focus();
    };

    function close() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-locked");
      setTimeout(function () { slot.innerHTML = ""; }, 460);
      if (from) from.focus();
    }

    $$("[data-project]").forEach(function (b) {
      b.addEventListener("click", function () { from = b; window.openProject(b.dataset.project); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); from = b; window.openProject(b.dataset.project); }
      });
    });

    modal.addEventListener("click", function (e) {
      if (e.target.closest(".modal__x") || e.target.classList.contains("modal__bg")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });

    // Arrivée depuis un lien « projets.html#train » : on ouvre la fiche.
    var key = location.hash.slice(1);
    if (key && document.getElementById("tpl-" + key)) {
      setTimeout(function () { window.openProject(key); }, 1000);
    }
  })();

  /* ---------------------------------------------------------
     10. Aperçu flottant sur la liste éditoriale
     --------------------------------------------------------- */
  (function peek() {
    var rows = $$(".row[data-peek]");
    if (!rows.length || coarse || reduced) return;

    var box = document.createElement("div");
    box.className = "peek";
    var img = document.createElement("img");
    box.appendChild(img);
    document.body.appendChild(box);

    var x = 0, y = 0, tx = 0, ty = 0, on = false;
    document.addEventListener("pointermove", function (e) { tx = e.clientX + 170; ty = e.clientY; }, { passive: true });
    (function run() {
      x += (tx - x) * 0.13; y += (ty - y) * 0.13;
      box.style.left = x + "px";
      box.style.top = y + "px";
      requestAnimationFrame(run);
    })();

    rows.forEach(function (r) {
      r.addEventListener("pointerenter", function () {
        img.src = r.dataset.peek;
        box.classList.add("is-on");
        on = true;
      });
      r.addEventListener("pointerleave", function () {
        box.classList.remove("is-on");
        on = false;
      });
    });
  })();

  /* ---------------------------------------------------------
     11. Formulaire de contact
     --------------------------------------------------------- */
  (function form() {
    var f = $("#contact-form");
    if (!f) return;
    var msg = $(".formmsg", f);

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(f);
      var name = (d.get("name") || "").toString().trim();
      var mail = (d.get("email") || "").toString().trim();
      var subj = (d.get("subject") || "").toString().trim();
      var body = (d.get("message") || "").toString().trim();

      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || body.length < 10) {
        msg.className = "formmsg err";
        msg.textContent = "Il manque un nom, un email valide ou un message d'au moins 10 caractères.";
        return;
      }
      location.href = "mailto:nathan.dardalhon@etu.umontpellier.fr"
        + "?subject=" + encodeURIComponent(subj || "Contact portfolio — " + name)
        + "&body=" + encodeURIComponent("Nom : " + name + "\nEmail : " + mail + "\n\n" + body);

      msg.className = "formmsg ok";
      msg.textContent = "Votre messagerie s'ouvre avec le message pré-rempli. À très vite.";
      f.reset();
    });
  })();

  /* ---------------------------------------------------------
     12. Année
     --------------------------------------------------------- */
  $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
