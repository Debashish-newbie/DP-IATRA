const API_URL = "https://dp-iatra.onrender.com/api/asteroids";
const TRACK_URL = "https://dp-iatra.onrender.com/api/tracked";

function isSupabaseEnabled() {
  return Boolean(window.iatraSupabase) && !window.iatraSupabaseDisabled;
}

function disableSupabase() {
  window.iatraSupabaseDisabled = true;
}

const state = {
  neos: [],
  filter: "all",
  search: ""
};

const lastUpdated = document.getElementById("lastUpdated");
const statTotal = document.getElementById("statTotal");
const statHazardous = document.getElementById("statHazardous");
const statClosest = document.getElementById("statClosest");
const statLargest = document.getElementById("statLargest");
const neoGrid = document.getElementById("neoGrid");
const closeApproachList = document.getElementById("closeApproachList");
const trackedList = document.getElementById("trackedList");
const statusPanel = document.getElementById("statusPanel");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".chip[data-filter]");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const userNameEl = document.getElementById("userName");
const logoutButton = document.getElementById("logoutButton");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const applyRangeButton = document.getElementById("applyRange");
const openSimulationButton = document.getElementById("openSimulation");
const closeSimulationButton = document.getElementById("closeSimulation");
const simulationModal = document.getElementById("simulationModal");
const asteroidCanvas = document.getElementById("asteroidCanvas");

let simulationState = {
  renderer: null,
  scene: null,
  camera: null,
  asteroid: null,
  planets: [],
  frameId: null,
  dragging: false,
  lastX: 0,
  lastY: 0,
  startTime: 0
};

let trackedState = [];
let currentUserEmail = "";
let currentUserId = "";

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function buildApiUrl(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set("start", startDate);
  if (endDate) params.set("end", endDate);
  const query = params.toString();
  return query ? `${API_URL}?${query}` : API_URL;
}

