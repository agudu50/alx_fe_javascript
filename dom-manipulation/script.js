// =============================
// Dynamic Quote Generator Script
// =============================

// Initial list of quotes
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

// DOM Elements
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteButton = document.getElementById("newQuote");
const categorySelect = document.getElementById("categorySelect");

// =============================
// Function: Populate category dropdown
// =============================
function updateCategoryDropdown() {
  const categories = [...new Set(quotes.map(q => q.category))];
  categorySelect.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });
}

// =============================
// Function: Show a random quote
// =============================
function showRandomQuote() {
  const selectedCategory = categorySelect.value;
  let filteredQuotes = quotes;

  if (selectedCategory !== "all") {
    filteredQuotes = quotes.filter(q => q.category === selectedCategory);
  }

  if (filteredQuotes.length === 0) {
    quoteDisplay.textContent = "No quotes available for this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];

  quoteDisplay.innerHTML = `
    <p class="quote-text">"${quote.text}"</p>
    <p class="quote-category">— ${quote.category}</p>
  `;
}

// =============================
// Function: Add a new quote dynamically
// =============================
function addQuote() {
  const newText = document.getElementById("newQuoteText").value.trim();
  const newCategory = document.getElementById("newQuoteCategory").value.trim();

  if (newText === "" || newCategory === "") {
    alert("Please fill in both fields!");
    return;
  }

  quotes.push({ text: newText, category: newCategory });

  // Clear inputs
  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteCategory").value = "";

  updateCategoryDropdown();
  alert("✅ Quote added successfully!");
}

// =============================
// Function: Dynamically create the Add Quote form
// =============================
function createAddQuoteForm() {
  const addQuoteSection = document.querySelector(".add-quote-card");

  // Create form element
  const form = document.createElement("form");
  form.id = "addQuoteForm";
  form.innerHTML = `
    <h2>Add a New Quote</h2>
    <input id="newQuoteText" type="text" placeholder="Enter a new quote" required />
    <input id="newQuoteCategory" type="text" placeholder="Enter quote category" required />
    <button type="submit" class="btn add-btn">Add Quote</button>
  `;

  // Handle submission
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addQuote();
  });

  // Append form inside the add-quote-card div
  addQuoteSection.appendChild(form);
}

// =============================
// Event Listeners
// =============================
newQuoteButton.addEventListener("click", showRandomQuote);
categorySelect.addEventListener("change", showRandomQuote);

// =============================
// Initialization
// =============================
updateCategoryDropdown();
showRandomQuote();
createAddQuoteForm(); // 👈 ensures the form exists dynamically
