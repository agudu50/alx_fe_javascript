// ==========================================
// Dynamic Quote Generator with Category Filtering + Web Storage
// ==========================================

// ----- Keys for localStorage -----
const LS_KEY_QUOTES = "dqg_quotes_v2";       // for quotes
const LS_KEY_LAST_CATEGORY = "dqg_last_cat"; // remember user's last category filter

// ----- Default quotes -----
let quotes = [
  { text: "The only limit to our realization of tomorrow is our doubts of today.", category: "Motivation" },
  { text: "In the middle of difficulty lies opportunity.", category: "Inspiration" },
  { text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", category: "Success" },
  { text: "Life is 10% what happens to us and 90% how we react to it.", category: "Life" },
  
];

// ----- DOM Elements -----
const quoteDisplay = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");
const newQuoteButton = document.getElementById("newQuote");

// ----- Load quotes from localStorage -----
function loadQuotes() {
  const saved = localStorage.getItem(LS_KEY_QUOTES);
  if (saved) {
    try {
      quotes = JSON.parse(saved);
    } catch {
      console.warn("Invalid stored quotes; using defaults.");
    }
  }
}

// ----- Save quotes to localStorage -----
function saveQuotes() {
  localStorage.setItem(LS_KEY_QUOTES, JSON.stringify(quotes));
}

// ----- Populate categories dynamically -----
function populateCategories() {
  const categories = [...new Set(quotes.map(q => q.category))].sort();
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  // Restore last selected category from storage
  const lastCat = localStorage.getItem(LS_KEY_LAST_CATEGORY);
  if (lastCat && categoryFilter.querySelector(`option[value="${lastCat}"]`)) {
    categoryFilter.value = lastCat;
  }
}

// ----- Show quotes filtered by selected category -----
function filterQuotes() {
  const selectedCat = categoryFilter.value;
  localStorage.setItem(LS_KEY_LAST_CATEGORY, selectedCat); // remember filter

  let filtered = quotes;
  if (selectedCat !== "all") {
    filtered = quotes.filter(q => q.category === selectedCat);
  }

  if (filtered.length === 0) {
    quoteDisplay.innerHTML = `<p>No quotes available for this category.</p>`;
    return;
  }

  // Display all quotes of that category
  quoteDisplay.innerHTML = filtered
    .map(q => `<p class="quote-text">"${escapeHtml(q.text)}" <br><span class="quote-category">— ${escapeHtml(q.category)}</span></p>`)
    .join("");
}

// ----- Add a new quote -----
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl = document.getElementById("newQuoteCategory");

  const text = textEl.value.trim();
  const cat = catEl.value.trim();

  if (!text || !cat) {
    alert("Please enter both quote text and category.");
    return;
  }

  quotes.push({ text, category: cat });
  saveQuotes();
  populateCategories(); // refresh category dropdown

  textEl.value = "";
  catEl.value = "";

  alert("Quote added successfully!");
}

// ----- Escape HTML -----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ----- Initialize -----
function init() {
  loadQuotes();
  populateCategories();
  filterQuotes();

  newQuoteButton.addEventListener("click", () => {
    // show one random quote from the filtered category
    const selectedCat = categoryFilter.value;
    let filtered = quotes;
    if (selectedCat !== "all") {
      filtered = quotes.filter(q => q.category === selectedCat);
    }

    if (filtered.length === 0) {
      quoteDisplay.innerHTML = `<p>No quotes available in this category.</p>`;
      return;
    }

    const random = filtered[Math.floor(Math.random() * filtered.length)];
    quoteDisplay.innerHTML = `<p class="quote-text">"${escapeHtml(random.text)}"</p><p class="quote-category">— ${escapeHtml(random.category)}</p>`;
  });
}

// run initialization
init();
