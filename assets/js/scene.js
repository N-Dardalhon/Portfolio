/* =============================================================
   scene.js — Fond 3D temps réel (Three.js)
   - Noyau organique déformé par du bruit simplex (vertex shader)
   - Coque filaire réactive
   - Nuage de 14 000 particules animées sur GPU
   - Bloom optionnel (UnrealBloomPass si dispo)
   ============================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("bg-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- WebGL support --- */
  try {
    var probe = document.createElement("canvas");
    if (!(probe.getContext("webgl") || probe.getContext("experimental-webgl"))) return;
  } catch (e) { return; }

  var mode = canvas.dataset.mode || "hero";          // "hero" | "page"
  var isMobile = window.matchMedia("(max-width: 760px)").matches;
  var PARTICLES = isMobile ? 5000 : 14000;

  /* ---------------------------------------------------------
     GLSL — bruit simplex 3D (Ashima / Stefan Gustavson)
     --------------------------------------------------------- */
  var NOISE = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    "  const vec2 C = vec2(1.0/6.0, 1.0/3.0);",
    "  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);",
    "  vec3 i  = floor(v + dot(v, C.yyy));",
    "  vec3 x0 = v - i + dot(i, C.xxx);",
    "  vec3 g = step(x0.yzx, x0.xyz);",
    "  vec3 l = 1.0 - g;",
    "  vec3 i1 = min(g.xyz, l.zxy);",
    "  vec3 i2 = max(g.xyz, l.zxy);",
    "  vec3 x1 = x0 - i1 + C.xxx;",
    "  vec3 x2 = x0 - i2 + C.yyy;",
    "  vec3 x3 = x0 - D.yyy;",
    "  i = mod289(i);",
    "  vec4 p = permute(permute(permute(",
    "      i.z + vec4(0.0, i1.z, i2.z, 1.0))",
    "    + i.y + vec4(0.0, i1.y, i2.y, 1.0))",
    "    + i.x + vec4(0.0, i1.x, i2.x, 1.0));",
    "  float n_ = 0.142857142857;",
    "  vec3 ns = n_ * D.wyz - D.xzx;",
    "  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);",
    "  vec4 x_ = floor(j * ns.z);",
    "  vec4 y_ = floor(j - 7.0 * x_);",
    "  vec4 x = x_ * ns.x + ns.yyyy;",
    "  vec4 y = y_ * ns.x + ns.yyyy;",
    "  vec4 h = 1.0 - abs(x) - abs(y);",
    "  vec4 b0 = vec4(x.xy, y.xy);",
    "  vec4 b1 = vec4(x.zw, y.zw);",
    "  vec4 s0 = floor(b0) * 2.0 + 1.0;",
    "  vec4 s1 = floor(b1) * 2.0 + 1.0;",
    "  vec4 sh = -step(h, vec4(0.0));",
    "  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;",
    "  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;",
    "  vec3 p0 = vec3(a0.xy, h.x);",
    "  vec3 p1 = vec3(a0.zw, h.y);",
    "  vec3 p2 = vec3(a1.xy, h.z);",
    "  vec3 p3 = vec3(a1.zw, h.w);",
    "  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));",
    "  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;",
    "  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);",
    "  m = m * m;",
    "  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));",
    "}"
  ].join("\n");

  /* ---------------------------------------------------------
     Setup
     --------------------------------------------------------- */
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050508, 0.085);

  var camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: !isMobile,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.85));
  renderer.setSize(window.innerWidth, window.innerHeight);

  var world = new THREE.Group();
  scene.add(world);

  var VIOLET = new THREE.Color(0x7c5cff);
  var CYAN = new THREE.Color(0x35e0f2);
  var PINK = new THREE.Color(0xb06cff);

  var uTime = { value: 0 };
  var uMouse = { value: new THREE.Vector2(0, 0) };
  var uScroll = { value: 0 };
  var uBurst = { value: 0 };

  /* ---------------------------------------------------------
     1. Noyau organique
     --------------------------------------------------------- */
  var coreMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: uTime, uMouse: uMouse, uScroll: uScroll, uBurst: uBurst,
      uA: { value: VIOLET }, uB: { value: CYAN }, uC: { value: PINK }
    },
    vertexShader: [
      "uniform float uTime; uniform float uScroll; uniform float uBurst; uniform vec2 uMouse;",
      "varying vec3 vNormal; varying vec3 vView; varying float vNoise;",
      NOISE,
      "void main(){",
      "  float t = uTime * 0.28;",
      "  vec3 p = position;",
      "  float n1 = snoise(p * 1.15 + vec3(0.0, t, 0.0));",
      "  float n2 = snoise(p * 2.6 - vec3(t * 0.7, 0.0, t * 0.35)) * 0.45;",
      "  float n = n1 + n2;",
      "  float grab = 0.14 * snoise(p * 3.2 + vec3(uMouse.x * 2.0, uMouse.y * 2.0, t));",
      "  float amp = 0.21 + uScroll * 0.26 + uBurst * 0.42;",
      "  vNoise = n;",
      "  vec3 displaced = p + normal * (n * amp + grab);",
      "  vNormal = normalize(normalMatrix * normal);",
      "  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);",
      "  vView = normalize(-mv.xyz);",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uTime;",
      "varying vec3 vNormal; varying vec3 vView; varying float vNoise;",
      "void main(){",
      "  float fres = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0), 3.1);",
      "  float band = smoothstep(-1.0, 1.0, vNoise);",
      "  vec3 col = mix(uA, uB, band);",
      "  col = mix(col, uC, 0.18 + 0.18 * sin(vNoise * 3.0 + uTime * 0.4));",
      "  col *= 0.12 + fres * 1.30;",
      "  float alpha = 0.03 + fres * 0.50;",
      "  gl_FragColor = vec4(col, alpha);",
      "}"
    ].join("\n")
  });
  var core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.42, isMobile ? 28 : 52), coreMat);
  world.add(core);

  /* ---------------------------------------------------------
     2. Coque filaire
     --------------------------------------------------------- */
  var shellMat = new THREE.ShaderMaterial({
    transparent: true,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: uTime, uScroll: uScroll, uBurst: uBurst, uA: { value: CYAN } },
    vertexShader: [
      "uniform float uTime; uniform float uScroll; uniform float uBurst;",
      "varying float vF;",
      NOISE,
      "void main(){",
      "  float t = uTime * 0.2;",
      "  vec3 p = position;",
      "  float n = snoise(p * 0.85 + vec3(t * 0.6, -t, t * 0.3));",
      "  vF = n;",
      "  vec3 d = p + normal * (n * (0.34 + uScroll * 0.5 + uBurst * 0.4));",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(d, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uA; varying float vF;",
      "void main(){",
      "  float a = 0.025 + smoothstep(0.1, 1.0, vF) * 0.12;",
      "  gl_FragColor = vec4(uA, a);",
      "}"
    ].join("\n")
  });
  var shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.05, isMobile ? 6 : 11), shellMat);
  world.add(shell);

  /* ---------------------------------------------------------
     3. Nuage de particules
     --------------------------------------------------------- */
  var pos = new Float32Array(PARTICLES * 3);
  var seed = new Float32Array(PARTICLES);
  var scale = new Float32Array(PARTICLES);
  var tint = new Float32Array(PARTICLES);

  for (var i = 0; i < PARTICLES; i++) {
    // Répartition : 55 % coquille sphérique proche, 45 % poussière large
    var shellish = Math.random() < 0.55;
    var r = shellish
      ? 2.15 + Math.random() * 0.55
      : 3.0 + Math.pow(Math.random(), 0.6) * 5.2;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.82;
    pos[i * 3 + 2] = r * Math.cos(phi);
    seed[i] = Math.random() * 100;
    scale[i] = 0.5 + Math.random() * Math.random() * 2.6;
    tint[i] = Math.random();
  }

  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  pGeo.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
  pGeo.setAttribute("aTint", new THREE.BufferAttribute(tint, 1));

  var pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: uTime, uMouse: uMouse, uScroll: uScroll, uBurst: uBurst,
      uA: { value: VIOLET }, uB: { value: CYAN },
      uPR: { value: renderer.getPixelRatio() }
    },
    vertexShader: [
      "uniform float uTime; uniform float uScroll; uniform float uBurst; uniform float uPR;",
      "uniform vec2 uMouse;",
      "attribute float aSeed; attribute float aScale; attribute float aTint;",
      "varying float vAlpha; varying float vTint;",
      NOISE,
      "void main(){",
      "  vec3 p = position;",
      "  float t = uTime * 0.16 + aSeed;",
      "  float d = length(p);",
      // dérive organique
      "  vec3 flow = vec3(",
      "    snoise(p * 0.24 + vec3(t * 0.5, 0.0, 0.0)),",
      "    snoise(p * 0.24 + vec3(0.0, t * 0.5, 12.3)),",
      "    snoise(p * 0.24 + vec3(7.1, 0.0, t * 0.5))",
      "  );",
      "  p += flow * (0.42 + uScroll * 0.7);",
      // respiration + souffle au clic
      "  p *= 1.0 + 0.045 * sin(uTime * 0.5 + aSeed) + uBurst * 0.22;",
      // attraction douce vers le curseur
      "  p.xy += uMouse * (0.30 + (d - 2.0) * 0.06);",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  float sz = aScale * (1.0 + uBurst * 0.8);",
      "  gl_PointSize = sz * uPR * (7.5 / max(-mv.z, 0.001)) * 6.0;",
      "  float fade = smoothstep(11.0, 2.0, d) * 0.85 + 0.15;",
      "  vAlpha = fade * (0.35 + 0.65 * smoothstep(-1.0, 1.0, flow.x));",
      "  vTint = aTint;",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uA; uniform vec3 uB;",
      "varying float vAlpha; varying float vTint;",
      "void main(){",
      "  vec2 uv = gl_PointCoord - 0.5;",
      "  float dd = dot(uv, uv);",
      "  if (dd > 0.25) discard;",
      "  float soft = smoothstep(0.25, 0.0, dd);",
      "  vec3 col = mix(uA, uB, vTint);",
      "  col += soft * 0.18;",
      "  gl_FragColor = vec4(col, soft * vAlpha * 0.34);",
      "}"
    ].join("\n")
  });

  var points = new THREE.Points(pGeo, pMat);
  world.add(points);

  /* ---------------------------------------------------------
     4. Anneaux orbitaux
     --------------------------------------------------------- */
  var rings = new THREE.Group();
  for (var k = 0; k < 3; k++) {
    var ringGeo = new THREE.TorusGeometry(2.6 + k * 0.62, 0.0035, 6, 190);
    var ringMat = new THREE.MeshBasicMaterial({
      color: k % 2 ? CYAN : VIOLET,
      transparent: true,
      opacity: 0.13 - k * 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * (0.32 + k * 0.12);
    ring.rotation.y = k * 0.5;
    ring.userData.spin = (k % 2 ? 1 : -1) * (0.05 + k * 0.022);
    rings.add(ring);
  }
  world.add(rings);

  var baseX = 0, baseY = 0;
  if (mode === "page") {
    world.scale.setScalar(0.72);
    baseX = 1.5; baseY = 0.25;
  } else if (window.innerWidth > 1100) {
    // Décale le visuel à droite pour laisser respirer le texte du hero
    baseX = 2.15;
  }
  world.position.set(baseX, baseY, 0);

  /* ---------------------------------------------------------
     5. Post-processing (bloom si disponible)
     --------------------------------------------------------- */
  var composer = null;
  if (!isMobile && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) {
    try {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      var bloom = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.42,   // strength
        0.55,   // radius
        0.62    // threshold
      );
      composer.addPass(bloom);
      composer.setSize(window.innerWidth, window.innerHeight);
    } catch (err) { composer = null; }
  }

  /* ---------------------------------------------------------
     6. Entrées
     --------------------------------------------------------- */
  var mouse = { x: 0, y: 0 };
  var target = { x: 0, y: 0 };
  var scrollN = 0, scrollT = 0;
  var fade = 0, fadeT = 0;          // atténuation du fond hors du hero
  var OPA_TOP = isMobile ? 0.55 : (mode === "page" ? 0.62 : 0.92);
  var OPA_BODY = isMobile ? 0.18 : 0.26;
  var burst = 0;

  window.addEventListener("pointermove", function (e) {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  window.addEventListener("pointerdown", function () { burst = 1; }, { passive: true });

  window.addEventListener("scroll", function () {
    var max = document.body.scrollHeight - window.innerHeight;
    scrollT = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    fadeT = Math.min(window.scrollY / (window.innerHeight * 0.75), 1);
  }, { passive: true });

  var visible = true;
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; });

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    pMat.uniforms.uPR.value = renderer.getPixelRatio();
    if (composer) composer.setSize(w, h);
  }
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  }, { passive: true });

  /* ---------------------------------------------------------
     7. Boucle
     --------------------------------------------------------- */
  var clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;

    var dt = Math.min(clock.getDelta(), 0.05);
    uTime.value += reduced ? dt * 0.12 : dt;

    mouse.x += (target.x - mouse.x) * 0.045;
    mouse.y += (target.y - mouse.y) * 0.045;
    uMouse.value.set(mouse.x, mouse.y);

    scrollN += (scrollT - scrollN) * 0.06;
    uScroll.value = scrollN;

    fade += (fadeT - fade) * 0.07;
    canvas.style.opacity = String(OPA_TOP + (OPA_BODY - OPA_TOP) * fade);

    burst *= 0.93;
    uBurst.value = burst;

    world.rotation.y += dt * 0.055 + mouse.x * dt * 0.28;
    world.rotation.x += (mouse.y * 0.26 - world.rotation.x) * 0.03;
    world.position.y = baseY - scrollN * 0.9;

    core.rotation.y -= dt * 0.11;
    shell.rotation.y += dt * 0.06;
    shell.rotation.z -= dt * 0.03;
    points.rotation.y += dt * 0.017;

    for (var i = 0; i < rings.children.length; i++) {
      var r = rings.children[i];
      r.rotation.z += dt * r.userData.spin;
      r.rotation.y += dt * r.userData.spin * 0.4;
    }

    camera.position.x += (mouse.x * 0.55 - camera.position.x) * 0.035;
    camera.position.y += (mouse.y * 0.42 - camera.position.y) * 0.035;
    camera.lookAt(baseX * 0.35, world.position.y * 0.35, 0);

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  frame();

  /* Fondu d'apparition du canvas */
  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 1.4s cubic-bezier(.22,1,.36,1)";
  setTimeout(function () { canvas.style.opacity = String(OPA_TOP); }, 120);
  // La boucle pilote ensuite l'opacité image par image : on retire la transition CSS.
  setTimeout(function () { canvas.style.transition = "none"; }, 1700);

  window.PortfolioScene = { scene: scene, world: world, renderer: renderer };
})();
