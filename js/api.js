const SMARTPARK_API = window.SMARTPARK_API || "http://localhost:8081";

const smartParkApi = {
  tokenKey: "smartpark_api_token",

  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  setToken(token) {
    if (token) localStorage.setItem(this.tokenKey, token);
  },

  clearToken() {
    localStorage.removeItem(this.tokenKey);
  },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${SMARTPARK_API}${path}`, {
        ...options,
        headers
      });
    } catch (error) {
      throw new Error(
        `Cannot reach the SmartPark backend at ${SMARTPARK_API}. Start Spring Boot and check its port. (${error.message})`
      );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "The server request failed.");
    }
    return data;
  },

  register(payload) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...payload, role: payload.role.toUpperCase() })
    });
  },

  login(payload) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...payload, role: payload.role.toUpperCase() })
    });
  },

  currentUser() {
    return this.request("/api/auth/me");
  },

  locations(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/api/locations${query}`);
  },

  createLocation(payload) {
    return this.request("/api/locations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  createBooking(payload) {
    return this.request("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  bookings() {
    return this.request("/api/bookings");
  },

  dashboardData() {
    return this.request("/api/dashboard/data");
  },

  subscribeToAvailability(onUpdate) {
    const events = new EventSource(`${SMARTPARK_API}/api/locations/stream`);
    events.addEventListener("availability", event => onUpdate(event.data));
    return events;
  }
};
