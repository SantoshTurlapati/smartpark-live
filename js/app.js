const ADMIN_ACCOUNT = {
  name: "Administrator",
  email: "admin@smartpark.com",
  password: "admin123",
  role: "admin"
};

const STORAGE_KEYS = {
  users: "smartpark_users",
  locations: "smartpark_locations",
  bookings: "smartpark_bookings",
  notifications: "smartpark_notifications",
  support: "smartpark_support",
  session: "smartpark_session"
};

let activeUser = null;
let activeSection = "overview";
let ownerMap = null;
let customerMap = null;
let ownerCoordinates = null;
let editingLocationId = null;
let selectedSlotsLocationId = null;
let customerMapMode = "list";
let customerCoordinates = null;
let pendingConfirmation = null;
let toastCounter = 0;

function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message, type = "success") {
  const region = document.getElementById("toast-region");
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  const id = ++toastCounter;
  toast.dataset.toastId = String(id);
  region.appendChild(toast);

  window.setTimeout(() => {
    const currentToast = region.querySelector(`[data-toast-id="${id}"]`);
    if (currentToast) currentToast.remove();
  }, 4500);
}

function readArray(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    showToast(`Could not read demo data (${error.message}).`, "error");
    return [];
  }

  if (!raw) return [];

  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) return value;
    showToast(`Stored data for ${key} is invalid.`, "error");
  } catch (error) {
    showToast(`Could not parse stored data for ${key}: ${error.message}`, "error");
  }

  return [];
}

function writeArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast(`Could not save demo data (${error.message}).`, "error");
    return false;
  }
}

function getUsers() {
  return readArray(STORAGE_KEYS.users);
}

function saveUsers(users) {
  return writeArray(STORAGE_KEYS.users, users);
}

function getBookings() {
  return readArray(STORAGE_KEYS.bookings);
}

function saveBookings(bookings) {
  return writeArray(STORAGE_KEYS.bookings, bookings);
}

function getSupportRequests() {
  return readArray(STORAGE_KEYS.support);
}

function saveSupportRequests(requests) {
  return writeArray(STORAGE_KEYS.support, requests);
}

function getNotifications() {
  return readArray(STORAGE_KEYS.notifications);
}

function saveNotifications(notifications) {
  return writeArray(STORAGE_KEYS.notifications, notifications);
}

function getLocations() {
  const locations = readArray(STORAGE_KEYS.locations);
  let changed = false;

  locations.forEach(location => {
    if (!Array.isArray(location.slots)) {
      const total = Math.max(0, Math.floor(Number(location.totalSlots) || 0));
      const available = Math.max(0, Math.min(
        total,
        Math.floor(Number(location.availableSlots) || 0)
      ));
      const occupied = total - available;
      location.slots = Array.from({ length: total }, (_, index) => ({
        id: `S${String(index + 1).padStart(3, "0")}`,
        status: index < occupied ? "Booked" : "Available"
      }));
      changed = true;
    }

    if (!location.status) {
      location.status = "Pending";
      changed = true;
    }

    const total = location.slots.length;
    const available = location.slots.filter(slot => slot.status === "Available").length;
    if (Number(location.totalSlots) !== total ||
      Number(location.availableSlots) !== available) {
      location.totalSlots = total;
      location.availableSlots = available;
      changed = true;
    }
  });

  if (changed) writeArray(STORAGE_KEYS.locations, locations);
  return locations;
}

function saveLocations(locations) {
  locations.forEach(location => {
    location.totalSlots = location.slots.length;
    location.availableSlots = location.slots.filter(
      slot => slot.status === "Available"
    ).length;
  });
  return writeArray(STORAGE_KEYS.locations, locations);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHTML(value) :
    date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function todayString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function notifyUser(email, message) {
  if (!email) return;
  const notifications = getNotifications();
  notifications.unshift({
    id: createId(),
    email,
    message,
    createdAt: new Date().toISOString(),
    read: false
  });
  saveNotifications(notifications);
}

function getCurrentSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(STORAGE_KEYS.session);
    showToast(`Saved session was invalid: ${error.message}`, "error");
    return null;
  }

  if (!session || !session.email || !session.role) {
    localStorage.removeItem(STORAGE_KEYS.session);
    return null;
  }

  if (session.role === "admin" && session.email === ADMIN_ACCOUNT.email) {
    return { ...ADMIN_ACCOUNT };
  }

  const user = getUsers().find(account =>
    account.email === session.email && account.role === session.role
  );
  if (!user || user.accountStatus === "Suspended") {
    localStorage.removeItem(STORAGE_KEYS.session);
    return null;
  }

  return user;
}

function saveSession(user) {
  try {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role
    }));
    return true;
  } catch (error) {
    showToast(`Could not save this demo session (${error.message}).`, "error");
    return false;
  }
}

function showPage(pageId) {
  const page = document.getElementById(pageId);
  if (!page) {
    showToast("That page is not available.", "error");
    return;
  }

  document.querySelectorAll(".page").forEach(item => item.classList.add("hidden"));
  page.classList.remove("hidden");
  closePublicNav();

  if (pageId === "login-page") {
    window.setTimeout(() => document.getElementById("login-email").focus(), 0);
  }
}

function closePublicNav() {
  const nav = document.getElementById("public-nav-links");
  const toggle = document.querySelector(".mobile-nav-toggle");
  if (nav) nav.classList.remove("is-open");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.textContent = visible ? "Hide" : "Show";
  button.setAttribute("aria-pressed", String(visible));
}

const THEME_STORAGE_KEY = "smartpark-theme";
let hasExplicitTheme = Boolean(localStorage.getItem(THEME_STORAGE_KEY));

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.colorScheme = normalizedTheme;

  document.querySelectorAll('[data-action="toggle-theme"]').forEach(button => {
    const isDark = normalizedTheme === "dark";
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("aria-pressed", String(isDark));
  });
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(savedTheme || systemTheme);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
    if (!hasExplicitTheme) applyTheme(event.matches ? "dark" : "light");
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  hasExplicitTheme = true;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  showToast(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
}

function openModal(title, content, actions = "") {
  const backdrop = document.getElementById("app-modal-backdrop");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-content").innerHTML = content;
  document.getElementById("modal-actions").innerHTML = actions;
  backdrop.classList.remove("hidden");
  backdrop.setAttribute("aria-hidden", "false");
  const firstInput = backdrop.querySelector("input, select, textarea, button");
  if (firstInput) firstInput.focus();
}

function closeModal() {
  const backdrop = document.getElementById("app-modal-backdrop");
  if (!backdrop) return;
  backdrop.classList.add("hidden");
  backdrop.setAttribute("aria-hidden", "true");
  document.getElementById("modal-content").innerHTML = "";
  document.getElementById("modal-actions").innerHTML = "";
  pendingConfirmation = null;
}

function askConfirmation(title, message, callback) {
  pendingConfirmation = callback;
  openModal(
    title,
    `<p>${escapeHTML(message)}</p>`,
    `<button class="btn btn-outline" type="button" data-action="cancel-confirmation">Cancel</button>
     <button class="btn btn-danger" type="button" data-action="confirm-action">Confirm</button>`
  );
}

function confirmPendingAction() {
  const action = pendingConfirmation;
  closeModal();
  if (action) action();
}

function renderPasswordReset() {
  openModal(
    "Reset demo password",
    `<p class="demo-note">This frontend demo cannot verify your identity or send email.</p>
     <form id="reset-password-form" class="stack-form">
       <label for="reset-email">Account email</label>
       <input id="reset-email" name="email" type="email" required autocomplete="email">
       <label for="reset-password">New password</label>
       <input id="reset-password" name="password" type="password" required minlength="8">
       <label for="reset-confirm-password">Confirm new password</label>
       <input id="reset-confirm-password" name="confirmPassword" type="password" required minlength="8">
       <button class="btn" type="submit">Update demo password</button>
     </form>`
  );
}

function handleAppClick(event) {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    event.preventDefault();
    showPage(pageButton.dataset.page);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  event.preventDefault();

  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id;
  const email = actionButton.dataset.email;

  switch (action) {
    case "toggle-theme":
      toggleTheme();
      break;
    case "toggle-nav": {
      const nav = document.getElementById("public-nav-links");
      const open = nav.classList.toggle("is-open");
      actionButton.setAttribute("aria-expanded", String(open));
      break;
    }
    case "toggle-dashboard-nav": {
      const sidebar = document.querySelector(".dashboard-sidebar");
      const open = sidebar.classList.toggle("is-open");
      actionButton.setAttribute("aria-expanded", String(open));
      break;
    }
    case "toggle-password":
      togglePassword(actionButton.dataset.target, actionButton);
      break;
    case "go-home":
      showPage("home-page");
      break;
    case "forgot-password":
      renderPasswordReset();
      break;
    case "close-modal":
      closeModal();
      break;
    case "confirm-action":
      confirmPendingAction();
      break;
    case "cancel-confirmation":
      closeModal();
      break;
    case "logout":
      logout();
      break;
    case "dashboard-section":
      renderDashboard(actionButton.dataset.section);
      break;
    case "refresh-db-data":
      loadDatabaseData();
      break;
    case "locate-nearby":
      locateCustomer();
      break;
    case "customer-view":
      customerMapMode = actionButton.dataset.view;
      renderCustomerResults();
      break;
    case "view-location":
      showLocationDetails(id);
      break;
    case "begin-booking":
      showBookingForm(id);
      break;
    case "cancel-booking":
      cancelBooking(id);
      break;
    case "start-location-form":
      editingLocationId = null;
      renderDashboard("locations");
      break;
    case "edit-location":
      editingLocationId = id;
      renderDashboard("locations");
      break;
    case "save-location-cancel":
      editingLocationId = null;
      ownerCoordinates = null;
      renderDashboard("locations");
      break;
    case "delete-location":
      deleteLocation(id);
      break;
    case "manage-location-slots":
      selectedSlotsLocationId = id;
      renderDashboard("slots");
      break;
    case "owner-booking-transition":
      transitionOwnerBooking(id);
      break;
    case "admin-location-status":
      changeLocationStatus(id, actionButton.dataset.status);
      break;
    case "admin-owner-verification":
      changeOwnerVerification(email, actionButton.dataset.status);
      break;
    case "admin-user-status":
      changeUserStatus(email, actionButton.dataset.status);
      break;
    case "admin-support-status":
      changeSupportStatus(id, actionButton.dataset.status);
      break;
    case "admin-support-reply":
      showSupportReply(id);
      break;
    case "mark-all-notifications":
      markAllNotificationsRead();
      break;
    default:
      break;
  }
}

