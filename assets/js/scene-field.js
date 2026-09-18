/* =============================================================
   scene-field.js — Champ de points
   Grille régulière ondulant lentement. Sert de fond calme aux
   pages intérieures : de la profondeur, aucun bruit visuel.
   ============================================================= */
(function () {
  "use strict";

  var canvas = document.querySelector('[data-scene="field"]');
  if (!canvas || !window.GL || !GL.supported()) return;

  var G = GL;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0, 7.5);

  var renderer = G.makeRenderer(canvas, { tone: false });
  renderer.setSize(window.innerWidth, window.innerHeight);

  /* Grille */
  var COLS = G.small ? 64 : 132;
  var ROWS = G.small ? 40 : 76;
  var SPAN_X = 22, SPAN_Y = 13;
  var total = COLS * ROWS;

  var pos = new Float32Array(total * 3);
  var uv2 = new Float32Array(total * 2);
  var k = 0;
  for (var y = 0; y < ROWS; y++) {
    for (var x = 0; x < COLS; x++) {
      var u = x / (COLS - 1), v = y / (ROWS - 1);
      pos[k * 3] = (u - 0.5) * SPAN_X;
      pos[k * 3 + 1] = (v - 0.5) * SPAN_Y;
      pos[k * 3 + 2] = 0;
      uv2[k * 2] = u;
      uv2[k * 2 + 1] = v;
      k++;
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aUv", new THREE.BufferAttribute(uv2, 2));

  var uni = {
    uTime: { value: 0 },
    uPtr: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uPR: { value: renderer.getPixelRatio() },
    uFade: { value: G.small ? 0.17 : 0.26 }
  };

  var mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: uni,
    vertexShader: [
      "uniform float uTime; uniform float uScroll; uniform float uPR; uniform vec2 uPtr;",
      "attribute vec2 aUv;",
      "varying float vA;",
      G.NOISE,
      "void main(){",
      "  vec3 p = position;",
      // Onde principale : deux sinus croisés, très basse fréquence
      "  float w = sin(p.x * 0.42 + uTime * 0.5) * cos(p.y * 0.52 - uTime * 0.36);",
      // Un soupçon de bruit pour casser la régularité parfaite
      "  w += snoise(vec3(p.xy * 0.24, uTime * 0.11)) * 0.7;",
      "  p.z = w * 0.85 - uScroll * 1.6;",
      // Creux doux sous le curseur
      "  vec2 ptrWorld = vec2(uPtr.x * 10.0, uPtr.y * 6.0);",
      "  float d = distance(p.xy, ptrWorld);",
      "  float pull = smoothstep(4.2, 0.0, d);",
      "  p.z += pull * 1.5;",
      "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
      "  gl_PointSize = (1.0 + pull * 2.0 + w * 0.3) * uPR * (10.0 / max(-mv.z, 0.001));",
      // Atténuation radiale : la grille se fond dans le noir sur les bords
      "  float edge = 1.0 - smoothstep(0.14, 0.46, distance(aUv, vec2(0.5)));",
      "  vA = edge * (0.30 + 0.42 * smoothstep(-1.2, 1.2, w) + pull * 0.55);",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "varying float vA; uniform float uFade;",
      "void main(){",
      "  vec2 uv = gl_PointCoord - 0.5;",
      "  float d = dot(uv, uv);",
      "  if (d > 0.25) discard;",
      "  gl_FragColor = vec4(vec3(1.0), smoothstep(0.25, 0.04, d) * vA * uFade);",
      "}"
    ].join("\n")
  });

  if (G.small) mat.uniforms.uPR.value *= 0.9;
  var field = new THREE.Points(geo, mat);
  field.rotation.x = -0.34;
  field.position.y = -1.9;
  scene.add(field);

  G.onResize(function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    uni.uPR.value = renderer.getPixelRatio();
  });

  var scrollN = 0;

  G.add(function (dt) {
    uni.uTime.value += G.reduced ? dt * 0.12 : dt;

    G.ptr.x = G.lerp(G.ptr.x, G.ptr.tx, 0.05);
    G.ptr.y = G.lerp(G.ptr.y, G.ptr.ty, 0.05);
    uni.uPtr.value.set(G.ptr.x, G.ptr.y);

    scrollN = G.lerp(scrollN, G.scroll.t, 0.05);
    uni.uScroll.value = scrollN;

    field.rotation.z = G.lerp(field.rotation.z, G.ptr.x * 0.06, 0.03);
    camera.position.x = G.lerp(camera.position.x, G.ptr.x * 0.5, 0.03);
    camera.position.y = G.lerp(camera.position.y, G.ptr.y * 0.35, 0.03);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  });

  G.fadeIn(canvas);
})();
