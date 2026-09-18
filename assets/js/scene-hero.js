/* =============================================================
   scene-hero.js — Goutte de métal liquide
   Icosaèdre chromé déformé dans le vertex shader, normales
   recalculées par différences finies pour des reflets exacts.
   ============================================================= */
(function () {
  "use strict";

  var canvas = document.querySelector('[data-scene="hero"]');
  if (!canvas || !window.GL || !GL.supported()) return;

  var G = GL;
  // "main" : accueil, la goutte est le sujet. "page" : décor discret.
  var variant = canvas.dataset.variant || "main";
  var OPA_TOP = (variant === "page" ? 0.62 : 1) * (GL.small ? 0.78 : 1);
  var OPA_LOW = 0.22;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0, 5.4);

  var renderer = G.makeRenderer(canvas, { exposure: 1.05 });
  renderer.setSize(window.innerWidth, window.innerHeight);

  var env = G.studioEnv(renderer);
  scene.environment = env;

  var group = new THREE.Group();
  scene.add(group);

  /* ---------------------------------------------------------
     1. La goutte
     --------------------------------------------------------- */
  var uni = {
    uTime: { value: 0 },
    uAmp: { value: 0.115 },
    uPtr: { value: new THREE.Vector2(0, 0) }
  };

  var mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.075,
    envMapIntensity: 1.25
  });

  mat.onBeforeCompile = function (shader) {
    shader.uniforms.uTime = uni.uTime;
    shader.uniforms.uAmp = uni.uAmp;
    shader.uniforms.uPtr = uni.uPtr;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", [
        "#include <common>",
        "uniform float uTime; uniform float uAmp; uniform vec2 uPtr;",
        G.NOISE,
        // Deux octaves suffisent : on veut une forme lisse, pas du bruit.
        "float fbm(vec3 p){",
        "  return snoise(p) * 0.62 + snoise(p * 2.05) * 0.24;",
        "}",
        "vec3 dis(vec3 pos){",
        "  vec3 n = normalize(pos);",
        "  float f = fbm(n * 1.05 + vec3(0.0, uTime * 0.15, uTime * 0.06));",
        "  f += 0.17 * snoise(n * 1.9 + vec3(uPtr.x * 1.3, uPtr.y * 1.3, uTime * 0.2));",
        "  return n * (1.0 + f * uAmp);",
        "}",
        "vec3 ortho(vec3 v){",
        "  return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0) : vec3(0.0, -v.z, v.y));",
        "}"
      ].join("\n"))
      .replace("#include <beginnormal_vertex>", [
        "vec3 dPos = dis(position);",
        "vec3 nBase = normalize(position);",
        "vec3 tgt = ortho(nBase);",
        "vec3 bit = normalize(cross(nBase, tgt));",
        "float eps = 0.04;",
        "vec3 pA = dis(position + tgt * eps);",
        "vec3 pB = dis(position + bit * eps);",
        "vec3 objectNormal = normalize(cross(pA - dPos, pB - dPos));"
      ].join("\n"))
      .replace("#include <begin_vertex>", "vec3 transformed = dPos;");
  };

  var drop = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, G.small ? 20 : 40),
    mat
  );
  drop.scale.setScalar(1.28);
  group.add(drop);

  /* ---------------------------------------------------------
     2. Deux anneaux fins, nets
     --------------------------------------------------------- */
  var rings = new THREE.Group();
  [1.86, 2.28].forEach(function (r, i) {
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.0045, 8, 220),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1,
        roughness: 0.22,
        envMapIntensity: 1.4,
        transparent: true,
        opacity: i ? 0.4 : 0.62
      })
    );
    ring.rotation.x = Math.PI * (0.42 - i * 0.1);
    ring.rotation.y = i * 0.55;
    ring.userData.s = (i ? -1 : 1) * 0.05;
    rings.add(ring);
  });
  group.add(rings);

  /* ---------------------------------------------------------
     3. Poussière : peu de points, nets et discrets
     --------------------------------------------------------- */
  var N = G.small ? 150 : 330;
  var pos = new Float32Array(N * 3);
  var sc = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    var r = 2.4 + Math.pow(Math.random(), 0.7) * 5.5;
    var th = Math.random() * Math.PI * 2;
    var ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.8;
    pos[i * 3 + 2] = r * Math.cos(ph) - 1.5;
    sc[i] = 0.7 + Math.random() * 1.6;
  }
  var dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  dg.setAttribute("aScale", new THREE.BufferAttribute(sc, 1));

  var dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: uni.uTime,
      uPR: { value: renderer.getPixelRatio() }
    },
    vertexShader: [
      "uniform float uTime; uniform float uPR;",
      "attribute float aScale;",
      "varying float vA;",
      "void main(){",
      "  vec3 p = position;",
      "  p.y += sin(uTime * 0.25 + p.x * 0.6) * 0.16;",
      "  p.x += cos(uTime * 0.2 + p.z * 0.5) * 0.12;",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  gl_PointSize = aScale * uPR * (15.0 / max(-mv.z, 0.001));",
      "  vA = smoothstep(9.0, 2.0, length(p));",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "varying float vA;",
      "void main(){",
      "  vec2 uv = gl_PointCoord - 0.5;",
      "  float d = dot(uv, uv);",
      "  if (d > 0.25) discard;",
      "  gl_FragColor = vec4(vec3(1.0), smoothstep(0.25, 0.02, d) * vA * 0.36);",
      "}"
    ].join("\n")
  }));
  scene.add(dust);

  /* ---------------------------------------------------------
     4. Placement & boucle
     --------------------------------------------------------- */
  function layout() {
    var w = window.innerWidth;
    var k = variant === "page" ? 0.68 : 1;
    if (w > 1180) { group.position.set(variant === "page" ? 2.9 : 2.35, variant === "page" ? 1.25 : 0.45, 0); group.scale.setScalar(0.74 * k); }
    else if (w > 860) { group.position.set(1.7, variant === "page" ? 1.3 : 0.6, 0); group.scale.setScalar(0.62 * k); }
    else { group.position.set(0.5, 1.5, 0); group.scale.setScalar(0.44 * k); }
  }
  layout();

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    dust.material.uniforms.uPR.value = renderer.getPixelRatio();
    layout();
  }
  G.onResize(resize);

  var baseY = group.position.y;
  var scrollN = 0;
  var fade = 0;

  G.add(function (dt) {
    uni.uTime.value += G.reduced ? dt * 0.15 : dt;

    G.ptr.x = G.lerp(G.ptr.x, G.ptr.tx, 0.05);
    G.ptr.y = G.lerp(G.ptr.y, G.ptr.ty, 0.05);
    uni.uPtr.value.set(G.ptr.x, G.ptr.y);

    scrollN = G.lerp(scrollN, G.scroll.t, 0.06);

    // Le fond s abaisse dès qu on quitte le premier écran : le texte prime.
    fade = G.lerp(fade, Math.min(window.scrollY / (window.innerHeight * 0.7), 1), 0.07);
    canvas.style.opacity = String(OPA_TOP + (OPA_LOW - OPA_TOP) * fade);

    group.rotation.y += dt * 0.11;
    group.rotation.x = G.lerp(group.rotation.x, G.ptr.y * 0.22, 0.04);
    group.rotation.z = G.lerp(group.rotation.z, -G.ptr.x * 0.1, 0.04);
    group.position.y = baseY - scrollN * 2.6;

    for (var i = 0; i < rings.children.length; i++) {
      rings.children[i].rotation.z += dt * rings.children[i].userData.s;
    }
    dust.rotation.y += dt * 0.012;

    camera.position.x = G.lerp(camera.position.x, G.ptr.x * 0.34, 0.04);
    camera.position.y = G.lerp(camera.position.y, G.ptr.y * 0.26, 0.04);
    camera.lookAt(group.position.x * 0.4, group.position.y * 0.3, 0);

    renderer.render(scene, camera);
  });

  G.fadeIn(canvas);
  // Passé le fondu d entrée, la boucle pilote l opacité image par image.
  setTimeout(function () { canvas.style.transition = "none"; }, 1500);
})();