function handleAppInput(event) {
  if (event.target.matches("[data-customer-filter]")) {
    renderCustomerResults();
  }
}

function handleAppChange(event) {
  if (event.target.matches("[data-customer-filter]")) {
    renderCustomerResults();
    return;
  }

  if (event.target.matches("[data-slot-status]")) {
    setSlotStatus(
      event.target.dataset.locationId,
      event.target.dataset.slotId,
      event.target.value
    );
    return;
  }

  if (event.target.id === "owner-slot-location") {
    selectedSlotsLocationId = event.target.value;
    renderDashboard("slots");
  }
}

function handleAppSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();

  switch (form.id) {
    case "login-form":
      login(form);
      break;
    case "register-form":
      register(form);
      break;
    case "reset-password-form":
      resetPassword(form);
      break;
    case "contact-form":
      sendContactEmail(form);
      break;
    case "profile-form":
      updateProfile(form);
      break;
    case "change-password-form":
      changePassword(form);
      break;
    case "location-form":
      saveLocation(form);
      break;
    case "booking-form":
      createBooking(form);
      break;
    case "complaint-form":
      submitSupportRequest(form);
      break;
    case "support-reply-form":
      saveSupportReply(form);
      break;
    default:
      break;
  }
}

async function login(form) {
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const role = form.elements.role.value;
  try {
    const response = await smartParkApi.login({ email, password, role });
    smartParkApi.setToken(response.token);
    activeUser = {
      id: response.id,
      name: response.name,
      email: response.email,
      role: response.role,
      accountStatus: response.accountStatus,
      ownerVerification: response.ownerVerification
    };
    saveSession(activeUser);
    openDashboard("overview");
  } catch (error) {
    showMessage("login-message", error.message, "error");
  }
}

async function register(form) {
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const confirmPassword = form.elements.confirmPassword.value;
  const role = form.elements.role.value;

  if (name.length < 2) {
    showMessage("register-message", "Enter a name with at least 2 characters.", "error");
    return;
  }
  if (password.length < 8) {
    showMessage("register-message", "Use a password with at least 8 characters.", "error");
    return;
  }
  if (password !== confirmPassword) {
    showMessage("register-message", "The passwords do not match.", "error");
    return;
  }
  if (!["customer", "owner"].includes(role)) {
    showMessage("register-message", "Choose a valid account type.", "error");
    return;
  }

  try {
    await smartParkApi.register({ name, email, password, role });
    showMessage("register-message", "Account created. You can now sign in.", "success");
    form.reset();
  } catch (error) {
    showMessage("register-message", error.message, "error");
  }
}

function resetPassword(form) {
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const confirmPassword = form.elements.confirmPassword.value;

  if (password.length < 8 || password !== confirmPassword) {
    showToast("Use at least 8 characters and make sure both passwords match.", "error");
    return;
  }

  const users = getUsers();
  const user = users.find(account => account.email.toLowerCase() === email);
  if (!user) {
    showToast("No demo account was found for that email.", "error");
    return;
  }

  user.password = password;
  if (!saveUsers(users)) return;
  closeModal();
  showToast("Demo password updated. No email verification was performed.");
}

function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = message;
  element.className = `message message-${type}`;
  element.setAttribute("role", type === "error" ? "alert" : "status");
}

function openDashboard(section = "overview") {
  if (!activeUser) {
    showPage("login-page");
    return;
  }

  showPage("dashboard-page");
  renderDashboard(section);
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.session);
  smartParkApi.clearToken();
  activeUser = null;
  editingLocationId = null;
  ownerCoordinates = null;
  destroyMaps();
  showPage("home-page");
  showToast("You have signed out.");
}

function renderDashboard(section = activeSection) {
  if (!activeUser) return;

  activeSection = section;
  destroyMaps();
  const role = activeUser.role;
  const content = role === "customer" ?
    customerSection(section) :
    role === "owner" ?
      ownerSection(section) :
      adminSection(section);
  const root = document.getElementById("dashboard-root");
  root.innerHTML = dashboardShell(role, section, content);

  if (role === "customer" && ["overview", "locations"].includes(section)) {
    renderCustomerResults();
  }
  if (role === "owner" && section === "locations") {
    initializeOwnerMap();
  }
  if (section === "data") {
    loadDatabaseData();
  }
}

function dashboardMenu(role) {
  const common = [
    ["overview", "Overview"],
    ["notifications", "Notifications"],
    ["profile", "Profile & Settings"],
    ["support", "Support"]
  ];
  const menus = {
    customer: [...common.slice(0, 1), ["locations", "Find Parking"], ["bookings", "My Bookings"], ["data", "Live Data"], ...common.slice(1)],
    owner: [...common.slice(0, 1), ["locations", "My Locations"], ["slots", "Manage Slots"], ["bookings", "Bookings"], ["reports", "Revenue & Reports"], ["data", "Live Data"], ...common.slice(1)],
    admin: [...common.slice(0, 1), ["approvals", "Approvals"], ["locations", "Locations"], ["users", "Users"], ["bookings", "Bookings"], ["reports", "Reports"], ["data", "Live Data"], ["support", "Support"], ["notifications", "Notifications"], ["profile", "Profile"]]
  };
  return menus[role] || menus.customer;
}

function dashboardShell(role, section, content) {
  const menu = dashboardMenu(role).map(([key, label]) => `
    <button type="button" class="dashboard-nav-button ${section === key ? "active" : ""}"
      data-action="dashboard-section" data-section="${key}">
      <span>${escapeHTML(label)}</span>
      ${key === "notifications" && unreadNotificationCount() ?
        `<span class="notification-count">${unreadNotificationCount()}</span>` : ""}
    </button>
  `).join("");
  const roleLabel = role === "owner" ? "Parking Owner" :
    role.charAt(0).toUpperCase() + role.slice(1);

  return `
    <div class="dashboard-layout">
      <aside class="dashboard-sidebar">
        <a class="brand-link dashboard-brand" href="#home" data-action="go-home">
          <span class="brand-mark">P</span><span>SmartPark AI</span>
        </a>
        <div class="dashboard-user-card">
          <span class="user-avatar">${escapeHTML((activeUser.name || "U").slice(0, 1).toUpperCase())}</span>
          <div><strong>${escapeHTML(activeUser.name)}</strong><small>${escapeHTML(roleLabel)}</small></div>
        </div>
        <nav class="dashboard-nav" aria-label="${escapeHTML(roleLabel)} navigation">
          ${menu}
        </nav>
        <p class="sidebar-demo-note">Use Live Data to fetch shared database records.</p>
        <button type="button" class="btn btn-outline sidebar-logout" data-action="logout">Sign Out</button>
      </aside>
      <main class="dashboard-main">
        <header class="dashboard-topbar">
          <button type="button" class="mobile-nav-toggle dashboard-nav-toggle"
            data-action="toggle-dashboard-nav" aria-expanded="false">Menu</button>
          <div><span class="eyebrow">${escapeHTML(roleLabel)} WORKSPACE</span>
          <h1>${escapeHTML(sectionTitle(section))}</h1></div>
          <button type="button" class="icon-button" data-action="dashboard-section"
            data-section="notifications" aria-label="Open notifications">🔔
            ${unreadNotificationCount() ? `<span class="notification-count">${unreadNotificationCount()}</span>` : ""}
          </button>
        </header>
        ${activeUser.role === "owner" && activeUser.ownerVerification !== "Verified" ?
          `<p class="notice notice-warning">Owner verification: ${escapeHTML(activeUser.ownerVerification || "Pending")}. Admin approval is still required.</p>` : ""}
        <div class="dashboard-content">${content}</div>
      </main>
    </div>
  `;
}

function sectionTitle(section) {
  const titles = {
    overview: "Overview",
    locations: "Parking Locations",
    bookings: "Bookings",
    slots: "Manage Slots",
    reports: "Reports & Analytics",
    approvals: "Approval Queue",
    users: "User Management",
    support: "Support Requests",
    notifications: "Notifications",
    profile: "Profile & Settings",
    data: "Live Database Data"
  };
  return titles[section] || "Overview";
}

function databaseDataPage() {
  return `<section class="section-card">
    <div class="section-heading">
      <div><h2>Shared database records</h2>
      <p>Fetch the latest records available to your account from the Spring Boot and MySQL backend.</p></div>
      <button class="btn" type="button" data-action="refresh-db-data">Refresh data</button>
    </div>
    <div id="database-data-panel" aria-live="polite"><p>Loading database records…</p></div>
  </section>`;
}

