const API_URL = "PASTE_NEW_DEPLOYMENT_URL_HERE";

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
