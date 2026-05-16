const STORAGE_KEY = "smart-link-organizer-data-v1";

const seed = {
  user: {
    loggedIn: false,
    name: "John Doe",
    email: "john.doe@example.com"
  },
  links: [
    {
      id: crypto.randomUUID(),
      url: "https://css-tricks.com",
      title: "CSS-Tricks - Tips, Tricks, and Techniques",
      domain: "css-tricks.com",
      tags: ["Articles", "Tutorial"],
      collectionId: "col-learning",
      opens: 23,
      createdAt: "2026-02-20"
    },
    {
      id: crypto.randomUUID(),
      url: "https://developer.mozilla.org",
      title: "MDN Web Docs",
      domain: "developer.mozilla.org",
      tags: ["Development", "Documentation"],
      collectionId: "col-learning",
      opens: 89,
      createdAt: "2026-02-23"
    },
    {
      id: crypto.randomUUID(),
      url: "https://react.dev",
      title: "React Documentation - Getting Started",
      domain: "react.dev",
      tags: ["Development", "Documentation"],
      collectionId: "col-ui",
      opens: 78,
      createdAt: "2026-02-26"
    },
    {
      id: crypto.randomUUID(),
      url: "https://tailwindcss.com",
      title: "Tailwind CSS - Rapidly build modern websites",
      domain: "tailwindcss.com",
      tags: ["Development", "Tools"],
      collectionId: "col-tools",
      opens: 32,
      createdAt: "2026-02-25"
    }
  ],
  collections: [
    {
      id: "col-work",
      name: "Work Projects",
      description: "Links related to active work projects",
      createdAt: "2026-01-15"
    },
    {
      id: "col-learning",
      name: "Learning Resources",
      description: "Educational content and tutorials",
      createdAt: "2026-02-10"
    },
    {
      id: "col-ui",
      name: "UI Components",
      description: "Component libraries and design systems",
      createdAt: "2026-01-20"
    },
    {
      id: "col-tools",
      name: "Developer Tools",
      description: "Useful tools and utilities",
      createdAt: "2026-03-01"
    }
  ],
  tags: ["Design", "Development", "Resources", "Inspiration", "Tutorial", "Tools", "Articles", "Documentation"],
  ui: {
    route: "dashboard",
    search: "",
    tagFilter: "",
    collectionFilter: "",
    menuOpen: false
  }
};

const app = document.getElementById("app");
const state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seed);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(seed),
      ...parsed,
      ui: { ...seed.ui, ...(parsed.ui || {}) },
      user: { ...seed.user, ...(parsed.user || {}) }
    };
  } catch {
    return structuredClone(seed);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(text) {
  return text
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
      [link.title, link.url, link.domain, ...link.tags]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesTag = !state.ui.tagFilter || link.tags.includes(state.ui.tagFilter);
    const matchesCollection = !state.ui.collectionFilter || link.collectionId === state.ui.collectionFilter;
    return matchesSearch && matchesTag && matchesCollection;
  });
}

function collectionName(id) {
  return state.collections.find((item) => item.id === id)?.name || "Unassigned";
}

