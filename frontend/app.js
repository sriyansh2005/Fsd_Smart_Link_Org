const API_BASE = 'http://localhost:3000/api';

const state = {
  user: {
    id: null,
    loggedIn: false,
    name: "",
    email: ""
  },
  links: [],
  collections: [],
  tags: [],
  ui: {
    route: "dashboard",
    search: "",
    tagFilter: "",
    collectionFilter: "",
    menuOpen: false,
    showModal: false,
    authMode: "login" // "login" or "signup"
  }
};

const app = document.getElementById("app");

// API Helper Functions
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function loadUserData() {
  if (!state.user.id) return;
  
  try {
    // Load collections
    const collections = await apiCall(`/collections?userId=${state.user.id}`);
    state.collections = collections;
    
    // Load all links
    const links = await apiCall(`/links?userId=${state.user.id}`);
    state.links = links;
    
    // Load tags
    const tags = await apiCall(`/tags?userId=${state.user.id}`);
    state.tags = tags;
    
    render();
  } catch (error) {
    addToast('Failed to load data', 'error');
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name) {
  return name
    .split(" ")
    .map((x) => x[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeUrl(url) {
  let next = url.trim();
  if (!next.startsWith("http://") && !next.startsWith("https://")) {
    next = `https://${next}`;
  }
  return next;
}

function parseDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-domain";
  }
}

function filteredLinks() {
  const search = state.ui.search.trim().toLowerCase();
  return state.links.filter((link) => {
    const matchesSearch =
      !search ||
      [link.title, link.url, link.domain, ...(link.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesTag = !state.ui.tagFilter || (link.tags || []).includes(state.ui.tagFilter);
    const matchesCollection = !state.ui.collectionFilter || link.collectionId === state.ui.collectionFilter;
    return matchesSearch && matchesTag && matchesCollection;
  });
}

function collectionName(id) {
  return state.collections.find((item) => item._id === id)?.name || "Unassigned";
}

function updateUi(patch) {
  state.ui = { ...state.ui, ...patch };
  render();
}

function navigate(route) {
  updateUi({ route, menuOpen: false });
}

function addToast(message, type = "ok") {
  const el = document.createElement("div");
  el.className = `notice ${type}`;
  el.textContent = message;
  const host = document.querySelector("[data-toast]");
  if (!host) return;
  host.textContent = "";
  host.appendChild(el);
  setTimeout(() => {
    if (host.contains(el)) host.removeChild(el);
  }, 2200);
}

function authView() {
  if (state.ui.authMode === 'signup') {
    return `
      <div class="auth-shell">
        <form class="auth-card" id="signup-form">
          <div class="brand-mark">🔖</div>
          <h1 class="auth-title">Create Account</h1>
          <p class="auth-subtitle">Sign up for Smart Link Organizer</p>
          <div class="form-stack">
            <div class="field">
              <label>Name</label>
              <input required type="text" placeholder="Enter your name" name="name" />
            </div>
            <div class="field">
              <label>Email</label>
              <input required type="email" placeholder="Enter your email" name="email" />
            </div>
            <div class="field">
              <label>Password</label>
              <input required type="password" placeholder="Enter your password" name="password" />
            </div>
            <button class="primary-btn" type="submit">Sign up</button>
          </div>
          <div class="auth-foot">Already have an account? <button type="button" id="switch-to-login" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600;">Sign in</button></div>
        </form>
      </div>
    `;
  }
  
  return `
    <div class="auth-shell">
      <form class="auth-card" id="login-form">
        <div class="brand-mark">🔖</div>
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to your Smart Link Organizer account</p>
        <div class="form-stack">
          <div class="field">
            <label>Email</label>
            <input required type="email" placeholder="Enter your email" name="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input required type="password" placeholder="Enter your password" name="password" />
          </div>
          <label class="checkbox-row"><input type="checkbox" /> Remember me</label>
          <button class="primary-btn" type="submit">Sign in</button>
        </div>
        <div class="auth-foot">Don't have an account? <button type="button" id="switch-to-signup" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600;">Sign up</button></div>
      </form>
    </div>
  `;
}

function topBar() {
  return `
    <header class="topbar">
      <div class="logo"><div class="logo-badge">🔖</div>Smart Link Organizer</div>
      <div class="search-box"><input id="global-search" placeholder="Search links, tags, collections..." value="${escapeHtml(state.ui.search)}" /></div>
      <div class="top-actions">
        <button class="primary-btn" data-route="add-link">+ Add Link</button>
        <div class="relative">
          <button class="avatar-btn" id="avatar-toggle">${getInitials(state.user.name)}</button>
          ${
            state.ui.menuOpen
              ? `<div class="user-menu"><button data-route="profile">Profile</button><button id="logout-btn">Log out</button></div>`
              : ""
          }
        </div>
      </div>
    </header>
  `;
}

function sideBar() {
  const route = state.ui.route;
  const entry = (key, label) => `<button class="nav-btn ${route === key ? "active" : ""}" data-route="${key}">${label}</button>`;

  return `
    <aside class="sidebar">
      <div class="nav-group">
        ${entry("dashboard", "Dashboard")}
        ${entry("all-links", "All Links")}
        ${entry("collections", "Collections")}
        ${entry("tags", "Tags")}
      </div>
      <div class="divider"></div>
      <div class="nav-group">
        ${entry("add-link", "Add New Link")}
        ${entry("profile", "Profile")}
      </div>
    </aside>
  `;
}

function dashboardView() {
  const links = filteredLinks();
  const top = [...links].sort((a, b) => (b.opens || 0) - (a.opens || 0)).slice(0, 5);

  return `
    <section>
      <div class="page-head">
        <div><h1>Dashboard</h1><p class="page-sub">${links.length} links found</p></div>
      </div>
      <div class="stats">
        <div class="stat"><strong>${state.links.length}</strong><span>Total Links</span></div>
        <div class="stat"><strong>${state.collections.length}</strong><span>Collections</span></div>
        <div class="stat"><strong>${state.tags.length}</strong><span>Tags</span></div>
        <div class="stat"><strong>${state.links.reduce((sum, item) => sum + (item.opens || 0), 0)}</strong><span>Total Opens</span></div>
      </div>
      <div class="panel" style="margin-top:14px;">
        <h3 style="margin:0 0 10px;">Most Opened Links</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Domain</th><th>Collection</th><th>Open Count</th></tr></thead>
            <tbody>
              ${
                top.length
                  ? top
                      .map(
                        (link) =>
                          `<tr><td><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.title || link.domain)}</a></td><td>${escapeHtml(
                            link.domain
                          )}</td><td>${escapeHtml(collectionName(link.collectionId))}</td><td>${link.opens || 0}</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4" class="empty">No links yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function allLinksView() {
  const links = filteredLinks();

  return `
    <section>
      <div class="page-head">
        <div><h1>All Links</h1><p class="page-sub">${links.length} links found</p></div>
      </div>
      <div class="filters">
        <select id="tag-filter"><option value="">All Tags</option>${state.tags
          .map((tag) => `<option value="${escapeHtml(tag)}" ${state.ui.tagFilter === tag ? "selected" : ""}>${escapeHtml(tag)}</option>`)
          .join("")}</select>
        <select id="collection-filter"><option value="">All Collections</option>${state.collections
          .map(
            (collection) =>
              `<option value="${collection._id}" ${state.ui.collectionFilter === collection._id ? "selected" : ""}>${escapeHtml(collection.name)}</option>`
          )
          .join("")}</select>
        <button class="secondary-btn" id="clear-filters">Clear Filters</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Domain</th><th>Tags</th><th>Collection</th><th>Open Count</th><th>Created</th></tr></thead>
          <tbody>
            ${
              links.length
                ? links
                    .map(
                      (link) => `<tr>
                  <td><a href="${escapeHtml(link.url)}" data-collection-id="${link.collectionId}" data-link-id="${link._id}" class="link-open" target="_blank" rel="noreferrer">${escapeHtml(link.title || link.domain)}</a></td>
                  <td class="muted">${escapeHtml(link.domain)}</td>
                  <td>${(link.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}</td>
                  <td><span class="collection-chip">${escapeHtml(collectionName(link.collectionId))}</span></td>
                  <td>${link.opens || 0}</td>
                  <td class="muted">${formatDate(link.createdAt)}</td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6" class="empty">No links match your search and filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function tagsView() {
  const usage = state.tags
    .map((tag) => ({ tag, count: state.links.filter((link) => (link.tags || []).includes(tag)).length }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return `
    <section>
      <div class="page-head">
        <div><h1>Tags</h1><p class="page-sub">Browse and manage your tags</p></div>
        <button class="primary-btn" id="new-tag-btn">+ New Tag</button>
      </div>
      <div class="panel">
        ${
          usage.length
            ? usage.map((item) => `<span class="tag-chip">${escapeHtml(item.tag)} (${item.count})</span>`).join("")
            : `<div class="empty">No tags available.</div>`
        }
      </div>
      <div data-toast></div>
    </section>
  `;
}

function collectionsView() {
  return `
    <section>
      <div class="page-head">
        <div><h1>Collections</h1><p class="page-sub">Organize your links into collections</p></div>
        <button class="primary-btn" id="new-collection-btn">+ New Collection</button>
      </div>
      <div class="grid-cards">
        ${state.collections
          .map((collection) => {
            const total = (collection.links || []).length;
            return `<article class="card" data-collection-id="${collection._id}" style="cursor: pointer;">
              <h3>${escapeHtml(collection.name)}</h3>
              <p>${escapeHtml(collection.description)}</p>
              <div class="meta-row"><span>${total} links</span><span>${formatDate(collection.createdAt)}</span></div>
            </article>`;
          })
          .join("")}
      </div>
      <div data-toast></div>
    </section>
  `;
}

function collectionDetailView(collectionId) {
  const collection = state.collections.find(c => c._id === collectionId);
  if (!collection) {
    return `<section><div class="page-head"><h1>Collection not found</h1></div></section>`;
  }

  const links = collection.links || [];

  return `
    <section>
      <div class="page-head">
        <div>
          <button class="secondary-btn" data-route="collections">← Back to Collections</button>
          <h1>${escapeHtml(collection.name)}</h1>
          <p class="page-sub">${escapeHtml(collection.description)} • ${links.length} links</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Domain</th><th>Tags</th><th>Open Count</th><th>Created</th></tr></thead>
          <tbody>
            ${
              links.length
                ? links
                    .map(
                      (link) => `<tr>
                  <td><a href="${escapeHtml(link.url)}" data-collection-id="${collectionId}" data-link-id="${link._id}" class="link-open" target="_blank" rel="noreferrer">${escapeHtml(link.title || link.domain)}</a></td>
                  <td class="muted">${escapeHtml(link.domain)}</td>
                  <td>${(link.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}</td>
                  <td>${link.opens || 0}</td>
                  <td class="muted">${formatDate(link.createdAt)}</td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5" class="empty">No links in this collection yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div data-toast></div>
    </section>
  `;
}

function addLinkView() {
  return `
    <section>
      <div class="page-head">
        <div><h1>Add New Link</h1><p class="page-sub">Save a link to your collection</p></div>
      </div>
      <form class="panel form-stack" id="add-link-form">
        <div class="field">
          <label>URL</label>
          <input required name="url" placeholder="https://example.com" />
        </div>
        <div class="field">
          <label>Tags (comma separated)</label>
          <input name="tags" placeholder="learning, frontend, tools" />
        </div>
        <div class="field">
          <label>Collection (Required)</label>
          <select name="collectionId" required>
            <option value="">Select a collection</option>
            ${state.collections.map((item) => `<option value="${item._id}">${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="row">
          <button class="primary-btn" type="submit">Save Link</button>
          <button class="secondary-btn" type="button" data-route="all-links">Cancel</button>
        </div>
      </form>
      <div data-toast></div>
    </section>
  `;
}

function profileView() {
  return `
    <section>
      <div class="page-head">
        <div><h1>Profile</h1><p class="page-sub">Manage your account settings and preferences</p></div>
      </div>
      <div class="stats" style="margin-bottom: 16px;">
        <div class="stat"><strong>${state.links.length}</strong><span>Total Links</span></div>
        <div class="stat"><strong>${state.collections.length}</strong><span>Collections</span></div>
        <div class="stat"><strong>${state.tags.length}</strong><span>Tags</span></div>
        <div class="stat"><strong>${state.links.reduce((sum, item) => sum + (item.opens || 0), 0)}</strong><span>Total Opens</span></div>
      </div>
      <div class="panel form-stack">
        <div class="avatar">${getInitials(state.user.name)}</div>
        <div class="row">
          <div class="field"><label>Name</label><input disabled value="${escapeHtml(state.user.name)}" /></div>
          <div class="field"><label>Email</label><input disabled value="${escapeHtml(state.user.email)}" /></div>
        </div>
      </div>
      <div data-toast></div>
    </section>
  `;
}

function routeView() {
  if (state.ui.route.startsWith('collection-')) {
    const collectionId = state.ui.route.replace('collection-', '');
    return collectionDetailView(collectionId);
  }
  
  switch (state.ui.route) {
    case "dashboard":
      return dashboardView();
    case "all-links":
      return allLinksView();
    case "collections":
      return collectionsView();
    case "tags":
      return tagsView();
    case "add-link":
      return addLinkView();
    case "profile":
      return profileView();
    default:
      return allLinksView();
  }
}

function shellView() {
  return `
    <div class="app-shell">
      ${topBar()}
      <div class="app-grid">
        ${sideBar()}
        <main class="content">${routeView()}</main>
      </div>
    </div>
    ${state.ui.showModal ? collectionModal() : ''}
  `;
}

function collectionModal() {
  return `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <h2>Create New Collection</h2>
        <form id="collection-modal-form" class="form-stack">
          <div class="field">
            <label>Collection Name</label>
            <input required type="text" name="name" placeholder="e.g., Work Projects" />
          </div>
          <div class="field">
            <label>Description (Optional)</label>
            <textarea name="description" rows="3" placeholder="Describe this collection..."></textarea>
          </div>
          <div class="modal-actions">
            <button type="submit" class="primary-btn">Create Collection</button>
            <button type="button" class="secondary-btn" id="close-modal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function render() {
  app.innerHTML = state.user.loggedIn ? shellView() : authView();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.route);
    });
  });

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(loginForm);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");

      try {
        const result = await apiCall('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        state.user = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          loggedIn: true
        };
        
        state.ui.route = "dashboard";
        await loadUserData();
      } catch (error) {
        alert(error.message || 'Login failed');
      }
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(signupForm);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");

      try {
        const result = await apiCall('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });

        state.user = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          loggedIn: true
        };
        
        state.ui.route = "dashboard";
        await loadUserData();
      } catch (error) {
        alert(error.message || 'Signup failed');
      }
    });
  }

  const switchToSignup = document.getElementById("switch-to-signup");
  if (switchToSignup) {
    switchToSignup.addEventListener("click", () => {
      state.ui.authMode = "signup";
      render();
    });
  }

  const switchToLogin = document.getElementById("switch-to-login");
  if (switchToLogin) {
    switchToLogin.addEventListener("click", () => {
      state.ui.authMode = "login";
      render();
    });
  }

  const search = document.getElementById("global-search");
  if (search) {
    search.addEventListener("input", (event) => {
      state.ui.search = event.target.value;
      render();
    });
  }

  const avatarToggle = document.getElementById("avatar-toggle");
  if (avatarToggle) {
    avatarToggle.addEventListener("click", () => {
      updateUi({ menuOpen: !state.ui.menuOpen });
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      state.user = { id: null, loggedIn: false, name: "", email: "" };
      state.links = [];
      state.collections = [];
      state.tags = [];
      state.ui.menuOpen = false;
      render();
    });
  }

  const tagFilter = document.getElementById("tag-filter");
  if (tagFilter) {
    tagFilter.addEventListener("change", (event) => {
      updateUi({ tagFilter: event.target.value });
    });
  }

  const collectionFilter = document.getElementById("collection-filter");
  if (collectionFilter) {
    collectionFilter.addEventListener("change", (event) => {
      updateUi({ collectionFilter: event.target.value });
    });
  }

  const clearFilters = document.getElementById("clear-filters");
  if (clearFilters) {
    clearFilters.addEventListener("click", () => {
      updateUi({ tagFilter: "", collectionFilter: "" });
    });
  }

  document.querySelectorAll(".link-open").forEach((linkEl) => {
    linkEl.addEventListener("click", async (e) => {
      const collectionId = linkEl.dataset.collectionId;
      const linkId = linkEl.dataset.linkId;
      
      if (collectionId && linkId) {
        try {
          await apiCall(`/links/${collectionId}/${linkId}/open`, { method: 'POST' });
          
          // Update local state immediately
          const link = state.links.find(l => l._id === linkId);
          if (link) {
            link.opens = (link.opens || 0) + 1;
          }
          
          // Update the collection's link as well
          const collection = state.collections.find(c => c._id === collectionId);
          if (collection && collection.links) {
            const collectionLink = collection.links.find(l => l._id.toString() === linkId);
            if (collectionLink) {
              collectionLink.opens = (collectionLink.opens || 0) + 1;
            }
          }
          
          // Re-render to show updated count
          render();
        } catch (error) {
          console.error('Failed to track link open:', error);
        }
      }
    });
  });

  const addLinkForm = document.getElementById("add-link-form");
  if (addLinkForm) {
    addLinkForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(addLinkForm);
      const rawUrl = String(fd.get("url") || "").trim();
      const collectionId = String(fd.get("collectionId") || "").trim();
      
      if (!rawUrl) {
        addToast("URL is required.", "error");
        return;
      }

      if (!collectionId) {
        addToast("Please select a collection.", "error");
        return;
      }

      const url = normalizeUrl(rawUrl);
      const domain = parseDomain(url);
      
      if (domain === "invalid-domain") {
        addToast("Please enter a valid URL.", "error");
        return;
      }

      const rawTags = String(fd.get("tags") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const tags = rawTags.length ? [...new Set(rawTags)] : [];

      try {
        await apiCall('/links', {
          method: 'POST',
          body: JSON.stringify({
            url,
            userId: state.user.id,
            collectionId,
            tags
          })
        });

        addLinkForm.reset();
        addToast("Link saved successfully. Metadata is being processed...");
        
        // Reload data after a short delay to get the processed link
        setTimeout(async () => {
          await loadUserData();
          navigate("all-links");
        }, 1000);
      } catch (error) {
        addToast(error.message || "Failed to save link", "error");
      }
    });
  }

  const newCollectionBtn = document.getElementById("new-collection-btn");
  if (newCollectionBtn) {
    newCollectionBtn.addEventListener("click", () => {
      state.ui.showModal = true;
      render();
    });
  }

  const closeModal = document.getElementById("close-modal");
  if (closeModal) {
    closeModal.addEventListener("click", () => {
      state.ui.showModal = false;
      render();
    });
  }

  const modalOverlay = document.getElementById("modal-overlay");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        state.ui.showModal = false;
        render();
      }
    });
  }

  const collectionModalForm = document.getElementById("collection-modal-form");
  if (collectionModalForm) {
    collectionModalForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(collectionModalForm);
      const name = String(fd.get("name") || "").trim();
      const description = String(fd.get("description") || "").trim();

      if (!name) {
        addToast("Collection name is required", "error");
        return;
      }

      try {
        await apiCall('/collections', {
          method: 'POST',
          body: JSON.stringify({
            userId: state.user.id,
            name,
            description
          })
        });

        state.ui.showModal = false;
        await loadUserData();
        addToast("Collection created successfully");
      } catch (error) {
        addToast(error.message || "Failed to create collection", "error");
      }
    });
  }

  const newTagBtn = document.getElementById("new-tag-btn");
  if (newTagBtn) {
    newTagBtn.addEventListener("click", () => {
      const tagName = prompt("Enter tag name:");
      if (!tagName) return;
      
      const trimmed = tagName.trim();
      if (!trimmed) return;
      
      if (state.tags.includes(trimmed)) {
        addToast("Tag already exists", "error");
        return;
      }
      
      state.tags.push(trimmed);
      addToast("Tag created. Use it when adding links.");
      render();
    });
  }

  // Collection card click handler
  document.querySelectorAll(".card[data-collection-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const collectionId = card.dataset.collectionId;
      navigate(`collection-${collectionId}`);
    });
  });
}

render();
