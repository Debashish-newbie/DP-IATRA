const API_URL = "http://localhost:5000/api/asteroids";

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
const statusPanel = document.getElementById("statusPanel");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".chip");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

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

function hazardLevelFor(neo) {
  if (neo.isHazardous) return { label: "High", className: "high" };
  if (neo.missKm && neo.missKm < 1_000_000) return { label: "Elevated", className: "elevated" };
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

      payload.push({
        id: neo.id,
        name: neo.name,
        magnitude: neo.absolute_magnitude_h,
        diameterKm: diameter,
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
    const hazard = hazardLevelFor(neo);
    const card = document.createElement("article");
    card.className = "neo-card";
    card.innerHTML = `
      <div class="neo-title">
        <h3>${neo.name}</h3>
        <span class="badge ${hazard.className}">${hazard.label}</span>
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
    const hazard = hazardLevelFor(neo);
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
}

async function getNEOData() {
  try {
    setStatus(true, "Fetching live data...", `Waiting for your local server at ${API_URL}`);
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();

    state.neos = normalizeData(data);
    updateStats(state.neos);
    lastUpdated.textContent = new Date().toLocaleString();
    applyFilters();
    renderCloseApproaches(state.neos);
  } catch (error) {
    console.error("FETCH ERROR:", error);
    setStatus(true, "Unable to fetch NASA data.", "Check that your backend server is running and the API key is valid.");
  }
}

wireControls();
getNEOData();
