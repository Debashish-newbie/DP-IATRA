const USERS_URL = "users.json";
const STORAGE_KEY = "iatra_users_v1";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function loadStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read local users:", error);
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function mergeUsers(seedUsers, storedUsers) {
  const byEmail = new Map();
  [...seedUsers, ...storedUsers].forEach((user) => {
    const email = normalizeEmail(user.email);
    if (!email) return;
    byEmail.set(email, { ...user, email });
  });
  return Array.from(byEmail.values());
}

async function loadUsers() {
  try {
    const response = await fetch(USERS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const seedUsers = Array.isArray(data.users) ? data.users : [];
    const storedUsers = loadStoredUsers();
    return mergeUsers(seedUsers, storedUsers);
  } catch (error) {
    console.error("Failed to load users.json:", error);
    return loadStoredUsers();
  }
}

function setMessage(element, text, tone = "info") {
  if (!element) return;
  element.textContent = text;
  element.dataset.tone = tone;
}

function redirectToDashboard() {
  window.location.href = "dashboard.html";
}

async function handleLogin(event) {
  event.preventDefault();
  const messageEl = document.getElementById("loginMessage");
  const email = normalizeEmail(document.getElementById("loginEmail")?.value);
  const password = document.getElementById("loginPassword")?.value?.trim();

  if (!email || !password) {
    setMessage(messageEl, "Enter both email and password.", "warn");
    return;
  }

  const users = await loadUsers();
  const user = users.find((entry) => normalizeEmail(entry.email) === email);

  if (!user) {
    setMessage(messageEl, "Account not found. Try again or use the signup link.", "warn");
    return;
  }

  if (user.password !== password) {
    setMessage(messageEl, "Incorrect password. Try again.", "error");
    return;
  }

  sessionStorage.setItem("iatra_session", JSON.stringify({
    email: user.email,
    name: user.name || "Cadet"
  }));
  setMessage(messageEl, "Access granted. Loading dashboard...", "success");
  setTimeout(redirectToDashboard, 800);
}

async function handleSignup(event) {
  event.preventDefault();
  const messageEl = document.getElementById("signupMessage");
  const name = document.getElementById("signupName")?.value?.trim();
  const email = normalizeEmail(document.getElementById("signupEmail")?.value);
  const password = document.getElementById("signupPassword")?.value?.trim();

  if (!name || !email || !password) {
    setMessage(messageEl, "Complete all fields to continue.", "warn");
    return;
  }

  const users = await loadUsers();
  const exists = users.some((entry) => normalizeEmail(entry.email) === email);

  if (exists) {
    setMessage(messageEl, "Profile already exists. Please login instead.", "error");
    return;
  }

  const storedUsers = loadStoredUsers();
  storedUsers.push({ name, email, password });
  saveStoredUsers(storedUsers);

  setMessage(messageEl, "Profile created. Redirecting to dashboard...", "success");
  setTimeout(redirectToDashboard, 800);
}

function wireAuthForms() {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }
}

wireAuthForms();
