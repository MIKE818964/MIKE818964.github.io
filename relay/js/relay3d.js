// =============================================================================
// relay3d.js — real 3D relay viewer. Loads the actual AutomationDirect
// 784-4C-24D STL (from their CAD download) and lets you grab-and-spin it.
// Uses the locally-bundled Three.js (global THREE) so it works offline.
// Frames the model to fit the panel (any aspect) so it never overflows, and
// lights it with a strong key vs soft fill so the geometry actually reads.
// =============================================================================

export function initRelay3D(container, stlPath = "assets/models/784-4c-24d.stl") {
  const THREE = window.THREE;
  if (!THREE || !THREE.STLLoader) {
    container.innerHTML = '<div class="r3d-fallback">3D viewer needs the bundled Three.js — reload the app.</div>';
    return;
  }

  const size = () => ({ w: container.clientWidth || 360, h: container.clientHeight || 320 });
  let { w, h } = size();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  // ---- lighting: strong key vs soft fill so the shape reads (not washed out) ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab4c8, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdce6fb, 0.30); fill.position.set(-4, 1, -2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.55); rim.position.set(-1, -2, -4); scene.add(rim);

  // ---- orbit (grab-and-spin) + gentle auto-rotate ----
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;

  const DIR = new THREE.Vector3(0.55, 0.4, 1).normalize();   // pleasant 3/4 view
  let modelRadius = 0;

  // frame the model so the whole bounding sphere fits the panel, with margin —
  // honors BOTH the vertical FOV and the (often wide) horizontal aspect.
  function frame() {
    const s = size(); w = s.w; h = s.h;
    camera.aspect = w / h;
    renderer.setSize(w, h);
    if (modelRadius) {
      const vFov = camera.fov * Math.PI / 180;
      const distH = modelRadius / Math.sin(vFov / 2);
      const distW = modelRadius / Math.sin(Math.atan(Math.tan(vFov / 2) * camera.aspect));
      const dist = Math.max(distH, distW) * 1.3;             // 1.3 = breathing room
      camera.near = dist / 100; camera.far = dist * 100;
      camera.position.copy(DIR).multiplyScalar(dist);
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.5;
      controls.maxDistance = dist * 2.5;
    }
    camera.updateProjectionMatrix();
    controls.update();
  }

  const fail = (err) => {
    console.error("3D load error", err);
    container.innerHTML = '<div class="r3d-fallback">Could not load the 3D model.</div>';
  };
  if (/\.glb$/i.test(stlPath) && THREE.GLTFLoader) {
    // photo-real scan (GLB): arrives with its own baked PBR textures — keep
    // them; only center + frame it like the CAD models
    new THREE.GLTFLoader().load(stlPath, (g) => {
      const obj = g.scene;
      const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
      obj.position.sub(sphere.center);
      modelRadius = sphere.radius;
      scene.add(obj);
      frame();
    }, undefined, fail);
  } else {
    const loader = new THREE.STLLoader();
    loader.load(stlPath, (geo) => {
      geo.computeVertexNormals();
      geo.center();                        // center at origin
      geo.computeBoundingSphere();
      modelRadius = geo.boundingSphere.radius;
      const mat = new THREE.MeshStandardMaterial({ color: 0x767f90, metalness: 0.25, roughness: 0.5 });
      scene.add(new THREE.Mesh(geo, mat));
      frame();                             // fit now that we know the model size
    }, undefined, fail);
  }

  // render loop — self-stops when the canvas leaves the DOM (view changed)
  function animate() {
    if (!renderer.domElement.isConnected) {
      window.removeEventListener("resize", frame);
      renderer.dispose();
      return;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  window.addEventListener("resize", frame);
  requestAnimationFrame(() => { frame(); animate(); });
}
