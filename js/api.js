const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";

/**
 * ADD STUDENT
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

    const res = await fetch(`${API_URL}?${params}`);
    return await res.json();

  } catch (error) {
    console.error("Add Error:", error);
    return null;
  }
}

/**
 * GET STUDENTS
 */
async function getStudents(school) {
  try {
    const res = await fetch(`${API_URL}?action=getStudents&school=${encodeURIComponent(school)}`);
    return await res.json();

  } catch (error) {
    console.error("Fetch Error:", error);
    return [];
  }
}

/**
 * UPLOAD PHOTO
 */
async function uploadPhoto(file, studentId) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async function () {
      const base64 = reader.result.split(",")[1];

      const url = `${API_URL}?action=uploadPhoto&studentId=${studentId}&file=${encodeURIComponent(base64)}`;

      try {
        const res = await fetch(url);
        const data = await res.json();

        console.log("Photo uploaded:", data);
        resolve(data);

      } catch (err) {
        console.error("Upload error:", err);
        resolve(null);
      }
    };

    reader.readAsDataURL(file);
  });
}