function renderDatabaseTable(title, records, columns) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) {
    return `<section class="section-card"><h2>${escapeHTML(title)} (0)</h2>
      <div class="empty-state">No records were returned for this account.</div></section>`;
  }

  const headings = columns.map(column => `<th>${escapeHTML(column.label)}</th>`).join("");
  const body = rows.map(record => `
    <tr>${columns.map(column => `<td>${escapeHTML(column.value(record))}</td>`).join("")}</tr>
    <tr><td colspan="${columns.length}">
      <details class="database-record-details">
        <summary>View full record details</summary>
        <pre>${escapeHTML(JSON.stringify(record, null, 2))}</pre>
      </details>
    </td></tr>
  `).join("");

  return `<section class="section-card">
    <h2>${escapeHTML(title)} (${rows.length})</h2>
    <div class="table-scroll"><table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

function displayDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function loadDatabaseData() {
  const panel = document.getElementById("database-data-panel");
  if (!panel) return;
  panel.innerHTML = "<p>Fetching records from the shared database…</p>";

  try {
    const data = await smartParkApi.dashboardData();
    if (!panel.isConnected) return;

    const locationColumns = [
      { label: "Location", value: item => item.name || "—" },
      { label: "City", value: item => item.city || "—" },
      { label: "Owner", value: item => item.ownerEmail || "—" },
      { label: "Status", value: item => item.status || "—" },
      { label: "Availability", value: item => `${item.availableSlots || 0}/${item.totalSlots || 0}` },
      { label: "Hourly rate", value: item => formatCurrency(item.pricePerHour) }
    ];
    const bookingColumns = [
      { label: "Customer", value: item => item.customerEmail || "—" },
      { label: "Location", value: item => item.locationName || "—" },
      { label: "Slot", value: item => item.slotId || "—" },
      { label: "Vehicle", value: item => item.vehicleNumber || "—" },
      { label: "Start", value: item => displayDateTime(item.startTime) },
      { label: "End", value: item => displayDateTime(item.endTime) },
      { label: "Status", value: item => item.status || "—" },
      { label: "Amount", value: item => formatCurrency(item.amount) },
      { label: "Payment", value: item => item.paymentStatus || "—" }
    ];
    const paymentColumns = [
      { label: "Payment ID", value: item => item.id || "—" },
      { label: "Booking ID", value: item => item.bookingId || "—" },
      { label: "Amount", value: item => formatCurrency(item.amount) },
      { label: "Status", value: item => item.status || "—" },
      { label: "Provider", value: item => item.provider || "—" },
      { label: "Created", value: item => displayDateTime(item.createdAt) }
    ];
    const userColumns = [
      { label: "Name", value: item => item.name || "—" },
      { label: "Email", value: item => item.email || "—" },
      { label: "Role", value: item => item.role || "—" },
      { label: "Account status", value: item => item.accountStatus || "—" },
      { label: "Owner verification", value: item => item.ownerVerification || "—" },
      { label: "Created", value: item => displayDateTime(item.createdAt) }
    ];

    panel.innerHTML = [
      `<p class="demo-note">${activeUser.role === "admin" ? "Administrator view: all users and records." : "Privacy note: your account sees only its own user, booking and payment records."}</p>`,
      renderDatabaseTable("Parking locations and slots", data.locations, locationColumns),
      renderDatabaseTable("Bookings", data.bookings, bookingColumns),
      renderDatabaseTable("Payments", data.payments, paymentColumns),
      renderDatabaseTable(activeUser.role === "admin" ? "User accounts" : "Your account", data.users, userColumns)
    ].join("");
  } catch (error) {
    if (!panel.isConnected) return;
    panel.innerHTML = `<div class="notice notice-warning" role="alert">
      Could not fetch database records: ${escapeHTML(error.message)}
      <button class="btn btn-small" type="button" data-action="refresh-db-data">Try again</button>
    </div>`;
  }
}

function unreadNotificationCount() {
  if (!activeUser) return 0;
  return getNotifications().filter(item =>
    item.email === activeUser.email && !item.read
  ).length;
}

function customerSection(section) {
  switch (section) {
    case "data": return databaseDataPage();
    case "locations": return customerLocationsPage();
    case "bookings": return customerBookingsPage();
    case "notifications": return notificationsPage();
    case "profile": return profilePage();
    case "support": return supportPage();
    default: return customerOverview();
  }
}

function customerOverview() {
  const locations = getLocations();
  const approved = locations.filter(location => location.status === "Approved");
  const availableSlots = approved.reduce(
    (sum, location) => sum + location.availableSlots, 0
  );
  const bookings = getBookings().filter(booking =>
    booking.customerEmail === activeUser.email
  );

  return `
    <section class="welcome-panel">
      <div><span class="eyebrow">YOUR PARKING, SIMPLIFIED</span>
      <h2>Welcome, ${escapeHTML(activeUser.name)}</h2>
      <p>Find an approved space, reserve a slot and manage your visit.</p></div>
      <button class="btn" type="button" data-action="dashboard-section" data-section="locations">Find Parking</button>
    </section>
    <div class="stats-grid">
      ${statCard("Approved Locations", approved.length, "Bookable locations")}
      ${statCard("Available Slots", availableSlots, "Across approved locations")}
      ${statCard("My Bookings", bookings.length, "All booking statuses")}
    </div>
    ${customerLocationsPanel()}
  `;
}

function customerLocationsPage() {
  return `
    <section class="section-card">
      <div class="section-heading">
        <div><h2>Find Parking</h2><p>Search all owner-submitted locations; only approved locations can be booked.</p></div>
      </div>
      ${customerLocationsPanel()}
    </section>
  `;
}

function customerLocationsPanel() {
  const resultsId = "customer-parking-results";
  return `
    <div class="filter-panel">
      <label class="field-grow">Search
        <input id="customer-search" data-customer-filter type="search" placeholder="Parking name or address">
      </label>
      <label>Minimum available slots
        <input id="customer-min-slots" data-customer-filter type="number" min="0" value="0">
      </label>
      <label>Max price per hour
        <input id="customer-max-price" data-customer-filter type="number" min="0" placeholder="Any">
      </label>
      <label>Sort by
        <select id="customer-sort" data-customer-filter>
          <option value="recommended">Recommended</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="distance">Nearest first</option>
        </select>
      </label>
      <label class="checkbox-field"><input id="customer-available-only" data-customer-filter type="checkbox"> Approved with slots only</label>
      <div class="nearby-controls">
        <button class="btn btn-secondary" type="button" data-action="locate-nearby">Use my location</button>
        <label>Radius
          <select id="customer-radius" data-customer-filter>
            <option value="5">5 km</option><option value="10" selected>10 km</option>
            <option value="25">25 km</option><option value="50">50 km</option>
          </select>
        </label>
        <span id="customer-distance-state" class="muted-text">${customerCoordinates ? "Nearby search enabled" : "Location optional"}</span>
      </div>
    </div>
    <div class="view-toggle" role="group" aria-label="Parking results view">
      <button type="button" class="btn ${customerMapMode === "list" ? "" : "btn-secondary"}"
        data-action="customer-view" data-view="list">List</button>
      <button type="button" class="btn ${customerMapMode === "map" ? "" : "btn-secondary"}"
        data-action="customer-view" data-view="map">Map</button>
    </div>
    <div id="customer-map" class="parking-map ${customerMapMode === "map" ? "" : "hidden"}"></div>
    <div id="${resultsId}" class="customer-parking-grid ${customerMapMode === "list" ? "" : "hidden"}"></div>
  `;
}

function renderCustomerResults() {
  const results = document.getElementById("customer-parking-results");
  if (!results) return;

  const term = (document.getElementById("customer-search")?.value || "").trim().toLowerCase();
  const minSlots = Math.max(0, Number(document.getElementById("customer-min-slots")?.value) || 0);
  const maxPriceInput = document.getElementById("customer-max-price")?.value;
  const maxPrice = maxPriceInput === "" || maxPriceInput == null ?
    Number.POSITIVE_INFINITY : Math.max(0, Number(maxPriceInput));
  const availableOnly = document.getElementById("customer-available-only")?.checked || false;
  const radius = Number(document.getElementById("customer-radius")?.value) || 10;

  let locations = getLocations().filter(location => {
    const matchesText = `${location.name} ${location.address}`.toLowerCase().includes(term);
    const matchesAvailability = !availableOnly ||
      (location.status === "Approved" && location.availableSlots > 0);
    return matchesText &&
      location.availableSlots >= minSlots &&
      Number(location.price) <= maxPrice &&
      matchesAvailability;
  });

  if (customerCoordinates) {
    locations = locations.map(location => ({
      ...location,
      distanceKm: distanceBetween(
        customerCoordinates.latitude,
        customerCoordinates.longitude,
        Number(location.latitude),
        Number(location.longitude)
      )
    }));
    locations = locations.filter(location =>
      Number.isFinite(location.distanceKm) && location.distanceKm <= radius
    );
  }

  const sort = document.getElementById("customer-sort")?.value || "recommended";
  if (sort === "price-low") locations.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === "price-high") locations.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === "distance" && customerCoordinates) {
    locations.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  if (!locations.length) {
    results.innerHTML = `<div class="empty-state"><strong>No matching parking locations.</strong><p>Try changing your search or filters.</p></div>`;
  } else {
    results.innerHTML = locations.map(location => customerParkingCard(location)).join("");
  }

  const mapElement = document.getElementById("customer-map");
  if (mapElement) {
    const showMap = customerMapMode === "map";
    mapElement.classList.toggle("hidden", !showMap);
    results.classList.toggle("hidden", showMap);
    if (showMap) {
      renderCustomerMap(locations);
    } else if (customerMap) {
      customerMap.remove();
      customerMap = null;
    }
  }
}

function customerParkingCard(location) {
  const bookable = location.status === "Approved" && location.availableSlots > 0;
  const statusClass = String(location.status || "Pending").toLowerCase();
  return `
    <article class="parking-card customer-parking-card">
      <div class="card-title-row"><h3>${escapeHTML(location.name)}</h3>
        <span class="status-badge status-${escapeHTML(statusClass)}">${escapeHTML(location.status)}</span>
      </div>
      <p>📍 ${escapeHTML(location.address)}</p>
      <p>🅿️ ${location.availableSlots} of ${location.totalSlots} slots available</p>
      <p class="price-line">${formatCurrency(location.price)} <small>per hour</small></p>
      ${Number.isFinite(location.distanceKm) ? `<p>${location.distanceKm.toFixed(1)} km away</p>` : ""}
      <div class="card-actions">
        <button type="button" class="btn btn-secondary" data-action="view-location" data-id="${escapeHTML(location.id)}">Details</button>
        <button type="button" class="btn" data-action="begin-booking" data-id="${escapeHTML(location.id)}"
          ${bookable ? "" : "disabled"}>${bookable ? "Book a Slot" : location.status !== "Approved" ? "Awaiting Approval" : "Full"}</button>
      </div>
    </article>
  `;
}

function renderCustomerMap(locations) {
  const element = document.getElementById("customer-map");
  if (!element) return;
  if (customerMap) {
    customerMap.remove();
    customerMap = null;
  }
  if (typeof L === "undefined") {
    element.innerHTML = `<p class="empty-state">Map library unavailable. Use the list view.</p>`;
    return;
  }

  customerMap = L.map(element).setView([16.5062, 80.6480], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(customerMap);

  const mappedLocations = locations.filter(location =>
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
  );
  mappedLocations.forEach(location => {
    const popup = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = location.name;
    const address = document.createElement("p");
    address.textContent = location.address;
    const status = document.createElement("p");
    status.textContent = `${location.status} · ${location.availableSlots} slots`;
    const details = document.createElement("button");
    details.type = "button";
    details.className = "btn btn-small";
    details.dataset.action = "view-location";
    details.dataset.id = String(location.id);
    details.textContent = "Details";
    popup.append(title, address, status, details);

    L.marker([Number(location.latitude), Number(location.longitude)])
      .addTo(customerMap)
      .bindPopup(popup);
  });
  if (mappedLocations.length) {
    customerMap.fitBounds(L.latLngBounds(mappedLocations.map(location => [
      Number(location.latitude), Number(location.longitude)
    ])), { padding: [30, 30] });
  }
  window.setTimeout(() => customerMap && customerMap.invalidateSize(), 100);
}

function locateCustomer() {
  if (!navigator.geolocation) {
    showToast("Location is unavailable in this browser.", "error");
    return;
  }

  const button = document.querySelector('[data-action="locate-nearby"]');
  if (button?.disabled) return;
  const distanceState = document.getElementById("customer-distance-state");
  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    button.textContent = "Locating...";
  }
  if (distanceState) distanceState.textContent = "Finding your location...";

  navigator.geolocation.getCurrentPosition(position => {
    customerCoordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.setAttribute("aria-busy", "false");
      button.textContent = "Use my location";
    }
    if (distanceState) distanceState.textContent = "Nearby search enabled";
    renderCustomerResults();
    showToast("Nearby parking search is ready.");
  }, error => {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.setAttribute("aria-busy", "false");
      button.textContent = "Use my location";
    }
    if (distanceState) distanceState.textContent = "Location unavailable";
    showToast(`Could not get your location: ${error.message}`, "error");
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

function distanceBetween(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.NaN;
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showLocationDetails(locationId) {
  const location = getLocations().find(item => String(item.id) === String(locationId));
  if (!location) {
    showToast("Parking location was not found.", "error");
    return;
  }

  const facilities = Array.isArray(location.facilities) ? location.facilities : [];
  const content = `
    <dl class="details-list">
      <dt>Address</dt><dd>${escapeHTML(location.address)}</dd>
      <dt>Approval</dt><dd>${escapeHTML(location.status)}</dd>
      <dt>Availability</dt><dd>${location.availableSlots} of ${location.totalSlots} slots</dd>
      <dt>Rate</dt><dd>${formatCurrency(location.price)} per hour</dd>
      <dt>Operating hours</dt><dd>${escapeHTML(location.openingTime || "—")}–${escapeHTML(location.closingTime || "—")}</dd>
      <dt>Facilities</dt><dd>${facilities.length ? facilities.map(escapeHTML).join(", ") : "Not specified"}</dd>
    </dl>`;
  const actions = location.status === "Approved" && location.availableSlots > 0 ?
    `<button type="button" class="btn" data-action="begin-booking" data-id="${escapeHTML(location.id)}">Choose a Slot</button>` :
    `<span class="muted-text">Booking is available after approval and when a slot is free.</span>`;
  openModal(location.name, content, actions);
}

function showBookingForm(locationId) {
  const location = getLocations().find(item => String(item.id) === String(locationId));
  if (!location || location.status !== "Approved" || location.availableSlots < 1) {
    showToast("This location is not currently bookable.", "error");
    return;
  }

  const availableSlots = location.slots.filter(slot => slot.status === "Available");
  const slotOptions = availableSlots.map(slot =>
    `<option value="${escapeHTML(slot.id)}">${escapeHTML(slot.id)}</option>`
  ).join("");
  openModal(
    `Book ${location.name}`,
    `<p>Hourly rate: <strong>${formatCurrency(location.price)}</strong>. Select a date, time and available slot.</p>
     <form id="booking-form" class="stack-form" data-location-id="${escapeHTML(location.id)}">
       <label for="booking-date">Date</label><input id="booking-date" name="date" type="date" min="${todayString()}" value="${todayString()}" required>
       <div class="form-grid">
         <div><label for="booking-start">Start time</label><input id="booking-start" name="startTime" type="time" value="09:00" required></div>
         <div><label for="booking-end">End time</label><input id="booking-end" name="endTime" type="time" value="10:00" required></div>
       </div>
       <label for="booking-slot">Parking slot</label><select id="booking-slot" name="slotId" required>${slotOptions}</select>
       <label for="booking-vehicle">Vehicle plate</label><input id="booking-vehicle" name="vehicle" maxlength="20" required placeholder="e.g. ABC-1234">
       <button class="btn" type="submit">Confirm Booking</button>
     </form>`
  );
}

function createBooking(form) {
  const locationId = form.dataset.locationId;
  const locations = getLocations();
  const location = locations.find(item => String(item.id) === String(locationId));
  if (!location || location.status !== "Approved") {
    showToast("This parking location is no longer available.", "error");
    closeModal();
    return;
  }

  const date = form.elements.date.value;
  const startTime = form.elements.startTime.value;
  const endTime = form.elements.endTime.value;
  const vehicle = form.elements.vehicle.value.trim().toUpperCase();
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (!date || date < todayString() || endMinutes <= startMinutes || !vehicle) {
    showToast("Choose a valid date, time range and vehicle plate.", "error");
    return;
  }

  const slot = location.slots.find(item =>
    item.id === form.elements.slotId.value && item.status === "Available"
  );
  if (!slot) {
    showToast("That slot was just taken. Choose another available slot.", "error");
    closeModal();
    renderDashboard(activeSection);
    return;
  }

  const durationHours = Math.ceil((endMinutes - startMinutes) / 30) / 2;
  const hourlyRate = Number(location.price);
  const totalPrice = hourlyRate * durationHours;
  slot.status = "Booked";

  const booking = {
    id: createId(),
    customerEmail: activeUser.email,
    parkingId: location.id,
    parkingName: location.name,
    address: location.address,
    slotId: slot.id,
    vehicle,
    date,
    startTime,
    endTime,
    durationHours,
    hourlyRate,
    price: totalPrice,
    bookingDate: new Date().toISOString(),
    status: "Booked"
  };

  const bookings = getBookings();
  bookings.unshift(booking);
  if (!saveLocations(locations) || !saveBookings(bookings)) return;

  const owner = getUsers().find(user => user.email === location.ownerEmail);
  if (owner) notifyUser(owner.email, `New booking for ${location.name}, slot ${slot.id}.`);
  notifyUser(activeUser.email, `Booking confirmed for ${location.name}, slot ${slot.id}.`);
  closeModal();
  showToast(`Booking confirmed. Estimated total: ${formatCurrency(totalPrice)}.`);
  renderDashboard("bookings");
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return -1;
  return hours * 60 + minutes;
}

function customerBookingsPage() {
  const bookings = getBookings().filter(booking =>
    booking.customerEmail === activeUser.email
  );
  if (!bookings.length) return `<div class="empty-state"><h2>No bookings yet</h2><p>Your reservations will show here.</p><button class="btn" data-action="dashboard-section" data-section="locations">Find Parking</button></div>`;

  return `<section class="section-card"><div class="section-heading"><div><h2>Booking history</h2><p>Track reservations, cancellations and completed visits.</p></div></div>
    <div class="booking-list">${bookings.map(booking => {
      const canCancel = booking.status === "Booked";
      return `<article class="booking-card">
        <div class="card-title-row"><h3>${escapeHTML(booking.parkingName)}</h3><span class="status-badge status-${escapeHTML(booking.status.toLowerCase())}">${escapeHTML(booking.status)}</span></div>
        <p>${escapeHTML(booking.address)} · Slot ${escapeHTML(booking.slotId || "—")}</p>
        <p>${escapeHTML(booking.date || "—")} · ${escapeHTML(booking.startTime || "—")}–${escapeHTML(booking.endTime || "—")}</p>
        <p>Vehicle: ${escapeHTML(booking.vehicle || "—")} · Estimated total: ${formatCurrency(booking.price)}</p>
        ${canCancel ? `<button type="button" class="btn btn-danger" data-action="cancel-booking" data-id="${escapeHTML(booking.id)}">Cancel Booking</button>` : ""}
      </article>`;
    }).join("")}</div></section>`;
}

function cancelBooking(bookingId) {
  const bookings = getBookings();
  const booking = bookings.find(item => String(item.id) === String(bookingId));
  if (!booking || booking.customerEmail !== activeUser.email || booking.status !== "Booked") {
    showToast("This booking can no longer be cancelled.", "error");
    return;
  }

  askConfirmation("Cancel booking?", `Cancel the reservation at ${booking.parkingName}?`, () => {
    booking.status = "Cancelled";
    booking.cancelledAt = new Date().toISOString();
    const locations = getLocations();
    const location = locations.find(item => String(item.id) === String(booking.parkingId));
    const slot = location?.slots.find(item => item.id === booking.slotId);
    if (slot && slot.status === "Booked") slot.status = "Available";
    if (!saveBookings(bookings) || !saveLocations(locations)) return;
    notifyUser(booking.customerEmail, `Booking for ${booking.parkingName} was cancelled.`);
    const owner = getUsers().find(user => user.email === location?.ownerEmail);
    if (owner) notifyUser(owner.email, `A booking for ${booking.parkingName} was cancelled.`);
    showToast("Booking cancelled.");
    renderDashboard("bookings");
  });
}

function ownerSection(section) {
  switch (section) {
    case "data": return databaseDataPage();
    case "locations": return ownerLocationsPage();
    case "slots": return ownerSlotsPage();
    case "bookings": return ownerBookingsPage();
    case "reports": return ownerReportsPage();
    case "notifications": return notificationsPage();
    case "profile": return profilePage();
    case "support": return supportPage();
    default: return ownerOverview();
  }
}

function ownedLocations() {
  return getLocations().filter(location => location.ownerEmail === activeUser.email);
}

function ownerOverview() {
  const locations = ownedLocations();
  const locationIds = locations.map(location => String(location.id));
  const bookings = getBookings().filter(booking =>
    locationIds.includes(String(booking.parkingId))
  );
  const completedRevenue = bookings
    .filter(booking => booking.status === "Completed")
    .reduce((sum, booking) => sum + Number(booking.price || 0), 0);

  return `
    <section class="welcome-panel">
      <div><span class="eyebrow">OWNER WORKSPACE</span><h2>Manage your parking business</h2>
      <p>Update spaces, handle arrivals and review estimated revenue.</p></div>
      <button class="btn" data-action="start-location-form">Add Location</button>
    </section>
    <div class="stats-grid">
      ${statCard("My Locations", locations.length, "All approval statuses")}
      ${statCard("Available Slots", locations.reduce((sum, location) => sum + location.availableSlots, 0), "Across your locations")}
      ${statCard("Active Bookings", bookings.filter(booking => ["Booked", "Entered"].includes(booking.status)).length, "Booked or checked in")}
      ${statCard("Completed Revenue", formatCurrency(completedRevenue), "Demo estimate")}
    </div>
    <section class="section-card"><h2>Quick actions</h2><div class="quick-actions">
      <button class="btn btn-secondary" data-action="dashboard-section" data-section="locations">Manage Locations</button>
      <button class="btn btn-secondary" data-action="dashboard-section" data-section="bookings">Manage Bookings</button>
      <button class="btn btn-secondary" data-action="dashboard-section" data-section="reports">View Reports</button>
    </div></section>`;
}

function ownerLocationsPage() {
  const locations = ownedLocations();
  const editing = locations.find(location => String(location.id) === String(editingLocationId));

  return `
    <section class="section-card">
      <div class="section-heading"><div><h2>${editing ? "Edit Location" : "Add a Location"}</h2><p>Choose the location on the map and set capacity and facilities.</p></div>
      ${editing ? `<button class="btn btn-outline" data-action="save-location-cancel">Cancel Edit</button>` : ""}</div>
      <form id="location-form" class="form-card wide-form" data-location-id="${editing ? escapeHTML(editing.id) : ""}">
        <div class="form-grid">
          <div><label for="location-name">Parking name</label><input id="location-name" name="name" required maxlength="100" value="${escapeHTML(editing?.name || "")}"></div>
          <div><label for="location-address">Address</label><input id="location-address" name="address" required maxlength="180" value="${escapeHTML(editing?.address || "")}"></div>
          <div><label for="location-total">Total spaces</label><input id="location-total" name="totalSlots" type="number" min="1" max="500" required value="${editing ? Number(editing.totalSlots) : 10}"></div>
          <div><label for="location-price">Price per hour (₹)</label><input id="location-price" name="price" type="number" min="0" step="0.5" required value="${editing ? Number(editing.price) : 20}"></div>
          <div><label for="location-opening">Opening time</label><input id="location-opening" name="openingTime" type="time" value="${escapeHTML(editing?.openingTime || "06:00")}"></div>
          <div><label for="location-closing">Closing time</label><input id="location-closing" name="closingTime" type="time" value="${escapeHTML(editing?.closingTime || "23:00")}"></div>
        </div>
        <fieldset class="facility-picker"><legend>Facilities</legend>
          ${["Covered", "Security", "EV Charging", "Accessible", "CCTV", "Restrooms"].map(facility =>
            `<label class="checkbox-field"><input type="checkbox" name="facility" value="${facility}" ${editing?.facilities?.includes(facility) ? "checked" : ""}>${facility}</label>`
          ).join("")}
        </fieldset>
        <p id="owner-coordinates" class="muted-text">${editing ? `Current coordinates: ${Number(editing.latitude).toFixed(5)}, ${Number(editing.longitude).toFixed(5)}. Click map to change.` : "Click the map to select the parking location."}</p>
        <div id="owner-map" class="parking-map"></div>
        <button class="btn" type="submit">${editing ? "Save Changes" : "Submit for Approval"}</button>
      </form>
    </section>
    <section class="section-card"><div class="section-heading"><div><h2>My Locations</h2><p>${locations.length} location${locations.length === 1 ? "" : "s"}</p></div></div>
      ${locations.length ? `<div class="card-grid">${locations.map(ownerLocationCard).join("")}</div>` :
        `<div class="empty-state"><p>No locations yet. Add your first parking location above.</p></div>`}
    </section>`;
}

function ownerLocationCard(location) {
  return `<article class="parking-card">
    <div class="card-title-row"><h3>${escapeHTML(location.name)}</h3><span class="status-badge status-${escapeHTML(location.status.toLowerCase())}">${escapeHTML(location.status)}</span></div>
    <p>${escapeHTML(location.address)}</p><p>${location.availableSlots} of ${location.totalSlots} slots available</p>
    <p>${formatCurrency(location.price)}/hour · ${escapeHTML(location.openingTime || "—")}–${escapeHTML(location.closingTime || "—")}</p>
    <div class="card-actions">
      <button class="btn btn-secondary" data-action="edit-location" data-id="${escapeHTML(location.id)}">Edit</button>
      <button class="btn btn-secondary" data-action="manage-location-slots" data-id="${escapeHTML(location.id)}">Slots</button>
      <button class="btn btn-danger" data-action="delete-location" data-id="${escapeHTML(location.id)}">Delete</button>
    </div>
  </article>`;
}

function initializeOwnerMap() {
  const element = document.getElementById("owner-map");
  if (!element || typeof L === "undefined") return;

  const editing = getLocations().find(location =>
    String(location.id) === String(editingLocationId)
  );
  const startingPoint = ownerCoordinates ||
    (editing ? [Number(editing.latitude), Number(editing.longitude)] : [16.5062, 80.6480]);

  ownerMap = L.map(element).setView(startingPoint, editing ? 16 : 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(ownerMap);

  if (editing && !ownerCoordinates) {
    L.marker(startingPoint).addTo(ownerMap).bindPopup("Current location");
  }
  ownerMap.on("click", event => {
    ownerCoordinates = [event.latlng.lat, event.latlng.lng];
    const label = document.getElementById("owner-coordinates");
    if (label) label.textContent = `Selected: ${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`;
    if (ownerMap.selectedMarker) ownerMap.removeLayer(ownerMap.selectedMarker);
    ownerMap.selectedMarker = L.marker(ownerCoordinates).addTo(ownerMap);
  });
  window.setTimeout(() => ownerMap && ownerMap.invalidateSize(), 100);
}

function saveLocation(form) {
  const locations = getLocations();
  const locationId = form.dataset.locationId;
  const existing = locationId ? locations.find(item =>
    String(item.id) === String(locationId) && item.ownerEmail === activeUser.email
  ) : null;
  const name = form.elements.name.value.trim();
  const address = form.elements.address.value.trim();
  const total = Math.floor(Number(form.elements.totalSlots.value));
  const price = Number(form.elements.price.value);
  const coordinates = ownerCoordinates ||
    (existing ? [Number(existing.latitude), Number(existing.longitude)] : null);

  if (!name || !address || !Number.isInteger(total) || total < 1 || total > 500 ||
    !Number.isFinite(price) || price < 0 || !coordinates) {
    showToast("Enter valid details and select a map location.", "error");
    return;
  }

  const occupiedSlots = existing ?
    existing.slots.filter(slot => ["Booked", "Entered"].includes(slot.status)).length : 0;
  if (total < occupiedSlots) {
    showToast(`Total spaces cannot be below ${occupiedSlots} active bookings.`, "error");
    return;
  }

  const facilities = Array.from(form.querySelectorAll('input[name="facility"]:checked'))
    .map(input => input.value);
  let location;
  if (existing) {
    location = existing;
    resizeSlots(location, total);
    Object.assign(location, {
      name, address, price,
      latitude: coordinates[0],
      longitude: coordinates[1],
      openingTime: form.elements.openingTime.value,
      closingTime: form.elements.closingTime.value,
      facilities,
      updatedAt: new Date().toISOString()
    });
  } else {
    const slots = Array.from({ length: total }, (_, index) => ({
      id: `S${String(index + 1).padStart(3, "0")}`,
      status: "Available"
    }));
    location = {
      id: Date.now(),
      ownerEmail: activeUser.email,
      name,
      address,
      totalSlots: total,
      availableSlots: total,
      price,
      latitude: coordinates[0],
      longitude: coordinates[1],
      openingTime: form.elements.openingTime.value,
      closingTime: form.elements.closingTime.value,
      facilities,
      slots,
      status: "Pending",
      createdAt: new Date().toISOString()
    };
    locations.unshift(location);
  }

  if (!saveLocations(locations)) return;
  notifyUser(ADMIN_ACCOUNT.email, `${existing ? "Updated" : "New"} location submitted: ${name}.`);
  editingLocationId = null;
  ownerCoordinates = null;
  showToast(existing ? "Location updated." : "Location submitted for admin approval.");
  renderDashboard("locations");
}

function resizeSlots(location, target) {
  const current = location.slots.length;
  if (target > current) {
    for (let index = current; index < target; index++) {
      location.slots.push({
        id: `S${String(index + 1).padStart(3, "0")}`,
        status: "Available"
      });
    }
  } else if (target < current) {
    let removeCount = current - target;
    for (let index = location.slots.length - 1; index >= 0 && removeCount > 0; index--) {
      if (["Available", "Out of Service"].includes(location.slots[index].status)) {
        location.slots.splice(index, 1);
        removeCount--;
      }
    }
  }
  location.totalSlots = location.slots.length;
  location.availableSlots = location.slots.filter(slot => slot.status === "Available").length;
}

function deleteLocation(locationId) {
  askConfirmation("Delete location?", "This permanently removes the location from this browser.", () => {
    const locations = getLocations();
    const location = locations.find(item =>
      String(item.id) === String(locationId) && item.ownerEmail === activeUser.email
    );
    if (!location) return;

    const hasActiveBookings = getBookings().some(booking =>
      String(booking.parkingId) === String(locationId) &&
      ["Booked", "Entered"].includes(booking.status)
    );
    if (hasActiveBookings) {
      showToast("Complete or cancel active bookings before deleting this location.", "error");
      return;
    }
    saveLocations(locations.filter(item => item !== location));
    showToast("Location deleted.");
    renderDashboard("locations");
  });
}

function ownerSlotsPage() {
  const locations = ownedLocations();
  if (!locations.length) return `<div class="empty-state"><h2>No locations to manage</h2><button class="btn" data-action="dashboard-section" data-section="locations">Add Location</button></div>`;
  if (!locations.some(location => String(location.id) === String(selectedSlotsLocationId))) {
    selectedSlotsLocationId = String(locations[0].id);
  }
  const selected = locations.find(location => String(location.id) === String(selectedSlotsLocationId));
  const bookings = getBookings();

  return `<section class="section-card">
    <div class="section-heading"><div><h2>Individual slot status</h2><p>Booked or occupied slots are controlled by booking check-in/out.</p></div>
      <label>Location <select id="owner-slot-location">${locations.map(location =>
        `<option value="${escapeHTML(location.id)}" ${String(location.id) === String(selected.id) ? "selected" : ""}>${escapeHTML(location.name)}</option>`
      ).join("")}</select></label>
    </div>
    <div class="slot-grid">${selected.slots.map(slot => {
      const activeBooking = bookings.find(booking =>
        String(booking.parkingId) === String(selected.id) &&
        booking.slotId === slot.id &&
        ["Booked", "Entered"].includes(booking.status)
      );
      return `<article class="slot-item">
        <strong>${escapeHTML(slot.id)}</strong>
        <span class="status-badge status-${escapeHTML(slot.status.toLowerCase().replaceAll(" ", "-"))}">${escapeHTML(slot.status)}</span>
        <label class="sr-only" for="slot-${escapeHTML(slot.id)}">Change ${escapeHTML(slot.id)} status</label>
        <select id="slot-${escapeHTML(slot.id)}" data-slot-status data-location-id="${escapeHTML(selected.id)}" data-slot-id="${escapeHTML(slot.id)}" ${activeBooking ? "disabled" : ""}>
          <option value="Available" ${slot.status === "Available" ? "selected" : ""}>Available</option>
          <option value="Out of Service" ${slot.status === "Out of Service" ? "selected" : ""}>Out of Service</option>
        </select>
        ${activeBooking ? `<small>Booking ${escapeHTML(activeBooking.id)} in progress</small>` : ""}
      </article>`;
    }).join("")}</div>
  </section>`;
}

function setSlotStatus(locationId, slotId, status) {
  if (!["Available", "Out of Service"].includes(status)) return;
  const locations = getLocations();
  const location = locations.find(item =>
    String(item.id) === String(locationId) && item.ownerEmail === activeUser.email
  );
  const slot = location?.slots.find(item => item.id === slotId);
  if (!slot) return;
  const activeBooking = getBookings().some(booking =>
    String(booking.parkingId) === String(locationId) &&
    booking.slotId === slotId &&
    ["Booked", "Entered"].includes(booking.status)
  );
  if (activeBooking) {
    showToast("A slot with an active booking cannot be changed.", "error");
    renderDashboard("slots");
    return;
  }
  slot.status = status;
  saveLocations(locations);
  showToast(`${slotId} marked ${status.toLowerCase()}.`);
  renderDashboard("slots");
}

function ownerBookingsPage() {
  const locationIds = ownedLocations().map(location => String(location.id));
  const bookings = getBookings().filter(booking =>
    locationIds.includes(String(booking.parkingId))
  );
  if (!bookings.length) return `<div class="empty-state"><h2>No bookings yet</h2><p>Customer reservations for your locations will appear here.</p></div>`;

  return `<section class="section-card"><div class="table-scroll"><table>
    <thead><tr><th>Parking / Slot</th><th>Customer</th><th>Visit</th><th>Vehicle</th><th>Estimate</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${bookings.map(booking => `<tr>
      <td>${escapeHTML(booking.parkingName)}<br><small>${escapeHTML(booking.slotId || "—")}</small></td>
      <td>${escapeHTML(booking.customerEmail)}</td>
      <td>${escapeHTML(booking.date || "—")}<br>${escapeHTML(booking.startTime || "—")}–${escapeHTML(booking.endTime || "—")}</td>
      <td>${escapeHTML(booking.vehicle || "—")}</td>
      <td>${formatCurrency(booking.price)}</td>
      <td><span class="status-badge status-${escapeHTML(booking.status.toLowerCase())}">${escapeHTML(booking.status)}</span></td>
      <td>${booking.status === "Booked" ?
        `<button class="btn btn-small" data-action="owner-booking-transition" data-id="${escapeHTML(booking.id)}">Vehicle Entry</button>` :
        booking.status === "Entered" ?
          `<button class="btn btn-small" data-action="owner-booking-transition" data-id="${escapeHTML(booking.id)}">Vehicle Exit</button>` :
          "—"}</td>
    </tr>`).join("")}</tbody>
  </table></div></section>`;
}

function transitionOwnerBooking(bookingId) {
  const bookings = getBookings();
  const booking = bookings.find(item => String(item.id) === String(bookingId));
  if (!booking || !["Booked", "Entered"].includes(booking.status)) return;
  const locations = getLocations();
  const location = locations.find(item =>
    String(item.id) === String(booking.parkingId) && item.ownerEmail === activeUser.email
  );
  if (!location) {
    showToast("This booking is not for one of your locations.", "error");
    return;
  }

  const entering = booking.status === "Booked";
  const nextStatus = entering ? "Entered" : "Completed";
  askConfirmation(entering ? "Vehicle entry" : "Vehicle exit",
    `${entering ? "Check in" : "Complete the visit for"} ${booking.vehicle || "this vehicle"}?`, () => {
      booking.status = nextStatus;
      booking[entering ? "enteredAt" : "exitedAt"] = new Date().toISOString();
      const slot = location.slots.find(item => item.id === booking.slotId);
      if (slot) slot.status = entering ? "Entered" : "Available";
      if (!saveBookings(bookings) || !saveLocations(locations)) return;
      notifyUser(booking.customerEmail, `${booking.parkingName} booking status: ${nextStatus}.`);
      showToast(`Vehicle ${entering ? "checked in" : "checked out"}.`);
      renderDashboard("bookings");
    });
}

function ownerReportsPage() {
  const ids = ownedLocations().map(location => String(location.id));
  const bookings = getBookings().filter(booking => ids.includes(String(booking.parkingId)));
  const completed = bookings.filter(booking => booking.status === "Completed");
  const revenue = completed.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  const pendingRevenue = bookings.filter(booking => booking.status === "Booked")
    .reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  return `<div class="stats-grid">
    ${statCard("Completed visits", completed.length, "Demo records")}
    ${statCard("Completed revenue", formatCurrency(revenue), "Estimated from bookings")}
    ${statCard("Reserved value", formatCurrency(pendingRevenue), "Not collected payment")}
  </div>
  <section class="section-card"><h2>Bookings by status</h2>${renderBars(statusCounts(bookings))}</section>
  <section class="section-card"><h2>Revenue note</h2><p>These are estimates based on the booking duration and hourly rate. No payment is processed.</p></section>`;
}

function adminSection(section) {
  switch (section) {
    case "data": return databaseDataPage();
    case "approvals": return adminApprovalsPage();
    case "locations": return adminLocationsPage();
    case "users": return adminUsersPage();
    case "bookings": return adminBookingsPage();
    case "reports": return adminReportsPage();
    case "support": return adminSupportPage();
    case "notifications": return notificationsPage();
    case "profile": return profilePage();
    default: return adminOverview();
  }
}

function adminOverview() {
  const users = getUsers();
  const locations = getLocations();
  const bookings = getBookings();
  const support = getSupportRequests();
  const revenue = bookings.filter(booking => booking.status === "Completed")
    .reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  return `<section class="welcome-panel"><div><span class="eyebrow">ADMIN CONTROL CENTER</span>
    <h2>System overview</h2><p>Review demo users, parking operations and support.</p></div></section>
    <div class="stats-grid">
      ${statCard("Customers", users.filter(user => user.role === "customer").length, "Registered accounts")}
      ${statCard("Owners awaiting verification", users.filter(user => user.role === "owner" && user.ownerVerification !== "Verified").length, "Review owner accounts")}
      ${statCard("Pending locations", locations.filter(location => location.status === "Pending").length, "Require approval")}
      ${statCard("Bookings", bookings.length, "All statuses")}
      ${statCard("Open support", support.filter(item => item.status !== "Resolved").length, "Need a response")}
      ${statCard("Completed revenue", formatCurrency(revenue), "Demo estimate")}
    </div>
    <section class="section-card"><div class="section-heading"><div><h2>Parking status</h2><p>Locations by approval state.</p></div></div>${renderBars(statusCounts(locations, "status"))}</section>
    <div class="quick-actions">
      <button class="btn" data-action="dashboard-section" data-section="approvals">Review Approvals</button>
      <button class="btn btn-secondary" data-action="dashboard-section" data-section="support">Open Support</button>
    </div>`;
}

function adminApprovalsPage() {
  const owners = getUsers().filter(user => user.role === "owner" && user.ownerVerification !== "Verified");
  const locations = getLocations().filter(location => location.status === "Pending");
  return `<section class="section-card"><div class="section-heading"><div><h2>Owner verification</h2><p>Verify owner accounts before they manage a full portfolio.</p></div></div>
    ${owners.length ? `<div class="card-grid">${owners.map(user => `<article class="parking-card"><h3>${escapeHTML(user.name)}</h3><p>${escapeHTML(user.email)}</p><p>Status: ${escapeHTML(user.ownerVerification || "Pending")}</p><div class="card-actions">
      <button class="btn" data-action="admin-owner-verification" data-email="${escapeHTML(user.email)}" data-status="Verified">Verify</button>
      <button class="btn btn-danger" data-action="admin-owner-verification" data-email="${escapeHTML(user.email)}" data-status="Rejected">Reject</button>
    </div></article>`).join("")}</div>` : `<div class="empty-state">No owner verifications pending.</div>`}
  </section>
  <section class="section-card"><div class="section-heading"><div><h2>Location approvals</h2><p>Approve or reject submitted parking locations.</p></div></div>
    ${locations.length ? `<div class="card-grid">${locations.map(location => `<article class="parking-card"><h3>${escapeHTML(location.name)}</h3><p>${escapeHTML(location.address)}</p><p>Owner: ${escapeHTML(location.ownerEmail)}</p><p>${location.totalSlots} slots · ${formatCurrency(location.price)}/hour</p><div class="card-actions">
      <button class="btn" data-action="admin-location-status" data-id="${escapeHTML(location.id)}" data-status="Approved">Approve</button>
      <button class="btn btn-danger" data-action="admin-location-status" data-id="${escapeHTML(location.id)}" data-status="Rejected">Reject</button>
    </div></article>`).join("")}</div>` : `<div class="empty-state">No location approvals pending.</div>`}
  </section>`;
}

function adminLocationsPage() {
  const locations = getLocations();
  if (!locations.length) return `<div class="empty-state"><h2>No parking locations</h2><p>Owner submissions appear here.</p></div>`;
  return `<section class="section-card"><div class="table-scroll"><table><thead><tr><th>Location</th><th>Owner</th><th>Address</th><th>Slots</th><th>Rate</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${locations.map(location => `<tr><td>${escapeHTML(location.name)}</td><td>${escapeHTML(location.ownerEmail)}</td><td>${escapeHTML(location.address)}</td><td>${location.availableSlots}/${location.totalSlots}</td><td>${formatCurrency(location.price)}</td><td>${escapeHTML(location.status)}</td><td>
      <button class="btn btn-small" data-action="admin-location-status" data-id="${escapeHTML(location.id)}" data-status="Approved">Approve</button>
      <button class="btn btn-small btn-danger" data-action="admin-location-status" data-id="${escapeHTML(location.id)}" data-status="Rejected">Reject</button>
    </td></tr>`).join("")}</tbody></table></div></section>`;
}

function adminUsersPage() {
  const users = getUsers();
  if (!users.length) return `<div class="empty-state"><h2>No registered users yet</h2></div>`;
  return `<section class="section-card"><div class="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Owner verification</th><th>Account</th><th>Action</th></tr></thead><tbody>
    ${users.map(user => `<tr><td>${escapeHTML(user.name)}</td><td>${escapeHTML(user.email)}</td><td>${escapeHTML(user.role)}</td><td>${escapeHTML(user.ownerVerification || "—")}</td><td>${escapeHTML(user.accountStatus || "Active")}</td><td>
      <button class="btn btn-small ${user.accountStatus === "Suspended" ? "" : "btn-danger"}" data-action="admin-user-status" data-email="${escapeHTML(user.email)}" data-status="${user.accountStatus === "Suspended" ? "Active" : "Suspended"}">${user.accountStatus === "Suspended" ? "Reactivate" : "Suspend"}</button>
      ${user.role === "owner" && user.ownerVerification !== "Verified" ? `<button class="btn btn-small" data-action="admin-owner-verification" data-email="${escapeHTML(user.email)}" data-status="Verified">Verify Owner</button>` : ""}
    </td></tr>`).join("")}
  </tbody></table></div></section>`;
}

function adminBookingsPage() {
  const bookings = getBookings();
  if (!bookings.length) return `<div class="empty-state"><h2>No bookings yet</h2></div>`;
  return `<section class="section-card"><div class="table-scroll"><table><thead><tr><th>Customer</th><th>Location / Slot</th><th>Date & time</th><th>Vehicle</th><th>Estimate</th><th>Status</th></tr></thead><tbody>
    ${bookings.map(booking => `<tr><td>${escapeHTML(booking.customerEmail)}</td><td>${escapeHTML(booking.parkingName)}<br>${escapeHTML(booking.slotId || "—")}</td><td>${escapeHTML(booking.date || formatDate(booking.bookingDate))}<br>${escapeHTML(booking.startTime || "—")}–${escapeHTML(booking.endTime || "—")}</td><td>${escapeHTML(booking.vehicle || "—")}</td><td>${formatCurrency(booking.price)}</td><td>${escapeHTML(booking.status)}</td></tr>`).join("")}
  </tbody></table></div></section>`;
}

function adminReportsPage() {
  const users = getUsers();
  const locations = getLocations();
  const bookings = getBookings();
  const totalSlots = locations.reduce((sum, location) => sum + location.totalSlots, 0);
  const availableSlots = locations.reduce((sum, location) => sum + location.availableSlots, 0);
  const completedRevenue = bookings.filter(booking => booking.status === "Completed")
    .reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  return `<div class="stats-grid">
    ${statCard("Registered users", users.length, "Customers and owners")}
    ${statCard("Parking capacity", totalSlots, "Total spaces")}
    ${statCard("Available slots", availableSlots, "All approval states")}
    ${statCard("Completed revenue", formatCurrency(completedRevenue), "Demo estimate")}
  </div>
  <section class="section-card"><h2>Location approvals</h2>${renderBars(statusCounts(locations, "status"))}</section>
  <section class="section-card"><h2>Booking lifecycle</h2>${renderBars(statusCounts(bookings))}</section>
  <section class="section-card"><h2>Revenue definition</h2><p>Revenue here is an estimate based on completed demo bookings. It does not represent collected payments.</p></section>`;
}

function adminSupportPage() {
  const requests = getSupportRequests();
  if (!requests.length) return `<div class="empty-state"><h2>No support requests</h2><p>Contact form submissions appear here.</p></div>`;
  return `<div class="support-list">${requests.map(request => `<article class="support-card">
    <div class="card-title-row"><h3>${escapeHTML(request.subject)}</h3><span class="status-badge status-${escapeHTML(request.status.toLowerCase())}">${escapeHTML(request.status)}</span></div>
    <p>From ${escapeHTML(request.name)} · ${escapeHTML(request.email)} · ${formatDate(request.createdAt)}</p>
    <p>${escapeHTML(request.message)}</p>
    ${request.reply ? `<div class="reply-box"><strong>Admin reply:</strong> ${escapeHTML(request.reply)}</div>` : ""}
    <div class="card-actions"><button class="btn btn-secondary" data-action="admin-support-reply" data-id="${escapeHTML(request.id)}">Reply</button>
      ${request.status !== "Resolved" ? `<button class="btn" data-action="admin-support-status" data-id="${escapeHTML(request.id)}" data-status="Resolved">Mark Resolved</button>` : ""}
      ${request.status !== "Open" ? `<button class="btn btn-outline" data-action="admin-support-status" data-id="${escapeHTML(request.id)}" data-status="Open">Reopen</button>` : ""}
    </div>
  </article>`).join("")}</div>`;
}

function changeLocationStatus(locationId, status) {
  if (!["Approved", "Rejected"].includes(status)) return;
  const locations = getLocations();
  const location = locations.find(item => String(item.id) === String(locationId));
  if (!location) {
    showToast("Location was not found.", "error");
    return;
  }
  location.status = status;
  location.reviewedAt = new Date().toISOString();
  if (!saveLocations(locations)) return;
  notifyUser(location.ownerEmail, `${location.name} was ${status.toLowerCase()} by an administrator.`);
  showToast(`Location ${status.toLowerCase()}.`);
  renderDashboard(activeSection);
}

function changeOwnerVerification(email, status) {
  if (!["Verified", "Rejected"].includes(status)) return;
  const users = getUsers();
  const owner = users.find(user => user.email === email && user.role === "owner");
  if (!owner) {
    showToast("Owner account was not found.", "error");
    return;
  }
  owner.ownerVerification = status;
  if (!saveUsers(users)) return;
  notifyUser(email, `Your owner verification status is ${status.toLowerCase()}.`);
  showToast(`Owner marked ${status.toLowerCase()}.`);
  renderDashboard(activeSection);
}

function changeUserStatus(email, status) {
  if (!["Active", "Suspended"].includes(status) || email === ADMIN_ACCOUNT.email) return;
  const users = getUsers();
  const user = users.find(item => item.email === email);
  if (!user) {
    showToast("User account was not found.", "error");
    return;
  }
  user.accountStatus = status;
  if (!saveUsers(users)) return;
  notifyUser(email, `Your demo account was ${status.toLowerCase()} by an administrator.`);
  showToast(`Account ${status.toLowerCase()}.`);
  renderDashboard(activeSection);
}

function notificationsPage() {
  const items = getNotifications().filter(item => item.email === activeUser.email);
  if (!items.length) return `<div class="empty-state"><h2>No notifications</h2><p>Updates about your parking activity will appear here.</p></div>`;
  return `<section class="section-card"><div class="section-heading"><div><h2>Your notifications</h2><p>${unreadNotificationCount()} unread</p></div><button class="btn btn-secondary" data-action="mark-all-notifications">Mark all read</button></div>
    <div class="notification-list">${items.map(item => `<article class="notification-item ${item.read ? "is-read" : ""}">
      <p>${escapeHTML(item.message)}</p><small>${formatDate(item.createdAt)}</small>${item.read ? "" : `<span class="status-badge status-pending">New</span>`}
    </article>`).join("")}</div></section>`;
}

function markAllNotificationsRead() {
  const notifications = getNotifications();
  notifications.forEach(item => {
    if (item.email === activeUser.email) item.read = true;
  });
  saveNotifications(notifications);
  showToast("Notifications marked as read.");
  renderDashboard("notifications");
}

function profilePage() {
  const isAdmin = activeUser.role === "admin";
  return `<section class="section-card"><div class="section-heading"><div><h2>Profile</h2><p>Update the demo account details stored in this browser.</p></div></div>
    <form id="profile-form" class="form-card">
      <label for="profile-name">Full name</label><input id="profile-name" name="name" value="${escapeHTML(activeUser.name)}" required maxlength="80" ${isAdmin ? "readonly" : ""}>
      <label for="profile-email">Email</label><input id="profile-email" name="email" type="email" value="${escapeHTML(activeUser.email)}" required maxlength="120" ${isAdmin ? "readonly" : ""}>
      ${isAdmin ? `<p class="demo-note">The built-in demo administrator profile cannot be edited.</p>` : `<button class="btn" type="submit">Save Profile</button>`}
    </form>
  </section>
  ${isAdmin ? "" : `<section class="section-card"><h2>Change password</h2>
    <form id="change-password-form" class="form-card">
      <label for="current-password">Current password</label><input id="current-password" name="currentPassword" type="password" required autocomplete="current-password">
      <label for="new-password">New password</label><input id="new-password" name="newPassword" type="password" minlength="8" required autocomplete="new-password">
      <label for="confirm-new-password">Confirm new password</label><input id="confirm-new-password" name="confirmPassword" type="password" minlength="8" required autocomplete="new-password">
      <button class="btn" type="submit">Update Password</button>
    </form>
  </section>`}
  <p class="demo-note">This prototype stores profile and password data in browser LocalStorage. Do not use real credentials.</p>`;
}

function updateProfile(form) {
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim().toLowerCase();
  if (name.length < 2 || !email) {
    showToast("Enter a valid name and email.", "error");
    return;
  }

  const users = getUsers();
  if (users.some(user => user.email === email && user.email !== activeUser.email)) {
    showToast("That email is already used by another account.", "error");
    return;
  }
  const user = users.find(item => item.email === activeUser.email);
  if (!user) return;
  const oldEmail = user.email;
  user.name = name;
  user.email = email;

  if (oldEmail !== email) {
    const locations = getLocations();
    locations.forEach(location => {
      if (location.ownerEmail === oldEmail) location.ownerEmail = email;
    });
    saveLocations(locations);
    const bookings = getBookings();
    bookings.forEach(booking => {
      if (booking.customerEmail === oldEmail) booking.customerEmail = email;
    });
    saveBookings(bookings);
    const notifications = getNotifications();
    notifications.forEach(notification => {
      if (notification.email === oldEmail) notification.email = email;
    });
    saveNotifications(notifications);
    const support = getSupportRequests();
    support.forEach(item => {
      if (item.email === oldEmail) item.email = email;
    });
    saveSupportRequests(support);
  }

  if (!saveUsers(users)) return;
  activeUser = user;
  saveSession(user);
  showToast("Profile updated.");
  renderDashboard("profile");
}

function changePassword(form) {
  const currentPassword = form.elements.currentPassword.value;
  const password = form.elements.newPassword.value;
  const confirmation = form.elements.confirmPassword.value;
  const users = getUsers();
  const user = users.find(item => item.email === activeUser.email);
  if (!user || user.password !== currentPassword) {
    showToast("Current password is incorrect.", "error");
    return;
  }
  if (password.length < 8 || password !== confirmation) {
    showToast("New passwords must match and contain at least 8 characters.", "error");
    return;
  }
  user.password = password;
  if (!saveUsers(users)) return;
  form.reset();
  showToast("Password updated for this demo account.");
}

function supportPage() {
  const email = activeUser?.email || "";
  const name = activeUser?.name || "";
  const requests = getSupportRequests().filter(item => item.email === email);
  return `<section class="section-card"><div class="section-heading"><div><h2>Contact support</h2><p>Submit a question or complaint for the administrator.</p></div></div>
    <form id="complaint-form" class="form-card">
      <label for="support-subject">Subject</label><input id="support-subject" name="subject" required maxlength="120">
      <label for="support-message">Message</label><textarea id="support-message" name="message" rows="5" required maxlength="1000"></textarea>
      <button class="btn" type="submit">Submit Request</button>
    </form></section>
    <section class="section-card"><h2>My requests</h2>${requests.length ? requests.map(item => `<article class="support-card"><div class="card-title-row"><strong>${escapeHTML(item.subject)}</strong><span class="status-badge status-${escapeHTML(item.status.toLowerCase())}">${escapeHTML(item.status)}</span></div><p>${escapeHTML(item.message)}</p>${item.reply ? `<div class="reply-box"><strong>Admin reply:</strong> ${escapeHTML(item.reply)}</div>` : ""}</article>`).join("") : `<div class="empty-state">No support requests yet.</div>`}</section>`;
}

function sendContactEmail(form) {
  const recipient = form.dataset.recipientEmail;
  const name = form.elements.name.value.trim();
  const senderEmail = form.elements.email.value.trim();
  const subject = form.elements.subject.value.trim();
  const message = form.elements.message.value.trim();
  if (!name || !senderEmail || !subject || !message) {
    showToast("Complete all support request fields.", "error");
    return;
  }
  if (!recipient) {
    showToast("The contact email is not configured.", "error");
    return;
  }

  const body = encodeURIComponent(`Name: ${name}\nEmail: ${senderEmail}\n\n${message}`);
  window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${body}`;
  showToast("Your email app should open with the request ready. Press Send to deliver it.");
}

