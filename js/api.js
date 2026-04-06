const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";

/**
 * ✅ ADD STUDENT (using GET to avoid CORS)
 */
async function addStudent(data) {
  try {
    const params = new URLSearchParams({
      action: "addStudent",
      school: data.school,
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
async function getSchools() {
  try {
    const url = `${API_URL}?action=getSchools`;

    console.log("Get Schools URL:", url);

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();

    console.log("Schools:", data);

    return data;

  } catch (error) {
    console.error("Get Schools Error:", error);
    alert("Failed to fetch schools");
    return [];
  }
}
