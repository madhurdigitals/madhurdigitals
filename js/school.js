document.addEventListener("DOMContentLoaded", function () {
  fetch("schools.json")
    .then(response => response.json())
    .then(data => {
      const dropdown = document.getElementById("school");

      data.forEach(school => {
        const option = document.createElement("option");
        option.value = school.School;
        option.textContent = school.School_Name;
        dropdown.appendChild(option);
      });
    })
    .catch(error => {
      console.error("Error loading schools:", error);
    });
});

function go() {
  const selectedValue = document.getElementById("school").value;

  fetch("schools.json")
    .then(res => res.json())
    .then(data => {
      const selectedSchool = data.find(
        s => s.School === selectedValue
      );

      localStorage.setItem("selectedSchool", JSON.stringify(selectedSchool));

      window.location.href = "dashboard.html";
    });
}