function formatNumber(value, digits = 0) {
  if (Number.isNaN(value) || value === null || value === undefined) return "--";
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

function formatKm(value) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)}M km`;
  return `${formatNumber(value, 0)} km`;
}

function setStatus(show, title, message) {
  statusPanel.classList.toggle("show", show);
  if (!show) return;
  statusPanel.querySelector("h3").textContent = title;
  statusPanel.querySelector("p").textContent = message;
}

function riskAnalyser(neo) {
  const diameterKm = Number.isFinite(neo.diameterKm) ? neo.diameterKm : null;
  const missKm = Number.isFinite(neo.missKm) ? neo.missKm : null;
  const velocityKph = Number.isFinite(neo.velocityKph) ? neo.velocityKph : null;
  const massKg = Number.isFinite(neo.massKg) ? neo.massKg : null;

  let score = 0;

  // Miss distance is the strongest driver.
  if (missKm !== null) {
    if (missKm < 50_000) score += 3;
    else if (missKm < 200_000) score += 2;
    else if (missKm < 1_000_000) score += 1;
  }

  // Larger objects raise risk.
  if (diameterKm !== null) {
    if (diameterKm >= 1.0) score += 3;
    else if (diameterKm >= 0.3) score += 2;
    else if (diameterKm >= 0.14) score += 1;
  }

  // Heavier objects increase potential impact.
  if (massKg !== null) {
    if (massKg >= 1e12) score += 2;
    else if (massKg >= 1e10) score += 1;
  }

  // Faster objects add a small bump.
  if (velocityKph !== null) {
    if (velocityKph >= 70_000) score += 1;
    else if (velocityKph <= 20_000) score -= 1;
  }

  // Preserve NASA's hazardous flag as a strong signal.
  if (neo.isHazardous) score += 2;

  // Ensure any miss distance under 1M km is at least Moderate (Medium).
  if (missKm !== null && missKm < 1_000_000 && score < 3) score = 3;

  if (score >= 6) return { label: "High", className: "high" };
  if (score >= 3) return { label: "Medium", className: "elevated" };
  return { label: "Low", className: "low" };
}

function normalizeData(data) {
  const payload = [];
  const objects = data?.near_earth_objects || {};

  Object.entries(objects).forEach(([dateKey, list]) => {
    list.forEach((neo) => {
      const approach = neo.close_approach_data?.[0] || {};
      const missKm = parseFloat(approach?.miss_distance?.kilometers);
      const velocity = parseFloat(approach?.relative_velocity?.kilometers_per_hour);
      const diameter = neo?.estimated_diameter?.kilometers?.estimated_diameter_max;
      const densityKgPerM3 = 3000;
      const radiusM = Number.isFinite(diameter) ? (diameter * 1000) / 2 : null;
      const massKg =
        radiusM !== null
          ? (4 / 3) * Math.PI * Math.pow(radiusM, 3) * densityKgPerM3
          : null;

      payload.push({
        id: neo.id,
        name: neo.name,
        magnitude: neo.absolute_magnitude_h,
        diameterKm: diameter,
        massKg,
        isHazardous: Boolean(neo.is_potentially_hazardous_asteroid),
        missKm: Number.isFinite(missKm) ? missKm : null,
        velocityKph: Number.isFinite(velocity) ? velocity : null,
        orbitingBody: approach?.orbiting_body || "Earth",
        approachDate: approach?.close_approach_date_full || approach?.close_approach_date || dateKey
      });
    });
  });

  payload.sort((a, b) => (a.missKm ?? Infinity) - (b.missKm ?? Infinity));
  return payload;
}

function updateStats(list) {
  const total = list.length;
  const hazardous = list.filter((neo) => neo.isHazardous).length;
  const closest = list.reduce((min, neo) => (neo.missKm !== null && neo.missKm < min ? neo.missKm : min), Infinity);
  const largest = list.reduce((max, neo) => (neo.diameterKm !== null && neo.diameterKm > max ? neo.diameterKm : max), 0);

  statTotal.textContent = formatNumber(total);
  statHazardous.textContent = formatNumber(hazardous);
  statClosest.textContent = Number.isFinite(closest) ? formatKm(closest) : "--";
  statLargest.textContent = largest ? `${formatNumber(largest, 3)} km` : "--";
}

function renderGrid(list) {
  neoGrid.innerHTML = "";
  if (!list.length) {
    setStatus(true, "No objects match the filters.", "Try changing the filter or search term.");
    return;
  }
  setStatus(false);

  const fragment = document.createDocumentFragment();
  list.forEach((neo) => {
    const hazard = riskAnalyser(neo);
    const card = document.createElement("article");
    card.className = "neo-card";
    const isTracked = trackedState.some((item) => String(item.neo_id || item.id) === String(neo.id));
    card.innerHTML = `
      <div class="neo-title">
        <h3>${neo.name}</h3>
        <span class="badge ${hazard.className}">${hazard.label} Risk</span>
      </div>
      <div class="neo-meta">
        <div>
          <span>Miss Distance</span>
          <strong>${formatKm(neo.missKm)}</strong>
        </div>
        <div>
          <span>Velocity</span>
          <strong>${neo.velocityKph ? `${formatNumber(neo.velocityKph, 0)} km/h` : "--"}</strong>
        </div>
        <div>
          <span>Diameter Max</span>
          <strong>${neo.diameterKm ? `${formatNumber(neo.diameterKm, 3)} km` : "--"}</strong>
        </div>
        <div>
          <span>Approach</span>
          <strong>${neo.approachDate || "--"}</strong>
        </div>
        <div>
          <span>Orbiting Body</span>
          <strong>${neo.orbitingBody}</strong>
        </div>
        <div>
          <span>Magnitude</span>
          <strong>${neo.magnitude ?? "--"}</strong>
        </div>
      </div>
      <button class="track-button ${isTracked ? "active" : ""}" data-track-id="${neo.id}" type="button">
        ${isTracked ? "Tracked" : "Track"}
      </button>
    `;
    fragment.appendChild(card);
  });

  neoGrid.appendChild(fragment);
}

function renderCloseApproaches(list) {
  closeApproachList.innerHTML = "";
  if (!list.length) return;

  const header = document.createElement("div");
  header.className = "approach-row header";
  header.innerHTML = `
    <div>Object</div>
    <div>Miss Distance</div>
    <div>Velocity</div>
    <div>Approach</div>
    <div>Hazard</div>
  `;
  closeApproachList.appendChild(header);

  const fragment = document.createDocumentFragment();
  list.slice(0, 8).forEach((neo) => {
    const hazard = riskAnalyser(neo);
    const row = document.createElement("div");
    row.className = "approach-row";
    row.innerHTML = `
      <div class="approach-cell">
        <strong>${neo.name}</strong>
        <span>ID ${neo.id}</span>
      </div>
      <div class="approach-cell">
        <strong>${formatKm(neo.missKm)}</strong>
        <span>Miss Distance</span>
      </div>
      <div class="approach-cell">
        <strong>${neo.velocityKph ? `${formatNumber(neo.velocityKph, 0)} km/h` : "--"}</strong>
        <span>Velocity</span>
      </div>
      <div class="approach-cell">
        <strong>${neo.approachDate || "--"}</strong>
        <span>Approach</span>
      </div>
      <div class="approach-cell">
        <strong>${hazard.label}</strong>
        <span>Hazard Level</span>
      </div>
    `;
    fragment.appendChild(row);
  });

  closeApproachList.appendChild(fragment);
}

function applyFilters() {
  let filtered = [...state.neos];

  if (state.filter === "hazardous") {
    filtered = filtered.filter((neo) => neo.isHazardous);
  }
  if (state.filter === "close") {
    filtered = filtered.filter((neo) => neo.missKm !== null && neo.missKm < 1_000_000);
  }
  if (state.search.trim()) {
    const query = state.search.trim().toLowerCase();
    filtered = filtered.filter((neo) =>
      neo.name.toLowerCase().includes(query) || neo.id.includes(query)
    );
  }

  renderGrid(filtered);
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function wireControls() {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter;
      applyFilters();
    });
  });

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    applyFilters();
  });


  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
    });
  });

  if (applyRangeButton) {
    applyRangeButton.addEventListener("click", () => {
      const startDate = startDateInput?.value;
      const endDate = endDateInput?.value;
      if (!startDate || !endDate) return;
      getNEOData(startDate, endDate);
    });
  }


  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      if (isSupabaseEnabled()) {
        await window.iatraSupabase.auth.signOut();
      } else {
        sessionStorage.removeItem("iatra_session");
      }
      window.location.href = "index.html";
    });
  }

  if (openSimulationButton && simulationModal) {
    openSimulationButton.addEventListener("click", () => {
      simulationModal.classList.add("show");
      startSimulation();
    });
  }

  if (closeSimulationButton && simulationModal) {
    closeSimulationButton.addEventListener("click", closeSimulation);
  }

  if (simulationModal) {
    simulationModal.addEventListener("click", (event) => {
      if (event.target === simulationModal) closeSimulation();
    });
  }

  if (neoGrid) {
    neoGrid.addEventListener("click", (event) => {
      const button = event.target.closest(".track-button");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.trackId;
      const neo = state.neos.find((item) => String(item.id) === String(id));
      if (!neo) return;
      toggleTrack(neo);
    });
  }

  if (trackedList) {
    trackedList.addEventListener("click", (event) => {
      const button = event.target.closest(".remove-button");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.trackId;
      removeTracked(id);
    });
  }
}

async function loadUserSession() {
  if (isSupabaseEnabled()) {
    try {
      const { data, error } = await window.iatraSupabase.auth.getSession();
      const session = data?.session;
      if (error || !session) {
        window.location.href = "index.html";
        return false;
      }
      currentUserEmail = session.user?.email || "";
      currentUserId = session.user?.id || "";
      const name = session.user?.user_metadata?.name || currentUserEmail || "Cadet";
      if (userNameEl) userNameEl.textContent = name;
      return true;
    } catch (error) {
      disableSupabase();
    }
  }

  const raw = sessionStorage.getItem("iatra_session");
  if (!raw) {
    window.location.href = "index.html";
    return false;
  }
  try {
    const session = JSON.parse(raw);
    const name = session?.name || session?.email || "Cadet";
    if (userNameEl) userNameEl.textContent = name;
    currentUserEmail = session?.email || "";
    return true;
  } catch (error) {
    sessionStorage.removeItem("iatra_session");
    window.location.href = "index.html";
    return false;
  }
}

function closeSimulation() {
  if (!simulationModal) return;
  simulationModal.classList.remove("show");
  stopSimulation();
}

function startSimulation() {
  if (!asteroidCanvas || !window.THREE) return;
  if (simulationState.renderer) return;

  const width = asteroidCanvas.clientWidth || 800;
  const height = asteroidCanvas.clientHeight || 420;
  const renderer = new THREE.WebGLRenderer({ canvas: asteroidCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05050a, 6, 14);
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
  camera.position.set(2.8, 1.6, 4.6);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0x9fb3ff, 0.32);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
  keyLight.position.set(3, 2, 5);
  keyLight.castShadow = false;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x87e9ff, 0.5);
  rimLight.position.set(-3, 1.2, -3);
  scene.add(rimLight);
  const fillLight = new THREE.PointLight(0xffc38a, 0.5, 12);
  fillLight.position.set(-2.2, -0.8, 1.2);
  scene.add(fillLight);

  const planets = [];
  const starField = createStarField();
  scene.add(starField);

  const earthGroup = new THREE.Group();
  const earthTexture = createEarthTexture();
  const earthNormal = createEarthNormalTexture();
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 48, 48),
    new THREE.MeshStandardMaterial({
      map: earthTexture,
      normalMap: earthNormal,
      roughness: 0.6,
      metalness: 0.05
    })
  );
  earthMesh.rotation.z = THREE.MathUtils.degToRad(23.5);
  earthGroup.add(earthMesh);
  scene.add(earthGroup);
  planets.push({ group: earthGroup, speed: 0.08, mesh: earthMesh });

  const asteroidBelt = createAsteroidBelt(42, 1.3, 2.2);
  scene.add(asteroidBelt.group);

  simulationState = {
    renderer,
    scene,
    camera,
    planets,
    starField,
    sun: null,
    orbitRing: null,
    planetGroup: null,
    asteroidBelt,
    frameId: null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    startTime: performance.now()
  };

  asteroidCanvas.addEventListener("pointerdown", onSimulationPointerDown);
  asteroidCanvas.addEventListener("pointermove", onSimulationPointerMove);
  asteroidCanvas.addEventListener("pointerup", onSimulationPointerUp);
  asteroidCanvas.addEventListener("pointerleave", onSimulationPointerUp);
  asteroidCanvas.addEventListener("wheel", onSimulationWheel, { passive: true });
  window.addEventListener("resize", onSimulationResize);

  animateSimulation();
}

function stopSimulation() {
  if (!simulationState.renderer) return;
  cancelAnimationFrame(simulationState.frameId);
  simulationState.renderer.dispose();
  if (simulationState.asteroidBelt) {
    simulationState.asteroidBelt.meshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    simulationState.asteroidBelt.group?.children?.forEach((child) => {
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) child.material.dispose?.();
    });
  }
  simulationState.planets?.forEach((planet) => {
    planet.mesh.geometry.dispose();
    planet.mesh.material.dispose();
  });
  simulationState.starField?.geometry?.dispose();
  simulationState.starField?.material?.dispose();
  simulationState.sun?.geometry?.dispose();
  simulationState.sun?.material?.dispose();
  simulationState.orbitRing?.geometry?.dispose();
  simulationState.orbitRing?.material?.dispose();

  asteroidCanvas.removeEventListener("pointerdown", onSimulationPointerDown);
  asteroidCanvas.removeEventListener("pointermove", onSimulationPointerMove);
  asteroidCanvas.removeEventListener("pointerup", onSimulationPointerUp);
  asteroidCanvas.removeEventListener("pointerleave", onSimulationPointerUp);
  asteroidCanvas.removeEventListener("wheel", onSimulationWheel);
  window.removeEventListener("resize", onSimulationResize);

  simulationState = {
    renderer: null,
    scene: null,
    camera: null,
    planets: [],
    starField: null,
    sun: null,
    orbitRing: null,
    planetGroup: null,
    asteroidBelt: null,
    frameId: null,
    dragging: false,
    lastX: 0,
    lastY: 0,
    startTime: 0
  };
}

function animateSimulation() {
  if (!simulationState.renderer) return;
  const { renderer, scene, camera, planets, startTime, starField, asteroidBelt, sun, planetGroup } = simulationState;
  const elapsed = (performance.now() - startTime) / 1000;

  planets.forEach((planet, index) => {
    const angle = elapsed * planet.speed + index;
    planet.mesh.rotation.y = angle * 1.5;
  });

  if (starField) {
    starField.rotation.y = elapsed * 0.01;
  }

  if (sun) {
    sun.rotation.y = elapsed * 0.12;
  }

  if (planetGroup) {
    planetGroup.rotation.y = elapsed * 0.08;
  }

  if (asteroidBelt) {
    asteroidBelt.group.rotation.y = elapsed * 0.08;
    asteroidBelt.meshes.forEach((mesh, index) => {
      mesh.rotation.y += 0.01 + index * 0.0002;
      mesh.rotation.x += 0.006 + index * 0.0001;
    });
  }
  renderer.render(scene, camera);
  simulationState.frameId = requestAnimationFrame(animateSimulation);
}

function createStarField() {
  const starCount = 1400;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  const color = new THREE.Color();
  for (let i = 0; i < starCount; i += 1) {
    const radius = 8 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const idx = i * 3;
    positions[idx] = radius * Math.sin(phi) * Math.cos(theta);
    positions[idx + 1] = radius * Math.cos(phi);
    positions[idx + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const temp = 0.65 + Math.random() * 0.35;
    color.setHSL(0.6, 0.2, temp);
    colors[idx] = color.r;
    colors[idx + 1] = color.g;
    colors[idx + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
}

function createSun() {
  const geometry = new THREE.SphereGeometry(0.55, 32, 32);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
  gradient.addColorStop(0, "#fff9c4");
  gradient.addColorStop(0.45, "#ffd57a");
  gradient.addColorStop(0.7, "#ff9f5a");
  gradient.addColorStop(1, "rgba(255, 120, 60, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending
    })
  );
}

function createOrbitRing(radius) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.78, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(120);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x6bd7ff,
    transparent: true,
    opacity: 0.18
  });
  return new THREE.LineLoop(geometry, material);
}

function createPlanet(radius, color, roughness = 0.85) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.05
    })
  );
}

function createAsteroidBelt(count, innerRadius, outerRadius) {
  const group = new THREE.Group();
  const texture = createAsteroidTexture();
  const meshes = [];

  for (let i = 0; i < count; i += 1) {
    const size = 0.035 + Math.random() * 0.075;
    const geometry = new THREE.IcosahedronGeometry(size, 2);
    const position = geometry.attributes.position;
    for (let j = 0; j < position.count; j += 1) {
      const x = position.getX(j);
      const y = position.getY(j);
      const z = position.getZ(j);
      const noise = 0.38 * Math.sin(x * 7.4) + 0.22 * Math.cos(y * 6.2) + 0.2 * Math.sin(z * 5.6);
      position.setXYZ(j, x + x * noise, y + y * noise, z + z * noise);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xb2b0a4,
      roughness: 0.92,
      metalness: 0.05
    });

    const mesh = new THREE.Mesh(geometry, material);
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const angle = Math.random() * Math.PI * 2;
    const tilt = (Math.random() - 0.5) * 0.4;
    mesh.position.set(Math.cos(angle) * radius, tilt, Math.sin(angle) * radius);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(mesh);
    meshes.push(mesh);
  }

  return { group, meshes };
}

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#0b2d5c");
  ocean.addColorStop(0.5, "#0f4a8a");
  ocean.addColorStop(1, "#0b1f3a");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(80, 180, 110, 0.9)";
  for (let i = 0; i < 22; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 30 + Math.random() * 80;
    const h = 18 + Math.random() * 50;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(30, 100, 40, 0.8)";
  for (let i = 0; i < 18; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 18 + Math.random() * 40;
    const h = 12 + Math.random() * 28;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  for (let i = 0; i < 35; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 40 + Math.random() * 90;
    const h = 12 + Math.random() * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEarthNormalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#7f7fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(110, 110, 255, 0.6)";
  for (let i = 0; i < 200; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 1 + Math.random() * 2.8;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createAsteroidTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#6e6a63";
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = Math.random() * 2.2;
    const shade = 80 + Math.random() * 90;
    ctx.fillStyle = `rgb(${shade}, ${shade - 10}, ${shade - 20})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 16; i += 1) {
    const x = 20 + Math.random() * 216;
    const y = 20 + Math.random() * 216;
    const radius = 8 + Math.random() * 18;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, "rgba(40, 36, 32, 0.7)");
    gradient.addColorStop(1, "rgba(120, 110, 100, 0.1)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function onSimulationPointerDown(event) {
  simulationState.dragging = true;
  simulationState.lastX = event.clientX;
  simulationState.lastY = event.clientY;
}

