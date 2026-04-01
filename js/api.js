const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";

/**
 * ADD STUDENT (POST ✅)
 */
async function addStudent(data) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const result = await res.json();

    console.log("Add Response:", result);

    return result;

  } catch (error) {
    console.error("Add Error:", error);
    alert("Failed to add student");
    return null;
  }
}

/**
 * GET STUDENTS (GET ✅)
 */
async function getStudents(school) {
  try {
    const res = await fetch(
      `${API_URL}?action=getStudents&school=${encodeURIComponent(school)}`
    );

    const data = await res.json();

    return data;

  } catch (error) {
    console.error("Fetch Error:", error);
    return [];
  }
}
