// =============================
// script.js — Dynamic Quote Generator with Web Storage + JSON import/export
// =============================

// ---------- Constants / Keys ----------
const LS_KEY = "dqg_quotes_v1";        // localStorage key for quotes
const SS_KEY_LAST = "dqg_last_quote";  // sessionStorage key for last shown quote info

// ---------- Initial quotes (fallback if localStorage empty) ----------
let quotes = [
  { text: "The only limit to our realization of tomorrow is our doubts of today.", category: "Motivation" },
  { text: "In the middle of difficulty lies opportunity.", category: "Inspiration" },
  { text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", category: "Success" },
  { text: "Life is 10% what happens to us and 90% how we react to it.", category: "Life" },
  { text: "The best way to predict the future is to create it.", category: "Future" },
  { text: "Do not watch the clock. Do what it does. Keep going.", category: "Time" },
  { text: "Believe you can and you're halfway there.", category: "Belief" },
  { text: "Act as if what you do makes a difference. It does.", category: "Action" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", category: "Goals" },
  { text: "The harder the conflict, the greater the triumph.", category: "Triumph" },
  { text: "Happiness is not something ready made. It comes from your own actions.", category: "Happiness" },
  { text: "It does not matter how slowly you go as long as you do not stop.", category: "Perseverance" },
];

// ---------- DOM elements ----------
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteButton = document.getElementById("newQuote");
const categorySelect = document.getElementById("categorySelect");
const exportJsonBtn = document.getElementById("exportJson");
const importFileInput = document.getElementById("importFile");

// ---------- Storage helpers ----------
function saveQuotes() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(quotes));
  } catch (err) {
    console.error("Failed to save quotes to localStorage:", err);
    alert("Could not save quotes to local storage. Check browser storage settings.");
  }
}

function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Basic validation: ensure objects contain text & category
        const valid = parsed.filter(q => q && typeof q.text === "string" && typeof q.category === "string");
        if (valid.length > 0) {
          quotes = valid;
        }
      }
    }
  } catch (err) {
    console.error("Failed to load quotes from localStorage:", err);
  }
}

// ---------- Category dropdown ----------
function updateCategoryDropdown() {
  const categories = [...new Set(quotes.map(q => q.category))].sort();
  categorySelect.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });
}

// ---------- Show random quote (respects selected category) ----------
// Also stores last shown quote in sessionStorage (to demonstrate sessionStorage usage)
function showRandomQuote() {
  const selectedCategory = categorySelect.value || "all";
  let filteredQuotes = quotes;
  if (selectedCategory !== "all") filteredQuotes = quotes.filter(q => q.category === selectedCategory);

  if (filteredQuotes.length === 0) {
    quoteDisplay.innerHTML = `<p class="quote-empty">No quotes available for this category.</p>`;
    sessionStorage.removeItem(SS_KEY_LAST);
    return;
  }

  const idx = Math.floor(Math.random() * filteredQuotes.length);
  const q = filteredQuotes[idx];
  quoteDisplay.innerHTML = `<p class="quote-text">"${escapeHtml(q.text)}"</p><p class="quote-category">— ${escapeHtml(q.category)}</p>`;

  // Save last displayed quote info in session storage (so it's available until tab closed)
  try {
    const last = { text: q.text, category: q.category, time: Date.now() };
    sessionStorage.setItem(SS_KEY_LAST, JSON.stringify(last));
  } catch (err) {
    console.warn("sessionStorage not available:", err);
  }
}

// ---------- Restore last viewed quote from sessionStorage (if any) ----------
function restoreLastViewedQuote() {
  try {
    const raw = sessionStorage.getItem(SS_KEY_LAST);
    if (!raw) return false;
    const last = JSON.parse(raw);
    if (last && last.text && last.category) {
      quoteDisplay.innerHTML = `<p class="quote-text">"${escapeHtml(last.text)}"</p><p class="quote-category">— ${escapeHtml(last.category)}</p>`;
      return true;
    }
  } catch (err) {
    console.warn("Could not restore last viewed quote:", err);
  }
  return false;
}

