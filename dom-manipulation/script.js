/* script.js
   Sync & conflict resolution for Dynamic Quote Generator
   Assumptions:
   - Server base URL: SERVER_BASE + '/quotes'
   - Server quote object shape: { id, text, category, updatedAt }
   - You may run a local json-server or another mock at /api/quotes
*/

// ---------- Config ----------
const SERVER_BASE = "http://localhost:3000"; // change to your mock server URL
const SERVER_ENDPOINT = `${SERVER_BASE}/quotes`;
const LS_KEY = "dqg_quotes_sync_v1";
const SYNC_INTERVAL_MS = 30000; // 30s polling

// ---------- Local state ----------
let quotes = [];                 // local quotes array
let pendingLocalChanges = [];    // local changes to push when online
let syncTimer = null;

// ---------- DOM ----------
const quoteDisplay = document.getElementById("quoteDisplay");
const syncStatusEl = document.getElementById("syncStatus");
const syncNowBtn = document.getElementById("syncNow");
const conflictBanner = document.getElementById("conflictBanner");
const conflictCountEl = document.getElementById("conflictCount");
const conflictListEl = document.getElementById("conflictList");

// ---------- Utilities ----------
const nowIso = () => new Date().toISOString();
const idForLocal = () => `local-${Date.now()}-${Math.floor(Math.random()*1000)}`;

// safe localStorage JSON helpers
function saveLocalState() {
  localStorage.setItem(LS_KEY, JSON.stringify({ quotes, pendingLocalChanges }));
}
function loadLocalState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.quotes)) {
      quotes = parsed.quotes;
      pendingLocalChanges = Array.isArray(parsed.pendingLocalChanges) ? parsed.pendingLocalChanges : [];
      return true;
    }
  } catch (e) { console.warn("Could not load local state", e); }
  return false;
}

// render quotes (simple)
function renderQuote(q) {
  quoteDisplay.innerHTML = `<p class="quote-text">"${escapeHtml(q.text)}"</p><p class="quote-category">— ${escapeHtml(q.category)}</p>`;
}
function escapeHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// ---------- Initialization ----------
function initLocalData() {
  if (!loadLocalState()) {
    // default seed if nothing in storage
    quotes = [
      { id: idForLocal(), text: "The only limit to our realization of tomorrow is our doubts of today.", category: "Motivation", updatedAt: nowIso() },
      { id: idForLocal(), text: "In the middle of difficulty lies opportunity.", category: "Inspiration", updatedAt: nowIso() }
    ];
    pendingLocalChanges = [];
    saveLocalState();
  }
}

// ---------- Local Add/Edit APIs (push into pendingLocalChanges) ----------
function addLocalQuote(text, category) {
  const newQ = { id: idForLocal(), text, category, updatedAt: nowIso() };
  quotes.push(newQ);
  pendingLocalChanges.push({ op: "create", quote: newQ });
  saveLocalState();
  renderQuote(newQ);
}

function editLocalQuote(localId, newText, newCategory) {
  const idx = quotes.findIndex(q => q.id === localId);
  if (idx === -1) return;
  const old = quotes[idx];
  const updated = { ...old, text: newText, category: newCategory, updatedAt: nowIso() };
  quotes[idx] = updated;
  pendingLocalChanges.push({ op: "update", quote: updated });
  saveLocalState();
}

// ---------- Sync helpers ----------
function setSyncStatus(text, klass = "") {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = text;
  syncStatusEl.className = klass;
}

async function fetchQuotesFromServer() {
  const res = await fetch("http://localhost:3000/posts");
  if (!res.ok) throw new Error(`Fetch error ${res.status}`);
  return await res.json(); // expected array of server quotes
}

