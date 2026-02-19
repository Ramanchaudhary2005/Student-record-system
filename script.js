const students = [];

const DEFAULT_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#dbe7f4"/>
  <circle cx="60" cy="42" r="20" fill="#86a8c9"/>
  <path d="M24 109c4-22 17-33 36-33s32 11 36 33" fill="#86a8c9"/>
</svg>
`)}`;

function addStudent() {
  const roll = rollv().trim();
  const name = val("name").trim();

  if (!roll || !name) {
    alert("Roll and name are required.");
    return;
  }

  if (students.some((student) => student.roll === roll)) {
    alert("Roll already exists. Use Update to modify this record.");
    return;
  }

  const student = buildStudentFromForm();
  students.push(student);
  clearForm();
  setResultMessage("Student added successfully.");
  displayStudents();
}

function updateStudent() {
  const roll = rollv().trim();
  const student = students.find((item) => item.roll === roll);

  if (!roll || !student) {
    alert("Enter a valid roll number to update.");
    return;
  }

  const updated = buildStudentFromForm(student.photoURL, true);
  student.name = updated.name;
  student.phone = updated.phone;
  student.address = updated.address;
  student.total = updated.total;
  student.percentage = updated.percentage;
  student.photoURL = updated.photoURL;

  clearForm();
  setResultMessage("Student record updated.");
  displayStudents();
}

function deleteStudent() {
  const roll = rollv().trim();
  const index = students.findIndex((student) => student.roll === roll);

  if (!roll || index === -1) {
    alert("Enter a valid roll number to delete.");
    return;
  }

  students.splice(index, 1);
  clearForm();
  setResultMessage("Student record deleted.");
  displayStudents();
}

function searchStudent() {
  const roll = val("searchRoll").trim();
  const student = students.find((item) => item.roll === roll);

  if (!roll) {
    setResultMessage("Enter a roll number to search.");
    return;
  }

  if (!student) {
    setResultMessage("Student not found.");
    return;
  }

  const topperTag = getTopperTag(student);
  document.getElementById("result").innerHTML = `
    <div class="result-card">
      <img class="result-avatar" src="${getStudentImage(student)}" alt="student photo">
      <div class="result-details">
        <h3>${escapeHtml(student.name)}${topperTag}</h3>
        <p><span>Roll:</span> ${escapeHtml(student.roll)}</p>
        <p><span>Phone:</span> ${escapeHtml(student.phone || "-")}</p>
        <p><span>Address:</span> ${escapeHtml(student.address || "-")}</p>
        <p><span>Total:</span> ${student.total} / 400</p>
        <p><span>Percentage:</span> ${student.percentage}%</p>
      </div>
    </div>
  `;
}

function sortTopper() {
  students.sort((a, b) => b.total - a.total || a.roll.localeCompare(b.roll));
  setResultMessage("Sorted by topper score.");
  displayStudents();
}

function displayStudents() {
  const table = document.getElementById("table");

  table.innerHTML = `
    <tr>
      <th>Photo</th>
      <th>Name</th>
      <th>Roll</th>
      <th>Total</th>
      <th>%</th>
    </tr>
  `;

  if (!students.length) {
    table.innerHTML += `<tr><td class="table-empty" colspan="5">No student records yet.</td></tr>`;
    updateStats();
    return;
  }

  const max = Math.max(...students.map((student) => student.total));

  for (const student of students) {
    const topBadge = student.total === max ? "<span class=\"tag-top\">TOP</span>" : "";
    table.innerHTML += `
      <tr>
        <td><img src="${getStudentImage(student)}" alt="student photo"></td>
        <td>${escapeHtml(student.name)} ${topBadge}</td>
        <td>${escapeHtml(student.roll)}</td>
        <td>${student.total}</td>
        <td>${student.percentage}%</td>
      </tr>
    `;
  }

  updateStats();
}

function toggleMode() {
  document.body.classList.toggle("dark");
}

function buildStudentFromForm(existingPhoto = "", keepOldPhoto = false) {
  const roll = rollv().trim();
  const name = val("name").trim();
  const phone = val("phone").trim();
  const address = val("address").trim();

  const dsa = num("dsa");
  const os = num("os");
  const dbms = num("dbms");
  const cn = num("cn");

  const total = dsa + os + dbms + cn;
  const percentage = (total / 4).toFixed(2);

  const photoInput = document.getElementById("photo");
  const photo = photoInput.files[0];
  const photoURL = photo ? URL.createObjectURL(photo) : keepOldPhoto ? existingPhoto : "";

  return {
    roll,
    name,
    phone,
    address,
    total,
    percentage,
    photoURL
  };
}

function updateStats() {
  const totalStudents = students.length;
  const topScore = totalStudents ? Math.max(...students.map((student) => student.total)) : 0;
  const averageScore = totalStudents
    ? (students.reduce((sum, student) => sum + Number(student.percentage), 0) / totalStudents).toFixed(2)
    : "0.00";
  const dueFees = (totalStudents * 1500).toLocaleString();

  textOf("statFees", dueFees);
  textOf("statStudents", String(totalStudents));
  textOf("statTopper", String(topScore));
  textOf("statAverage", `${averageScore}%`);
}

function getStudentImage(student) {
  return student.photoURL || DEFAULT_PHOTO;
}

function getTopperTag(student) {
  if (!students.length) {
    return "";
  }

  const max = Math.max(...students.map((item) => item.total));
  return student.total === max ? " <span class=\"tag-top\">TOP</span>" : "";
}

function setResultMessage(message) {
  document.getElementById("result").innerHTML = `<div class="result-empty">${escapeHtml(message)}</div>`;
}

function clearForm() {
  const ids = ["roll", "name", "phone", "address", "dsa", "os", "dbms", "cn", "photo"];
  for (const id of ids) {
    document.getElementById(id).value = "";
  }
}

function textOf(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function val(id) {
  return document.getElementById(id).value;
}

function num(id) {
  const value = Number(val(id));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function rollv() {
  return val("roll");
}

displayStudents();