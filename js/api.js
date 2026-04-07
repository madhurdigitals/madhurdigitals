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
      name: data.name,
      class: data.class,
      section: data.section,
      roll: data.roll,
      phone: data.phone,
      
      address: data.address
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


async function getSchools(forceRefresh = false) {
  try {
    // ✅ Return cached data if already fetched
    if (schoolCache && !forceRefresh) {
      console.log("Using cached schools");
      return schoolCache;
    }

    const url = `${API_URL}?action=getSchools`;

    console.log("Fetching from API:", url);

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();

    schoolCache = data; // ✅ cache it

    return data;

  } catch (error) {
    console.error("Get Schools Error:", error);
    return [];
  }
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