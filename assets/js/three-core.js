/* =============================================================
   three-core.js — Socle 3D partagé
   Fabrique de rendu, environnement studio procédural, boucle unique.
   ============================================================= */
window.GL = (function () {
  "use strict";

  var ok = null;
  function supported() {
    if (ok !== null) return ok;
    if (typeof THREE === "undefined") return (ok = false);
    try {
      var c = document.createElement("canvas");
      ok = !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { ok = false; }
    return ok;
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  var small = window.matchMedia("(max-width: 760px)").matches;

  /* --------------------------------------------------------
     Bruit simplex 3D — Ashima Arts / Stefan Gustavson
     -------------------------------------------------------- */
  var NOISE = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    "  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    "  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
    "  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;",
    "  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
    "  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;",
    "  i=mod289(i);",
    "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    "  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;",
    "  vec4 j=p-49.0*floor(p*ns.z*ns.z);",
    "  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);",
    "  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy;",
    "  vec4 h=1.0-abs(x)-abs(y);",
    "  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);",
    "  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0;",
    "  vec4 sh=-step(h,vec4(0.0));",
    "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    "  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y);",
    "  vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);",
    "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
    "  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;",
    "  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;",
    "  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));",
    "}"
  ].join("\n");

  /* --------------------------------------------------------
     Environnement studio dessiné sur un canvas 2D,
     converti en carte d'environnement via PMREM.
     Aucun fichier HDR à télécharger.
     -------------------------------------------------------- */
  var envCache = null;
  function studioEnv(renderer) {
    if (envCache) return envCache;

    var w = 1024, h = 512;
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var g = cv.getContext("2d");

    // Fond : sol sombre, ciel légèrement plus clair
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0.00, "#1a1d26");
    grd.addColorStop(0.42, "#2b2f3b");
    grd.addColorStop(0.52, "#141621");
    grd.addColorStop(1.00, "#0a0b11");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);

    function blob(x, y, rx, ry, color, alpha) {
      var r = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      r.addColorStop(0, color);
      r.addColorStop(1, "rgba(0,0,0,0)");
      g.save();
      g.globalAlpha = alpha;
      g.globalCompositeOperation = "lighter";
      g.translate(x, y);
      g.scale(1, ry / Math.max(rx, ry));
      g.translate(-x, -y);
      g.fillStyle = r;
      g.fillRect(x - rx * 2, y - rx * 2, rx * 4, rx * 4);
      g.restore();
    }

    // Lumière principale, large et blanche
    blob(w * 0.28, h * 0.18, 300, 190, "#ffffff", 0.95);
    // Contre-jour froid
    blob(w * 0.78, h * 0.30, 250, 250, "#7d8cff", 0.55);
    // Rebond chaud par le bas
    blob(w * 0.56, h * 0.78, 300, 170, "#ff9d5c", 0.28);
    // Petite source nette : crée un éclat franc sur le métal
    blob(w * 0.10, h * 0.40, 70, 70, "#ffffff", 0.9);

    var tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;

    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    envCache = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return envCache;
  }

  /* --------------------------------------------------------
     Fabrique de rendu
     -------------------------------------------------------- */
  function makeRenderer(canvas, opts) {
    opts = opts || {};
    var r = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !small,
      alpha: true,
      powerPreference: "high-performance"
    });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    if (THREE.sRGBEncoding) r.outputEncoding = THREE.sRGBEncoding;
    if (opts.tone !== false && THREE.ACESFilmicToneMapping) {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = opts.exposure || 1;
    }
    return r;
  }

  /* --------------------------------------------------------
     Boucle unique partagée
     -------------------------------------------------------- */
  var jobs = [];
  var clock = null;
  var running = false;
  var visible = true;

  document.addEventListener("visibilitychange", function () { visible = !document.hidden; });

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    for (var i = 0; i < jobs.length; i++) jobs[i](dt, t);
  }

  function add(fn) {
    jobs.push(fn);
    if (!running) {
      running = true;
      clock = new THREE.Clock();
      tick();
    }
  }

  /* --------------------------------------------------------
     Redimensionnement mutualisé
     -------------------------------------------------------- */
  var resizers = [];
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      for (var i = 0; i < resizers.length; i++) resizers[i]();
    }, 120);
  }, { passive: true });

  function onResize(fn) { resizers.push(fn); }

  /* --------------------------------------------------------
     Pointeur normalisé, lissé
     -------------------------------------------------------- */
  var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (e) {
    ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  /* Défilement normalisé 0 → 1 */
  var scr = { v: 0, t: 0, px: 0 };
  function readScroll() {
    scr.px = window.scrollY;
    var max = document.body.scrollHeight - window.innerHeight;
    scr.t = max > 0 ? Math.min(scr.px / max, 1) : 0;
  }
  window.addEventListener("scroll", readScroll, { passive: true });
  readScroll();

  function fadeIn(canvas) {
    requestAnimationFrame(function () {
      setTimeout(function () { canvas.classList.add("is-live"); }, 60);
    });
  }

  return {
    supported: supported,
    reduced: reduced,
    coarse: coarse,
    small: small,
    NOISE: NOISE,
    studioEnv: studioEnv,
    makeRenderer: makeRenderer,
    add: add,
    onResize: onResize,
    ptr: ptr,
    scroll: scr,
    fadeIn: fadeIn,
    lerp: function (a, b, n) { return a + (b - a) * n; }
  };
})();