function submitSupportRequest(form) {
  const name = form.elements.name ? form.elements.name.value.trim() : activeUser?.name || "";
  const email = form.elements.email ? form.elements.email.value.trim().toLowerCase() : activeUser?.email || "";
  const subject = form.elements.subject.value.trim();
  const message = form.elements.message.value.trim();
  if (!name || !email || !subject || !message) {
    showToast("Complete all support request fields.", "error");
    return;
  }

  const requests = getSupportRequests();
  requests.unshift({
    id: createId(),
    name,
    email,
    role: activeUser?.role || "visitor",
    subject,
    message,
    status: "Open",
    createdAt: new Date().toISOString(),
    reply: ""
  });
  if (!saveSupportRequests(requests)) return;
  notifyUser(ADMIN_ACCOUNT.email, `New support request: ${subject}.`);
  form.reset();
  showToast("Support request submitted.");
  if (activeUser && form.id === "complaint-form") renderDashboard("support");
}

function showSupportReply(requestId) {
  const request = getSupportRequests().find(item => String(item.id) === String(requestId));
  if (!request) return;
  openModal(
    `Reply to ${request.subject}`,
    `<form id="support-reply-form" class="stack-form" data-request-id="${escapeHTML(request.id)}">
      <p>From ${escapeHTML(request.email)}</p>
      <label for="support-reply">Reply</label>
      <textarea id="support-reply" name="reply" rows="5" required maxlength="1000">${escapeHTML(request.reply || "")}</textarea>
      <button class="btn" type="submit">Save Reply</button>
    </form>`
  );
}

