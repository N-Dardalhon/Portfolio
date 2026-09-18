/* =============================================================
   app.js — Interactions du portfolio
   ============================================================= */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ---------------------------------------------------------
     1. Préchargement
     --------------------------------------------------------- */
  (function loader() {
    var el = $(".loader");
    if (!el) { document.body.classList.add("is-ready"); return; }

    var bar = $(".loader__bar i", el);
    var pct = $(".loader__pct", el);
    var name = $(".loader__name", el);

    if (name && !name.dataset.split) {
      name.dataset.split = "1";
      name.innerHTML = name.textContent.split("").map(function (ch, i) {
        return '<span style="animation-delay:' + (i * 0.035) + 's">' + (ch === " " ? "&nbsp;" : ch) + "</span>";
      }).join("");
    }

    document.body.classList.add("is-locked");

    var p = 0;
    var done = false;
    var loaded = false;
    window.addEventListener("load", function () { loaded = true; });

    var tick = setInterval(function () {
      var ceiling = loaded ? 100 : 92;
      p += Math.max(0.6, (ceiling - p) * 0.09);
      if (p >= ceiling) p = ceiling;
      if (bar) bar.style.right = (100 - p) + "%";
      if (pct) pct.textContent = String(Math.round(p)).padStart(3, "0") + " %";
      if (p >= 99.6 && !done) {
        done = true;
        clearInterval(tick);
        setTimeout(finish, 320);
      }
    }, 34);

    // Garde-fou : ne jamais bloquer plus de 5 s
    setTimeout(function () { if (!done) { done = true; clearInterval(tick); finish(); } }, 5000);

    function finish() {
      el.classList.add("is-done");
      document.body.classList.remove("is-locked");
      document.body.classList.add("is-ready");
      setTimeout(function () { el.remove(); }, 700);
    }
  })();

  /* ---------------------------------------------------------
     2. Curseur personnalisé + magnétisme
     --------------------------------------------------------- */
  if (!coarse && !reduced) {
    var dot = document.createElement("div");
    var ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;

    document.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
    }, { passive: true });

    document.addEventListener("pointerdown", function () { ring.classList.add("is-down"); });
    document.addEventListener("pointerup", function () { ring.classList.remove("is-down"); });

    (function loop() {
      rx += (mx - rx) * 0.17;
      ry += (my - ry) * 0.17;
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      requestAnimationFrame(loop);
    })();

    var HOVER = "a, button, .work, .chip, input, textarea, .acc__head, [data-magnetic]";
    document.addEventListener("pointerover", function (e) {
      if (e.target.closest && e.target.closest(HOVER)) ring.classList.add("is-hover");
    });
    document.addEventListener("pointerout", function (e) {
      if (e.target.closest && e.target.closest(HOVER)) ring.classList.remove("is-hover");
    });

    // Magnétisme
    $$("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.dataset.magnetic) || 0.35;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = "translate(" + dx * strength + "px," + dy * strength + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------------------------------------------------------
     3. Navigation
     --------------------------------------------------------- */
  (function nav() {
    var nav = $(".nav");
    if (!nav) return;
    var bar = $(".nav__scroll i", nav);
    var burger = $(".nav__burger", nav);
    var drawer = $(".drawer");
    var last = 0;

    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle("is-stuck", y > 40);
      if (!drawer || !drawer.classList.contains("is-open")) {
        nav.classList.toggle("is-hidden", y > last && y > 420);
      }
      last = y;

      var max = document.body.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";

      var top = $(".to-top");
      if (top) top.classList.toggle("is-on", y > 700);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (burger && drawer) {
      burger.addEventListener("click", function () {
        var open = drawer.classList.toggle("is-open");
        nav.classList.toggle("is-open", open);
        document.body.classList.toggle("is-locked", open);
      });
      $$("a", drawer).forEach(function (a) {
        a.addEventListener("click", function () {
          drawer.classList.remove("is-open");
          nav.classList.remove("is-open");
          document.body.classList.remove("is-locked");
        });
      });
    }

    // Défilement doux
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (!id || id === "#") return;
        var t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        var y = t.getBoundingClientRect().top + window.scrollY - 92;
        window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
        history.replaceState(null, "", id);
      });
    });

    // Lien actif
    var sections = $$("section[id]");
    var links = $$(".nav__link[href^='#']");
    if (sections.length && links.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = "#" + en.target.id;
          links.forEach(function (l) { l.classList.toggle("is-active", l.getAttribute("href") === id); });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
  })();

  /* ---------------------------------------------------------
     4. Révélations au scroll + découpe de texte
     --------------------------------------------------------- */
  (function reveal() {
    $$(".split").forEach(function (el) {
      if (el.dataset.split) return;
      el.dataset.split = "1";
      el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w, i) {
        return '<span class="word"><i style="transition-delay:' + (i * 0.045) + 's">' + w + "</i></span> ";
      }).join("");
    });

    var targets = $$("[data-reveal], .split");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseFloat(el.dataset.delay || 0);
        setTimeout(function () { el.classList.add("is-in"); }, d * 1000);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (t) { io.observe(t); });
  })();

  /* ---------------------------------------------------------
     5. Machine à écrire
     --------------------------------------------------------- */
  (function typed() {
    var el = $("#typed");
    if (!el) return;
    var words = (el.dataset.words || "").split("|").filter(Boolean);
    if (!words.length) return;
    if (reduced) { el.textContent = words[0]; return; }

    var w = 0, c = 0, del = false;
    (function step() {
      var word = words[w];
      c += del ? -1 : 1;
      el.textContent = word.slice(0, c);
      var wait = del ? 38 : 72;
      if (!del && c === word.length) { del = true; wait = 1700; }
      else if (del && c === 0) { del = false; w = (w + 1) % words.length; wait = 340; }
      setTimeout(step, wait);
    })();
  })();

  /* ---------------------------------------------------------
     6. Compteurs
     --------------------------------------------------------- */
  (function counters() {
    var els = $$("[data-count]");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.textContent = e.dataset.count; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        var end = parseFloat(el.dataset.count);
        var dur = 1500, t0 = performance.now();
        (function run(now) {
          var p = Math.min((now - t0) / dur, 1);
          var e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * e);
          if (p < 1) requestAnimationFrame(run);
          else el.textContent = end;
        })(t0);
      });
    }, { threshold: 0.5 });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ---------------------------------------------------------
     7. Jauges
     --------------------------------------------------------- */
  (function meters() {
    var els = $$(".meter__bar i");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.style.width = e.dataset.value + "%"; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.style.width = en.target.dataset.value + "%";
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ---------------------------------------------------------
     8. Lueur suiveuse + inclinaison 3D
     --------------------------------------------------------- */
  (function pointerFX() {
    $$("[data-glow]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (e.clientX - r.left) + "px");
        el.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });

    if (coarse || reduced) return;
    $$("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.dataset.tilt) || 7;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          "perspective(900px) rotateY(" + (px * max) + "deg) rotateX(" + (-py * max) + "deg) translateY(-6px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  })();

  /* ---------------------------------------------------------
     9. Filtres projets
     --------------------------------------------------------- */
  (function filters() {
    var btns = $$(".filter");
    var items = $$(".work");
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (o) { o.classList.remove("is-active"); });
        b.classList.add("is-active");
        var f = b.dataset.filter;
        items.forEach(function (it) {
          var match = f === "all" || (it.dataset.cat || "").split(" ").indexOf(f) !== -1;
          it.classList.toggle("is-out", !match);
        });
      });
    });
  })();

  /* ---------------------------------------------------------
     10. Modale projets
     --------------------------------------------------------- */
  (function modal() {
    var modal = $("#project-modal");
    if (!modal) return;
    var panel = $(".modal__panel", modal);
    var slot = $("#modal-slot", modal);
    var opener = null;

    function open(key) {
      var tpl = document.getElementById("tpl-" + key);
      if (!tpl) return;
      slot.innerHTML = "";
      slot.appendChild(tpl.content.cloneNode(true));
      modal.classList.add("is-open");
      document.body.classList.add("is-locked");
      modal.setAttribute("aria-hidden", "false");
      panel.scrollTop = 0;
      var close = $(".modal__close", modal);
      if (close) close.focus();
    }
    function close() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-locked");
      setTimeout(function () { slot.innerHTML = ""; }, 420);
      if (opener) opener.focus();
    }

    $$("[data-project]").forEach(function (b) {
      b.addEventListener("click", function () { opener = b; open(b.dataset.project); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          opener = b;
          open(b.dataset.project);
        }
      });
    });
    modal.addEventListener("click", function (e) {
      if (e.target.closest(".modal__close") || e.target.classList.contains("modal__scrim")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  })();

  /* ---------------------------------------------------------
     11. Accordéon
     --------------------------------------------------------- */
  (function accordion() {
    $$(".acc__head").forEach(function (head) {
      head.addEventListener("click", function () {
        var item = head.closest(".acc__item");
        var open = item.classList.contains("is-open");
        var group = head.closest(".acc");
        if (group && !open) {
          $$(".acc__item", group).forEach(function (o) {
            o.classList.remove("is-open");
            var h = $(".acc__head", o);
            if (h) h.setAttribute("aria-expanded", "false");
          });
        }
        item.classList.toggle("is-open", !open);
        head.setAttribute("aria-expanded", String(!open));
      });
    });
  })();

  /* ---------------------------------------------------------
     12. Citations
     --------------------------------------------------------- */
  (function quotes() {
    var box = $("#quote");
    if (!box) return;
    var text = $(".quote__text", box);
    var who = $(".quote__author", box);
    var dots = $(".quote__dots", box);

    var list = [
      { q: "Talk is cheap. Show me the code.", a: "Linus Torvalds" },
      { q: "La phrase la plus dangereuse est : « on a toujours fait comme ça ».", a: "Grace Hopper" },
      { q: "Ce sont parfois ceux dont on n'attend rien qui font des choses inimaginables.", a: "Alan Turing" },
      { q: "Le génie logiciel est une discipline à part entière.", a: "Margaret Hamilton" },
      { q: "La seule façon d'apprendre un langage, c'est d'écrire des programmes avec.", a: "Dennis Ritchie" }
    ];

    var i = 0, timer;
    list.forEach(function (_, n) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Citation " + (n + 1));
      b.addEventListener("click", function () { show(n); restart(); });
      dots.appendChild(b);
    });

    function show(n) {
      i = n;
      text.style.opacity = "0";
      text.style.transform = "translateY(10px)";
      setTimeout(function () {
        text.textContent = "« " + list[i].q + " »";
        who.textContent = list[i].a;
        text.style.transition = "opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1)";
        text.style.opacity = "1";
        text.style.transform = "none";
      }, 260);
      $$("button", dots).forEach(function (b, k) { b.classList.toggle("is-active", k === n); });
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { show((i + 1) % list.length); }, 6500);
    }
    show(0);
    restart();
  })();

  /* ---------------------------------------------------------
     13. Formulaire de contact (mailto)
     --------------------------------------------------------- */
  (function contact() {
    var form = $("#contact-form");
    if (!form) return;
    var status = $(".form-status", form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var name = (d.get("name") || "").toString().trim();
      var email = (d.get("email") || "").toString().trim();
      var subject = (d.get("subject") || "").toString().trim();
      var message = (d.get("message") || "").toString().trim();

      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
        status.className = "form-status err";
        status.textContent = "Merci de renseigner un nom, un email valide et un message d'au moins 10 caractères.";
        return;
      }

      var body =
        "Nom : " + name + "\n" +
        "Email : " + email + "\n\n" +
        message;

      window.location.href =
        "mailto:nathan.dardalhon@etu.umontpellier.fr" +
        "?subject=" + encodeURIComponent(subject || "Contact portfolio — " + name) +
        "&body=" + encodeURIComponent(body);

      status.className = "form-status ok";
      status.textContent = "Votre logiciel de messagerie s'ouvre avec le message pré-rempli. À très vite !";
      form.reset();
    });
  })();

  /* ---------------------------------------------------------
     14. Retour en haut
     --------------------------------------------------------- */
  (function toTop() {
    var btn = $(".to-top");
    if (!btn) return;
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
  })();

  /* ---------------------------------------------------------
     15. Année courante
     --------------------------------------------------------- */
  $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