function updateUi(patch) {
  state.ui = { ...state.ui, ...patch };
  persist();
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
  return `
    <div class="auth-shell">
      <form class="auth-card" id="login-form">
        <div class="brand-mark">🔖</div>
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to your Smart Link Organizer account</p>
        <div class="form-stack">
          <div class="field">
            <label>Email</label>
            <input required type="email" placeholder="Enter your email" value="${escapeHtml(state.user.email)}" name="email" />
          </div>
          <div class="field">
            <label>Password</label>
            <input required type="password" placeholder="Enter your password" name="password" />
          </div>
          <label class="checkbox-row"><input type="checkbox" /> Remember me</label>
          <button class="primary-btn" type="submit">Sign in</button>
        </div>
        <div class="auth-foot">Don&apos;t have an account? Sign up</div>
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
  const top = [...links].sort((a, b) => b.opens - a.opens).slice(0, 5);

  return `
    <section>
      <div class="page-head">
        <div><h1>Dashboard</h1><p class="page-sub">${links.length} links found</p></div>
      </div>
      <div class="stats">
        <div class="stat"><strong>${state.links.length}</strong><span>Total Links</span></div>
        <div class="stat"><strong>${state.collections.length}</strong><span>Collections</span></div>
        <div class="stat"><strong>${state.tags.length}</strong><span>Tags</span></div>
        <div class="stat"><strong>${state.links.reduce((sum, item) => sum + item.opens, 0)}</strong><span>Total Opens</span></div>
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
                          `<tr><td><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.title)}</a></td><td>${escapeHtml(
                            link.domain
                          )}</td><td>${escapeHtml(collectionName(link.collectionId))}</td><td>${link.opens}</td></tr>`
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
              `<option value="${collection.id}" ${state.ui.collectionFilter === collection.id ? "selected" : ""}>${escapeHtml(collection.name)}</option>`
          )
          .join("")}</select>
        <button class="secondary-btn" id="clear-filters">Clear Filters</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Domain</th><th>Tags</th><th>Collection</th><th>Open Count</th><th>Last Opened</th></tr></thead>
          <tbody>
            ${
              links.length
                ? links
                    .map(
                      (link) => `<tr>
                  <td><a href="${escapeHtml(link.url)}" data-open-id="${link.id}" target="_blank" rel="noreferrer">${escapeHtml(link.title)}</a></td>
                  <td class="muted">${escapeHtml(link.domain)}</td>
                  <td>${link.tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}</td>
                  <td><span class="collection-chip">${escapeHtml(collectionName(link.collectionId))}</span></td>
                  <td>${link.opens}</td>
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
    .map((tag) => ({ tag, count: state.links.filter((link) => link.tags.includes(tag)).length }))
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
            ? usage.map((item) => `<span class="tag-chip">${escapeHtml(item.tag)} ${item.count}</span>`).join("")
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
            const total = state.links.filter((link) => link.collectionId === collection.id).length;
            return `<article class="card">
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
          <label>Title (Optional)</label>
          <input name="title" placeholder="Auto-filled from domain if empty" />
        </div>
        <div class="field">
          <label>Tags (comma separated)</label>
          <input name="tags" placeholder="learning, frontend, tools" />
        </div>
        <div class="field">
          <label>Collection (Optional)</label>
          <select name="collectionId">
            <option value="">No collection</option>
            ${state.collections.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}
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
        <div class="stat"><strong>${state.links.reduce((sum, item) => sum + item.opens, 0)}</strong><span>Total Opens</span></div>
      </div>
      <form class="panel form-stack" id="profile-form">
        <div class="avatar">${getInitials(state.user.name)}</div>
        <div class="row">
          <div class="field"><label>Name</label><input required name="name" value="${escapeHtml(state.user.name)}" /></div>
          <div class="field"><label>Email</label><input required type="email" name="email" value="${escapeHtml(state.user.email)}" /></div>
        </div>
        <button class="primary-btn" type="submit" style="width:fit-content;">Save Changes</button>
      </form>
      <div data-toast></div>
    </section>
  `;
}

function routeView() {
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
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(loginForm);
      state.user.email = String(fd.get("email") || "").trim();
      state.user.loggedIn = true;
      state.ui.route = "dashboard";
      persist();
      render();
    });
  }

  const search = document.getElementById("global-search");
  if (search) {
    search.addEventListener("input", (event) => {
      state.ui.search = event.target.value;
      persist();
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
      state.user.loggedIn = false;
      state.ui.menuOpen = false;
      persist();
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

  document.querySelectorAll("a[data-open-id]").forEach((linkEl) => {
    linkEl.addEventListener("click", () => {
      const id = linkEl.dataset.openId;
      const hit = state.links.find((item) => item.id === id);
      if (hit) {
        hit.opens += 1;
        hit.createdAt = new Date().toISOString().slice(0, 10);
        persist();
      }
    });
  });

  const addLinkForm = document.getElementById("add-link-form");
  if (addLinkForm) {
    addLinkForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(addLinkForm);
      const rawUrl = String(fd.get("url") || "").trim();
      if (!rawUrl) {
        addToast("URL is required.", "error");
        return;
      }

      const url = normalizeUrl(rawUrl);
      let domain = parseDomain(url);
      if (domain === "invalid-domain") {
        addToast("Please enter a valid URL.", "error");
        return;
      }

      const rawTags = String(fd.get("tags") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const tags = rawTags.length ? [...new Set(rawTags)] : ["General"];
      tags.forEach((tag) => {
        if (!state.tags.includes(tag)) state.tags.push(tag);
      });

      const titleInput = String(fd.get("title") || "").trim();
      const title = titleInput || domain;

      state.links.unshift({
        id: crypto.randomUUID(),
        url,
        title,
        domain,
        tags,
        collectionId: String(fd.get("collectionId") || "") || "",
        opens: 0,
        createdAt: new Date().toISOString().slice(0, 10)
      });

      persist();
      addLinkForm.reset();
      addToast("Link saved successfully.");
      setTimeout(() => navigate("all-links"), 450);
    });
  }

  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(profileForm);
      state.user.name = String(fd.get("name") || "").trim();
      state.user.email = String(fd.get("email") || "").trim();
      persist();
      render();
      addToast("Profile updated.");
    });
  }

  const newTagBtn = document.getElementById("new-tag-btn");
  if (newTagBtn) {
    newTagBtn.addEventListener("click", () => {
      const value = prompt("Enter tag name");
      if (!value) return;
      const tag = value.trim();
      if (!tag) return;
      if (state.tags.includes(tag)) {
        addToast("Tag already exists.", "error");
        return;
      }
      state.tags.push(tag);
      persist();
      render();
      addToast("Tag created.");
    });
  }

  const newCollectionBtn = document.getElementById("new-collection-btn");
  if (newCollectionBtn) {
    newCollectionBtn.addEventListener("click", () => {
      const name = prompt("Collection name");
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const exists = state.collections.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        addToast("Collection already exists.", "error");
        return;
      }
      state.collections.push({
        id: `col-${crypto.randomUUID().slice(0, 8)}`,
        name: trimmed,
        description: "Custom collection",
        createdAt: new Date().toISOString().slice(0, 10)
      });
      persist();
      render();
      addToast("Collection created.");
    });
  }
}

render();