// push pending local changes to server (create/update)
async function pushLocalChanges() {
  if (pendingLocalChanges.length === 0) return;
  // iterate and attempt to push
  const succeeded = [];
  for (const change of pendingLocalChanges) {
    try {
      if (change.op === "create") {
        // POST to server - server assigns canonical id
        const payload = { text: change.quote.text, category: change.quote.category, updatedAt: change.quote.updatedAt };
        const res = await fetch(SERVER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("create failed "+res.status);
        const created = await res.json();
        // replace local id with server id in local storage
        quotes = quotes.map(q => q.id === change.quote.id ? { ...created } : q);
        succeeded.push(change);
      } else if (change.op === "update") {
        // server id might be missing if the item never synced; prefer to find by text or skip
        const serverId = change.quote.id && !String(change.quote.id).startsWith("local-") ? change.quote.id : null;
        if (!serverId) {
          // nothing to update on server yet; create it (fallback)
          const payload = { text: change.quote.text, category: change.quote.category, updatedAt: change.quote.updatedAt };
          const res = await fetch(SERVER_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error("create during update failed");
          const created = await res.json();
          quotes = quotes.map(q => q.id === change.quote.id ? { ...created } : q);
          succeeded.push(change);
        } else {
          const res = await fetch(`${SERVER_ENDPOINT}/${serverId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(change.quote)
          });
          if (!res.ok) throw new Error("update failed");
          const updated = await res.json();
          quotes = quotes.map(q => q.id === serverId ? updated : q);
          succeeded.push(change);
        }
      }
    } catch (err) {
      console.warn("push change failed", change, err);
      // keep this change for next attempt
    }
  }
  // remove succeeded from pending queue
  pendingLocalChanges = pendingLocalChanges.filter(c => !succeeded.includes(c));
  saveLocalState();
}

// Merge server data into local with conflict resolution (server wins by default)
// returns conflict objects for UI display: [{ local, server }]
function mergeServerIntoLocal(serverQuotes) {
  const conflicts = [];
  // index local by id
  const localById = new Map(quotes.map(q => [String(q.id), q]));
  // index server by id
  const serverById = new Map(serverQuotes.map(s => [String(s.id), s]));

  // 1) For every server item: if not present locally -> add/replace
  for (const [sid, sItem] of serverById.entries()) {
    const local = localById.get(sid);
    if (!local) {
      // Add server item to local
      quotes.push(sItem);
    } else {
      // both exist: compare updatedAt
      const localAt = local.updatedAt || "";
      const serverAt = sItem.updatedAt || "";
      if (serverAt > localAt) {
        // server is newer -> replace local (server wins)
        // if local had changes pending that conflict, record conflict for UI
        const hadPending = pendingLocalChanges.some(ch => ch.quote && String(ch.quote.id) === String(local.id));
        if (hadPending && local.text !== sItem.text) {
          conflicts.push({ local, server: sItem });
        }
        // replace local with server
        const idx = quotes.findIndex(q => String(q.id) === String(local.id));
        if (idx !== -1) quotes[idx] = sItem;
      } else if (localAt > serverAt) {
        // local is newer — we'll attempt to push local changes (server will be overwritten)
        // But per strategy default server wins — so we record conflict and replace with server now
        const idx = quotes.findIndex(q => String(q.id) === String(local.id));
        if (idx !== -1) {
          conflicts.push({ local, server: sItem });
          quotes[idx] = sItem; // server wins automatically; UI will offer restore local
        }
      }
      // else equal -> no action
    }
  }

  // 2) Server may not contain some local items (created locally). Keep them locally (they'll be posted).
  // Nothing to do here — pendingLocalChanges will include creates.

  saveLocalState();
  return conflicts;
}

// ---------- Main sync routine ----------
async function syncWithServer(showNotifications = true) {
  setSyncStatus("Syncing...", "syncing");
  try {
    await pushLocalChanges(); // send local creates/updates first
  } catch (e) {
    console.warn("Error pushing local changes", e);
  }

  try {
    const serverQuotes = await fetchQuotesFromServer();
    // merge server into local, collect any conflicts
    const conflicts = mergeServerIntoLocal(serverQuotes || []);
    // After merge, attempt to push again for any remaining pending (e.g., created locally)
    await pushLocalChanges();

    setSyncStatus("Synced", "synced");
    if (conflicts.length > 0) {
      showConflictBanner(conflicts);
      if (showNotifications) alert(`${conflicts.length} conflict(s) resolved (server wins). You may restore local versions from the conflict list.`);
    }
  } catch (err) {
    console.warn("Sync failed", err);
    setSyncStatus("Sync error", "error");
    if (showNotifications) {
      // don't spam user if periodic; only for manual sync maybe
      // alert("Sync failed: " + err.message);
    }
  }
}

// ---------- UI conflict banner / manual restore ----------
function showConflictBanner(conflicts) {
  if (!conflictBanner) return;
  conflictBanner.style.display = "block";
  conflictCountEl.textContent = `${conflicts.length} conflict(s)`;
  conflictListEl.innerHTML = ""; // clear
  conflicts.forEach((c, idx) => {
    const item = document.createElement("div");
    item.className = "conflict-item";
    item.innerHTML = `
      <div style="flex:1">
        <strong>Server:</strong> ${escapeHtml(c.server.text)} <br>
        <em>${escapeHtml(c.server.category)}</em>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn" data-idx="${idx}" data-type="restore">Restore Local</button>
        <button class="btn" data-idx="${idx}" data-type="keep-server">Keep Server</button>
      </div>
    `;
    conflictListEl.appendChild(item);

    // attach handlers
    item.querySelector('button[data-type="restore"]').addEventListener("click", () => {
      // find the server item in local quotes and replace with the local version preserved in conflict
      const conflict = conflicts[idx];
      const localId = conflict.local.id;
      const idxLocal = quotes.findIndex(q => String(q.id) === String(localId));
      if (idxLocal !== -1) {
        // restore local (treat as an update that should be pushed)
        quotes[idxLocal] = { ...conflict.local, updatedAt: nowIso() };
        pendingLocalChanges.push({ op: "update", quote: quotes[idxLocal] });
        saveLocalState();
        alert("Local version restored — it will be pushed to server on next sync.");
        // optionally hide conflict item
        item.remove();
      }
    });

    item.querySelector('button[data-type="keep-server"]').addEventListener("click", () => {
      // simply dismiss conflict; local is already replaced by server
      item.remove();
      alert("Kept server version.");
    });
  });
}

// ---------- Setup periodic sync ----------
function startPeriodicSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => syncWithServer(false).catch(()=>{}), SYNC_INTERVAL_MS);
}

// ---------- UI bindings ----------
if (syncNowBtn) syncNowBtn.addEventListener("click", () => syncWithServer(true));
window.addEventListener("beforeunload", () => {
  // attempt a final save
  saveLocalState();
});

// ---------- Boot sequence ----------
function boot() {
  initLocalData();
  // Attempt first render
  if (quotes.length > 0) renderQuote(quotes[0]);
  startPeriodicSync();
  // Attempt initial sync but don't spam user on failure
  syncWithServer(false).catch(()=>{});
}
boot();
