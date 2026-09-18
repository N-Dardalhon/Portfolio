/* =============================================================
   scene-gallery.js — Galerie de projets en 3D
   Plans texturés disposés en arc, défilement infini au geste,
   à la molette ou au clavier. Le plan centré ouvre sa fiche.
   ============================================================= */
(function () {
  "use strict";

  var canvas = document.querySelector('[data-scene="gallery"]');
  if (!canvas || !window.GL || !GL.supported()) return;

  var host = canvas.parentElement;
  var items = Array.prototype.slice.call(document.querySelectorAll("#gallery-data [data-key]"))
    .map(function (el) {
      return {
        key: el.dataset.key,
        src: el.dataset.src,
        title: el.dataset.title,
        meta: el.dataset.meta
      };
    });
  if (items.length < 2) return;

  var G = GL;
  var hudTitle = document.querySelector("#gallery-title");
  var hudMeta = document.querySelector("#gallery-meta");
  var hudDots = document.querySelector("#gallery-dots");

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 0, 4.6);

  var renderer = G.makeRenderer(canvas, { tone: false });

  var PW = 3.0, PH = 1.86, SP = 3.62;
  var SPAN = items.length * SP;

  /* ---------------------------------------------------------
     Plans
     --------------------------------------------------------- */
  var loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");

  var planeGeo = new THREE.PlaneGeometry(PW, PH, 40, 24);
  var group = new THREE.Group();
  scene.add(group);

  var vert = [
    "uniform float uVel; uniform float uHover;",
    "varying vec2 vUv;",
    "void main(){",
    "  vUv = uv;",
    "  vec3 p = position;",
    // Le plan se courbe avec la vitesse de défilement
    "  p.z += sin(uv.x * 3.14159) * uVel * 2.4;",
    "  p.z += sin(uv.y * 3.14159) * uVel * 0.6;",
    "  p *= 1.0 + uHover * 0.035;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);",
    "}"
  ].join("\n");

  var frag = [
    "uniform sampler2D uTex; uniform float uVel; uniform float uOn;",
    "uniform float uReady; uniform vec2 uRatio;",
    "varying vec2 vUv;",
    "void main(){",
    // Recadrage « cover »
    "  vec2 uv = (vUv - 0.5) * uRatio + 0.5;",
    "  float sh = clamp(abs(uVel) * 0.5, 0.0, 0.05);",
    "  vec3 col;",
    "  col.r = texture2D(uTex, uv + vec2(sh, 0.0)).r;",
    "  col.g = texture2D(uTex, uv).g;",
    "  col.b = texture2D(uTex, uv - vec2(sh, 0.0)).b;",
    "  float g = dot(col, vec3(0.299, 0.587, 0.114));",
    // Les plans latéraux se désaturent et s'assombrissent
    "  col = mix(vec3(g) * 0.42, col, uOn);",
    "  col = mix(vec3(0.07), col, uReady);",
    // Léger vignettage interne
    "  float vg = smoothstep(1.05, 0.35, length((vUv - 0.5) * vec2(1.5, 1.0)));",
    "  col *= 0.72 + vg * 0.28;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var planes = items.map(function (it, i) {
    var tex = new THREE.Texture();
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uVel: { value: 0 },
        uOn: { value: 0 },
        uHover: { value: 0 },
        uReady: { value: 0 },
        uRatio: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: vert,
      fragmentShader: frag
    });

    loader.load(it.src, function (t) {
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      mat.uniforms.uTex.value = t;
      // Recadrage « cover » : on compare le ratio image / plan
      var ia = t.image.width / t.image.height;
      var pa = PW / PH;
      if (ia > pa) mat.uniforms.uRatio.value.set(pa / ia, 1);
      else mat.uniforms.uRatio.value.set(1, ia / pa);
      mat.uniforms.uReady.value = 1;
    }, undefined, function () { mat.uniforms.uReady.value = 0.35; });

    var mesh = new THREE.Mesh(planeGeo, mat);
    mesh.userData = { i: i, key: it.key };
    group.add(mesh);
    return mesh;
  });

  /* ---------------------------------------------------------
     Entrées : glisser, molette, clavier
     --------------------------------------------------------- */
  var offset = 0, target = 0, vel = 0;
  var dragging = false, lastX = 0, moved = 0;
  var hoverIdx = -1;

  function px2world(px) {
    return (px / host.clientWidth) * (PW * 2.1);
  }

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; moved = 0;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    document.body.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    target -= px2world(dx);
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("is-dragging");
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    // Clic net : on ouvre la fiche du plan centré
    if (moved < 6) {
      var idx = centerIndex();
      var it = items[idx];
      if (it && window.openProject) window.openProject(it.key);
    } else {
      target = Math.round(target / SP) * SP;
    }
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("wheel", function (e) {
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();
    target += d * 0.006;
    clearTimeout(canvas._snap);
    canvas._snap = setTimeout(function () { target = Math.round(target / SP) * SP; }, 220);
  }, { passive: false });

  host.setAttribute("tabindex", "0");
  host.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { target += SP; e.preventDefault(); }
    if (e.key === "ArrowLeft") { target -= SP; e.preventDefault(); }
    if (e.key === "Enter") {
      var it = items[centerIndex()];
      if (it && window.openProject) window.openProject(it.key);
    }
  });

  function centerIndex() {
    var n = items.length;
    return ((Math.round(target / SP) % n) + n) % n;
  }

  window.galleryGo = function (dir) { target += dir * SP; };

  /* ---------------------------------------------------------
     HUD
     --------------------------------------------------------- */
  if (hudDots) {
    items.forEach(function () { hudDots.appendChild(document.createElement("i")); });
  }
  var shown = -1;
  function syncHud(idx) {
    if (idx === shown) return;
    shown = idx;
    var it = items[idx];
    if (hudTitle) {
      hudTitle.style.opacity = "0";
      setTimeout(function () {
        hudTitle.textContent = it.title;
        if (hudMeta) hudMeta.textContent = it.meta;
        hudTitle.style.opacity = "1";
      }, 180);
    }
    if (hudDots) {
      Array.prototype.forEach.call(hudDots.children, function (d, i) {
        d.classList.toggle("on", i === idx);
      });
    }
  }

  /* ---------------------------------------------------------
     Survol
     --------------------------------------------------------- */
  var ray = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  canvas.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    var hit = ray.intersectObjects(planes, false);
    hoverIdx = hit.length ? hit[0].object.userData.i : -1;
  });
  canvas.addEventListener("pointerleave", function () { hoverIdx = -1; });

  /* ---------------------------------------------------------
     Dimensions
     --------------------------------------------------------- */
  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    // On recule la caméra sur les écrans étroits pour garder le plan entier
    camera.position.z = w / h < 1.15 ? 6.4 : 4.6;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  G.onResize(resize);
  resize();

  /* ---------------------------------------------------------
     Boucle
     --------------------------------------------------------- */
  G.add(function (dt) {
    var prev = offset;
    offset = G.lerp(offset, target, 0.085);
    vel = G.lerp(vel, (offset - prev) / Math.max(dt, 0.001) * 0.012, 0.18);

    var n = items.length;
    for (var i = 0; i < planes.length; i++) {
      var m = planes[i];
      // Position enroulée : défilement infini
      var x = i * SP - offset;
      x = ((x + SPAN * 0.5) % SPAN + SPAN) % SPAN - SPAN * 0.5;

      m.position.x = x;
      m.position.z = -Math.pow(Math.abs(x), 1.45) * 0.19;
      m.position.y = -Math.abs(x) * 0.015;
      m.rotation.y = -x * 0.13;
      m.rotation.z = x * 0.006;

      var near = 1 - Math.min(Math.abs(x) / (SP * 0.92), 1);
      var u = m.material.uniforms;
      u.uVel.value = G.lerp(u.uVel.value, vel, 0.2);
      u.uOn.value = G.lerp(u.uOn.value, Math.max(near, hoverIdx === i ? 1 : 0), 0.1);
      u.uHover.value = G.lerp(u.uHover.value, hoverIdx === i ? 1 : 0, 0.12);
      m.visible = Math.abs(x) < SPAN * 0.5 - 0.1;
      m.renderOrder = Math.round(near * 10);
    }

    syncHud(centerIndex());
    renderer.render(scene, camera);
  });

  G.fadeIn(canvas);
})();
