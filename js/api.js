const API_URL = "PASTE_YOUR_SCRIPT_URL_HERE";

async function addStudent(data) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "addStudent",
      ...data
    })
  });
  return res.json();
}

async function getStudents(school) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "getStudents",
      school: school
    })
  });
  return res.json();
}