function onSimulationPointerMove(event) {
  if (!simulationState.dragging || !simulationState.asteroid) return;
  const deltaX = event.clientX - simulationState.lastX;
  const deltaY = event.clientY - simulationState.lastY;
  simulationState.asteroid.rotation.y += deltaX * 0.005;
  simulationState.asteroid.rotation.x += deltaY * 0.005;
  simulationState.lastX = event.clientX;
  simulationState.lastY = event.clientY;
}

function onSimulationPointerUp() {
  simulationState.dragging = false;
}

function onSimulationWheel(event) {
  if (!simulationState.camera) return;
  simulationState.camera.position.z = Math.min(8, Math.max(2.5, simulationState.camera.position.z + event.deltaY * 0.002));
}

function onSimulationResize() {
  if (!simulationState.renderer || !simulationState.camera || !asteroidCanvas) return;
  const width = asteroidCanvas.clientWidth || 800;
  const height = asteroidCanvas.clientHeight || 420;
  simulationState.camera.aspect = width / height;
  simulationState.camera.updateProjectionMatrix();
  simulationState.renderer.setSize(width, height, false);
}

async function loadTracked() {
  try {
    if (isSupabaseEnabled() && currentUserId) {
      const { data, error } = await window.iatraSupabase
        .from("tracked_asteroids")
        .select("*")
        .eq("user_id", currentUserId)
        .order("saved_at", { ascending: false });
      if (error) throw error;
      trackedState = Array.isArray(data) ? data : [];
    } else {
      const url = currentUserEmail ? `${TRACK_URL}?user=${encodeURIComponent(currentUserEmail)}` : TRACK_URL;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      trackedState = Array.isArray(data.tracked) ? data.tracked : [];
    }
  } catch (error) {
    trackedState = [];
  }
  renderTracked();
  applyFilters();
}

