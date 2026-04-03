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

async function submitStudent() {

  const name = document.getElementById("name").value.trim();
  const cls = document.getElementById("class").value;
  const section = document.getElementById("section").value;

  console.log("DEBUG:", { name, cls, section });

  // ✅ ONLY REQUIRED FIELDS
  if (!name) {
    showToast("Enter student name");
    return;
  }

  if (!cls) {
    showToast("Select class");
    return;
  }

  const data = {
    school: school,
    name: name,
    class: cls,
    section: section || "", // optional
    roll: document.getElementById("roll").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value
  };

  const res = await addStudent(data);

  if (res && res.status === "success") {
    showToast("Student Added");
  } else {
    showToast("Error adding student");
  }

  clearForm();
  loadData();
}
