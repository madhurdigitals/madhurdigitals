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
  window.location.href = "login.html";
}