function renderTracked() {
  if (!trackedList) return;
  trackedList.innerHTML = "";
  if (!trackedState.length) {
    const empty = document.createElement("div");
    empty.className = "status-card";
    empty.textContent = "No tracked objects yet. Use the Track button on any asteroid.";
    trackedList.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className = "tracked-row header";
  header.innerHTML = `
    <div>Object</div>
    <div>Miss Distance</div>
    <div>Approach</div>
    <div>Hazard</div>
    <div>Actions</div>
  `;
  trackedList.appendChild(header);

  const fragment = document.createDocumentFragment();
  trackedState.forEach((item) => {
    const row = document.createElement("div");
    row.className = "tracked-row";
    const hazardLabel = item.hazardLabel || item.hazard_label || (item.isHazardous || item.is_hazardous ? "Hazardous" : "Nominal");
    row.innerHTML = `
      <div class="approach-cell">
        <strong>${item.name}</strong>
        <span>ID ${item.neo_id || item.id}</span>
      </div>
      <div class="approach-cell">
        <strong>${formatKm(item.miss_km ?? item.missKm)}</strong>
        <span>Miss Distance</span>
      </div>
      <div class="approach-cell">
        <strong>${item.approach_date || item.approachDate || "--"}</strong>
        <span>Approach</span>
      </div>
      <div class="approach-cell">
        <strong>${hazardLabel}</strong>
        <span>Hazard</span>
      </div>
      <div class="approach-cell">
        <button class="remove-button" data-track-id="${item.neo_id || item.id}" type="button">Remove</button>
      </div>
    `;
    fragment.appendChild(row);
  });
  trackedList.appendChild(fragment);
}

async function toggleTrack(neo) {
  const isTracked = trackedState.some((item) => String(item.neo_id || item.id) === String(neo.id));
  if (isTracked) {
    await removeTracked(neo.id);
    return;
  }

  try {
    const hazard = riskAnalyser(neo);
    if (isSupabaseEnabled() && currentUserId) {
      const { error } = await window.iatraSupabase.from("tracked_asteroids").insert([
        {
          user_id: currentUserId,
          neo_id: String(neo.id),
          name: neo.name,
          approach_date: neo.approachDate,
          miss_km: neo.missKm,
          is_hazardous: neo.isHazardous,
          hazard_label: hazard.label
        }
      ]);
      if (error) throw error;
      await loadTracked();
    } else {
      const response = await fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: neo.id,
          name: neo.name,
          approachDate: neo.approachDate,
          missKm: neo.missKm,
          isHazardous: neo.isHazardous,
          hazardLabel: hazard.label,
          user: currentUserEmail
        })
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      trackedState = Array.isArray(data.tracked) ? data.tracked : trackedState;
    }
    renderTracked();
    applyFilters();
  } catch (error) {
    console.error("TRACK ERROR:", error);
  }
}

