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

    // ✅ STEP 1: Check sessionStorage
    const cached = sessionStorage.getItem("schools");

    if (cached && !forceRefresh) {
      console.log("Using session cached schools");
      resolve(JSON.parse(cached));
      return;
    }

    // ✅ STEP 2: JSONP call (same as before)
    const callbackName = "jsonpCallback_" + Date.now();

    window[callbackName] = function(data) {
      console.log("Schools (API):", data);

      // ✅ STEP 3: Store in sessionStorage
      sessionStorage.setItem("schools", JSON.stringify(data));

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

    // ✅ Allow only numbers (max 8)
    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 8);
      this.style.border = ""; // reset while typing
    });

    // 🔥 VALIDATION ON BLUR
    input.addEventListener("blur", function () {

      const value = this.value;

      // ❌ INVALID
      if (value.length !== 8) {
        this.style.border = "2px solid red";

        // optional toast (clean UX)
        if (value.length > 0) {
          showToast("Enter valid DOB (DDMMYYYY)");
        }

        return;
      }

      // ✅ VALID → FORMAT
      const day = value.substring(0, 2);
      const month = value.substring(2, 4);
      const year = value.substring(4, 8);

      this.value = `${day}/${month}/${year}`;
      this.style.border = "";
    });

  });
}

function attachPhoneValidation() {
  const inputs = document.querySelectorAll('input[id*="phone"], input[id*="contact"]');

  inputs.forEach(input => {

    // ✅ Only digits, max 10
    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 10);
      this.style.border = ""; // reset while typing
    });

    // 🔥 VALIDATE ON BLUR
    input.addEventListener("blur", function () {
      const value = this.value;

      if (value.length !== 10) {
        this.style.border = "2px solid red";

        if (value.length > 0) {
          showToast("Enter valid 10-digit number");
        }
      } else {
        this.style.border = "";
      }
    });

  });
}

function attachAutoExpand() {
  const textareas = document.querySelectorAll("textarea");

  textareas.forEach(t => {
    t.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
  });
}

function attachEnterNavigation() {
  const inputs = document.querySelectorAll(
    "#dynamicForm input, #dynamicForm select, #dynamicForm textarea"
  );

  inputs.forEach((el, index) => {
    el.addEventListener("keydown", function (e) {

      // 🔥 ONLY handle Enter for INPUT fields (not textarea)
      if (e.key === "Enter" && el.tagName !== "TEXTAREA") {

        e.preventDefault();

        const next = inputs[index + 1];

        if (next) {
          next.focus();
        }
      }

    });
  });
}

function openDOBPicker(inputId) {
  const targetInput = document.getElementById(inputId);

  // 🔥 Create real visible date input
  const picker = document.createElement("input");
  picker.type = "date";

  // Position near the input
  const rect = targetInput.getBoundingClientRect();

  picker.style.position = "absolute";
  picker.style.top = rect.bottom + window.scrollY + "px";
  picker.style.left = rect.left + "px";
  picker.style.zIndex = 9999;
  picker.style.padding = "8px";

  document.body.appendChild(picker);

  picker.focus(); // ✅ this works

  picker.onchange = function () {
    if (!this.value) return;

    const [y, m, d] = this.value.split("-");
    targetInput.value = `${d}/${m}/${y}`;

    document.body.removeChild(picker);
  };

  // Remove if user clicks elsewhere
  picker.onblur = function () {
    setTimeout(() => {
      if (document.body.contains(picker)) {
        document.body.removeChild(picker);
      }
    }, 200);
  };
}


