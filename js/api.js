const API_URL = "https://script.google.com/macros/s/AKfycbzd3Bi9-0a2odrCrIaDvWzEjtumkqCUeq7N_c1KTa_z/dev";

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
