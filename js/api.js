const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";

// ✅ ADD STUDENT
async function addStudent(data) {
  const res = await fetch(API_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "addStudent",
      ...data
    })
  });

  return await res.json();
}

// ✅ GET STUDENTS
async function getStudents(school) {
  const res = await fetch(API_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "getStudents",
      school: school
    })
  });

  return await res.json();
}
