// const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";
const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";
let schoolCache = null;
let schoolsData = [];
/**
 * ✅ ADD STUDENT (using GET to avoid CORS)
 */
async function addStudent(data) {
  try {
    const params = new URLSearchParams({
      action: "addStudent",
      school: data.school,
      school_id: data.school_id,
      ...data   // 🔥 THIS IS THE MAGIC LINE
    });

    const url = `${API_URL}?${params.toString()}`;

    console.log("Add URL:", url);

    const res = await fetch(url);
    const result = await res.json();

    return result;

  } catch (error) {
    console.error("Add Student Error:", error);
    alert("Failed to add student");
  }
}

/**
 * ✅ GET STUDENTS (CORS SAFE)
 */
async function getStudents(school) {
  try {
    const url = `${API_URL}?action=getStudents&school=${encodeURIComponent(school)}`;

    console.log("Fetch URL:", url);

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();

    console.log("Students:", data);

    return data;

  } catch (error) {
    console.error("Fetch Error:", error);
    alert("Failed to fetch students");
    return [];
  }
}

/* ========================= */
/* ===== SCHOOL APIs ======= */
/* ========================= */

/* GET SCHOOLS */

function getSchools(forceRefresh = false) {
  return new Promise((resolve, reject) => {

    // ✅ use cache if available
    if (schoolCache && !forceRefresh) {
      console.log("Using cached schools");
      resolve(schoolCache);
      return;
    }

    const callbackName = "jsonpCallback_" + Date.now();

    window[callbackName] = function(data) {
      console.log("Schools (JSONP):", data);

      schoolCache = data;   // ✅ cache
      resolve(data);

      delete window[callbackName];
    };

    const script = document.createElement("script");

    script.src = `${API_URL}?action=getSchools&callback=${callbackName}`;

    script.onerror = function() {
      reject("JSONP failed");
      delete window[callbackName];
    };

    document.body.appendChild(script);
  });
}

/* ADD SCHOOL */
async function addSchool(data) {
  try {
    const params = new URLSearchParams({
      action: "addSchool",
      school: data.school,
      school_name: data.school_name,
      school_id: data.school_id,
      address: data.address,
      contact: data.contact,
      fields: data.fields,
      template: data.template,
      logo: data.logo,
      card_color: data.card_color
    });

    const url = `${API_URL}?${params.toString()}`;

    console.log("Add School URL:", url);

    const res = await fetch(url);
    const result = await res.json();

    console.log("Add School Result:", result);

    return result;

  } catch (error) {
    console.error("Add School Error:", error);
    alert("Failed to add school");
  }
}

function attachDOBFormatterAll() {
  const inputs = document.querySelectorAll('input[id*="dob"]');

  inputs.forEach(input => {
    input.addEventListener("input", function () {
      let value = this.value.replace(/\D/g, "");

      if (value.length > 8) value = value.slice(0, 8);

      let formatted = "";

      if (value.length >= 2) {
        formatted += value.substring(0, 2);
      }
      if (value.length >= 4) {
        formatted += "/" + value.substring(2, 4);
      } else if (value.length > 2) {
        formatted += "/" + value.substring(2);
      }
      if (value.length >= 5) {
        formatted += "/" + value.substring(4, 8);
      }

      this.value = formatted;
    });
  });
}

function attachDOBPickerAll() {
  const inputs = document.querySelectorAll('input[id*="dob"]');

  inputs.forEach(input => {
    const hiddenDate = document.createElement("input");
    hiddenDate.type = "date";
    hiddenDate.style.position = "absolute";
    hiddenDate.style.opacity = "0";

    document.body.appendChild(hiddenDate);

    input.addEventListener("focus", () => {
      hiddenDate.click();
    });

    hiddenDate.addEventListener("change", function () {
      if (!this.value) return;

      const [y, m, d] = this.value.split("-");
      input.value = `${d}/${m}/${y}`;
    });
  });
}