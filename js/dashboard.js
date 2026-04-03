window.onload = function () {
  const schoolData = JSON.parse(localStorage.getItem("selectedSchool"));

  if (!schoolData) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("schoolName").innerText = schoolData.School_Name;
};