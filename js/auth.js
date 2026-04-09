const USER = {
  username: "user",
  password: "1234"
};

function login(username, password) {
  if (username === USER.username && password === USER.password) {
    localStorage.setItem("isLoggedIn", "true");
    return true;
  }
  return false;
}

function logout() {
  localStorage.clear();
  sessionStorage.clear(); // IMPORTANT
  window.location.href = "index.html";
}
