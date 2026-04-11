// Pages that DON'T require login
const publicPages = ["index.html", "login.html"];

// Get current page name
let path = window.location.pathname;
let currentPage = path.substring(path.lastIndexOf("/") + 1);

// Handle root domain (madhurdigitals.in/)
if (currentPage === "") {
  currentPage = "index.html";
}

// Check login status
const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";

// 🚫 Protect only non-public pages
if (!publicPages.includes(currentPage) && !isLoggedIn) {
  window.location.href = "login.html";
}

// 🔁 Optional: prevent logged-in users from going back to login page
if (currentPage === "login.html" && isLoggedIn) {
  window.location.href = "dashboard.html"; // change if needed
}