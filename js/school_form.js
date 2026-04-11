let school = sessionStorage.getItem("school");
let schoolInfo = null;

// LOAD SCHOOL DATA
async function loadSchool() {
  const schools = await getSchools();

  schoolInfo = schools.find(s => s.school === school);

  if (!schoolInfo) {
    alert("School not found");
    return;
  }

  // ✅ Enable button after load
  document.getElementById("generateBtn").disabled = false;
}
loadSchool();

// LABEL MAP
const labels = {
  name: "Name",
  father_name: "Father Name",
  class: "Class",
  section: "Section",
  phone: "Phone",
  address: "Address"
};

// GENERATE FORMS
function generateForms() {

  if (!schoolInfo) {
    alert("School not loaded yet");
    return;
  }

  document.getElementById("formSection").style.display = "block";

  renderForms();
}

// RENDER FORMS
function renderForms() {

  const container = document.getElementById("formContainer");

  const fields = schoolInfo.fields.split(",");

  // ONLY 1 PAGE → 3 FORMS
  let pageHTML = `
    <div class="page">

      ${generateSingleForm(fields)}
      ${generateSingleForm(fields)}
      ${generateSingleForm(fields)}

    </div>
  `;

  container.innerHTML = pageHTML;
}

// SINGLE FORM TEMPLATE
function generateSingleForm(fields) {

  let html = `
    <div class="form-card">

      <div class="school-header">
        <h2>${schoolInfo.school_name}</h2>
        <div>${schoolInfo.address}</div>
        <div>Contact - ${schoolInfo.contact}</div>
      </div>
  `;

  fields.forEach(f => {

    if (f === "class" || f === "section") {
      // handled together
      return;
    }

    if (f === "address") {
      html += `
        <div class="row">
          Address: <span class="line long"></span>
        </div>
        <div class="row">
          <span class="line long"></span>
        </div>
      `;
    } else {
      html += `
        <div class="row">
          ${labels[f] || f} : <span class="line"></span>
        </div>
      `;
    }

  });

  // CLASS + SECTION SAME ROW
  if (fields.includes("class") || fields.includes("section")) {
    html += `
      <div class="row split">
        <div>Class: <span class="line"></span></div>
        <div>Section: <span class="line"></span></div>
      </div>
    `;
  }

  html += `</div>`;

  return html;
}