async function removeTracked(id) {
  try {
    if (isSupabaseEnabled() && currentUserId) {
      const { error } = await window.iatraSupabase
        .from("tracked_asteroids")
        .delete()
        .eq("user_id", currentUserId)
        .eq("neo_id", String(id));
      if (error) throw error;
      await loadTracked();
    } else {
      const url = currentUserEmail
        ? `${TRACK_URL}/${id}?user=${encodeURIComponent(currentUserEmail)}`
        : `${TRACK_URL}/${id}`;
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      trackedState = Array.isArray(data.tracked) ? data.tracked : trackedState;
    }
    renderTracked();
    applyFilters();
  } catch (error) {
    console.error("TRACK REMOVE ERROR:", error);
  }
}

async function getNEOData(startDate, endDate) {
  try {
    const requestUrl = buildApiUrl(startDate, endDate);
    setStatus(true, "Fetching live data...", `Waiting for your local server at ${requestUrl}`);
    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    console.log(data)
    state.neos = normalizeData(data);
    await loadTracked();
    updateStats(state.neos);
    lastUpdated.textContent = new Date().toLocaleString();
    applyFilters();
    renderCloseApproaches(state.neos);
  } catch (error) {
    console.error("FETCH ERROR:", error);
    setStatus(true, "Unable to fetch NASA data.", "Check that your backend server is running and the API key is valid.");
  }
}

async function initDashboard() {
  const ok = await loadUserSession();
  if (!ok) return;
  const today = getTodayString();
  if (startDateInput && endDateInput) {
    startDateInput.value = today;
    endDateInput.value = today;
  }
  wireControls();
  await loadTracked();
  getNEOData(today, today);
}

initDashboard();
