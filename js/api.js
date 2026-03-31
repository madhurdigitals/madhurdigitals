const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";

/**
 * ✅ ADD STUDENT (POST - supports photo upload)
 */
async function addStudent(data) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const result = await res.json();

    console.log("Add Student Response:", result);

    if (result.error) {
      throw new Error(result.error);
    }

    return result;

  } catch (error) {
    console.error("Add Student Error:", error);
    alert("Failed to add student");
  }
}

/**
 * ✅ GET STUDENTS (GET - no change)
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