// ---------- Add quote (with duplicate check, saves to localStorage, updates UI) ----------
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");
  if (!textEl || !catEl) {
    alert("Form inputs not found.");
    return;
  }

  const newText = textEl.value.trim();
  const newCategory = catEl.value.trim();

  if (newText === "" || newCategory === "") {
    alert("Please fill in both fields!");
    return;
  }

  // Prevent duplicates based on text (case-insensitive)
  const isDuplicate = quotes.some(q => q.text.trim().toLowerCase() === newText.toLowerCase());
  if (isDuplicate) {
    alert("This quote already exists.");
    return;
  }

  const newQ = { text: newText, category: newCategory };
  quotes.push(newQ);
  saveQuotes();
  updateCategoryDropdown();

  // auto-select the newly added category and show that quote
  categorySelect.value = newCategory;
  quoteDisplay.innerHTML = `<p class="quote-text">"${escapeHtml(newQ.text)}"</p><p class="quote-category">— ${escapeHtml(newQ.category)}</p>`;

  // Clear form inputs
  textEl.value = "";
  catEl.value = "";

  alert("Quote added and saved to local storage.");
}

// ---------- Export quotes to JSON file ----------
function exportToJson() {
  try {
    const dataStr = JSON.stringify(quotes, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `quotes_export_${new Date().toISOString().slice(0,10)}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export quotes.");
  }
}

// ---------- Import quotes from uploaded JSON file (merge, validate, avoid duplicates) ----------
function importFromJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) {
        alert("Invalid format: JSON must be an array of quote objects.");
        return;
      }

      // Validate each item has text and category (strings)
      const valid = parsed.filter(item => item && typeof item.text === "string" && typeof item.category === "string");
      if (valid.length === 0) {
        alert("No valid quotes found in the file.");
        return;
      }

      // Merge, but avoid duplicates by quote text (case-insensitive)
      const lowerExisting = new Set(quotes.map(q => q.text.trim().toLowerCase()));
      let added = 0;
      valid.forEach(q => {
        const key = q.text.trim().toLowerCase();
        if (!lowerExisting.has(key)) {
          quotes.push({ text: q.text.trim(), category: q.category.trim() });
          lowerExisting.add(key);
          added++;
        }
      });

      if (added > 0) {
        saveQuotes();
        updateCategoryDropdown();
        alert(`Imported ${added} new quote(s).`);
      } else {
        alert("No new quotes to import (all duplicates).");
      }

      // Reset file input so the same file can be re-uploaded if needed
      importFileInput.value = "";
    } catch (err) {
      console.error("Failed to import JSON:", err);
      alert("Failed to parse JSON file. Make sure it's a valid JSON array of quotes.");
    }
  };

  reader.onerror = function () {
    alert("Failed to read file.");
  };

  reader.readAsText(file);
}

// ---------- Utility: escape HTML (simple) ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Dynamically create Add Quote form inside .add-quote-card ----------
function createAddQuoteForm() {
  const container = document.querySelector(".add-quote-card");
  if (!container) {
    console.warn(".add-quote-card not found in DOM.");
    return;
  }

  // clear existing
  container.innerHTML = "";

  // create form
  const form = document.createElement("form");
  form.id = "addQuoteForm";
  form.innerHTML = `
    <h2>Add a New Quote</h2>
    <input id="newQuoteText" type="text" placeholder="Enter a new quote" required />
    <input id="newQuoteCategory" type="text" placeholder="Enter quote category" required />
    <div style="margin-top:10px;">
      <button type="submit" class="btn add-btn">Add Quote</button>
    </div>
  `;

  // handle submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addQuote();
  });

  container.appendChild(form);
}

// ---------- Initialization ----------
function init() {
  // load from localStorage (overwrites default array if present)
  loadQuotes();

  // create form in DOM
  createAddQuoteForm();

  // populate category dropdown
  updateCategoryDropdown();

  // try to restore the last viewed quote from sessionStorage; if not available, show random
  const restored = restoreLastViewedQuote();
  if (!restored) showRandomQuote();

  // attach event listeners
  if (newQuoteButton) newQuoteButton.addEventListener("click", showRandomQuote);
  if (categorySelect) categorySelect.addEventListener("change", showRandomQuote);
  if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportToJson);
  if (importFileInput) importFileInput.addEventListener("change", importFromJsonFile);
}

// call init on load
init();