function saveSupportReply(form) {
  const requests = getSupportRequests();
  const request = requests.find(item =>
    String(item.id) === String(form.dataset.requestId)
  );
  if (!request) return;
  request.reply = form.elements.reply.value.trim();
  request.status = "Resolved";
  request.repliedAt = new Date().toISOString();
  if (!saveSupportRequests(requests)) return;
  notifyUser(request.email, `Admin replied to your support request: ${request.subject}.`);
  closeModal();
  showToast("Reply saved and request resolved.");
  renderDashboard("support");
}

function changeSupportStatus(requestId, status) {
  if (!["Open", "Resolved"].includes(status)) return;
  const requests = getSupportRequests();
  const request = requests.find(item => String(item.id) === String(requestId));
  if (!request) return;
  request.status = status;
  if (!saveSupportRequests(requests)) return;
  notifyUser(request.email, `Support request "${request.subject}" is ${status.toLowerCase()}.`);
  showToast(`Support request ${status.toLowerCase()}.`);
  renderDashboard("support");
}

function renderBars(counts) {
  const entries = Array.isArray(counts) ? counts : Object.entries(counts || {});
  const max = Math.max(1, ...entries.map(item => Number(item[1]) || 0));
  if (!entries.length) return `<div class="empty-state">No report data yet.</div>`;
  return `<div class="report-bars">${entries.map(([label, count]) => `
    <div class="report-bar-row"><span>${escapeHTML(label)}</span>
      <div class="report-bar-track"><span style="width:${Math.max(0, Math.min(100, (Number(count) / max) * 100))}%"></span></div>
      <strong>${Number(count) || 0}</strong>
    </div>`).join("")}</div>`;
}

function statusCounts(items, field = "status") {
  const counts = {};
  items.forEach(item => {
    const key = item[field] || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts);
}

function statCard(label, value, note) {
  return `<article class="stat-card"><span class="stat-label">${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></article>`;
}

function destroyMaps() {
  if (ownerMap) {
    ownerMap.remove();
    ownerMap = null;
  }
  if (customerMap) {
    customerMap.remove();
    customerMap = null;
  }
}

async function initApp() {
  const app = document.getElementById("app");
  app.addEventListener("click", handleAppClick);
  app.addEventListener("submit", handleAppSubmit);
  app.addEventListener("input", handleAppInput);
  app.addEventListener("change", handleAppChange);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  initializeTheme();

  if (smartParkApi.getToken()) {
    try {
      activeUser = await smartParkApi.currentUser();
      saveSession(activeUser);
      openDashboard("overview");
      return;
    } catch (error) {
      smartParkApi.clearToken();
      localStorage.removeItem(STORAGE_KEYS.session);
      showToast("Your session expired. Please sign in again.", "error");
    }
  }

  activeUser = getCurrentSession();
  if (activeUser) {
    saveSession(activeUser);
    openDashboard("overview");
  } else {
    showPage("home-page");
  }
}

initApp();
