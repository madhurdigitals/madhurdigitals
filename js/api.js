const API_URL = "https://script.google.com/macros/s/AKfycbytZo8tG54g4sAlcKSmL7VPEQ_I1uNILLcOB9tsUjRqHGNGqKxjv4w82-rcNU8W-H_xTg/exec";

/* ADD STUDENT */
async function addStudent(data) {
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
}

/* GET STUDENTS */
async function getStudents(school) {
  const res = await fetch(`${API_URL}?action=getStudents&school=${school}`);
  return await res.json();
}
