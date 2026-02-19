const students = [];
let currentView = "profile";
let currentSortSubject = "";

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
  student.dsa = updated.dsa;
  student.os = updated.os;
  student.dbms = updated.dbms;
  student.cn = updated.cn;
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
  currentSortSubject = "";
  students.sort((a, b) => b.total - a.total || a.roll.localeCompare(b.roll));
  setResultMessage("Sorted by topper score.");
  displayStudents();
}

function sortSubjectTopper() {
  const subject = val("subjectSort");

  if (!SUBJECT_LABELS[subject]) {
    alert("Please select a valid subject.");
    return;
  }

  currentSortSubject = subject;
  students.sort(
    (a, b) => getSubjectScore(b, subject) - getSubjectScore(a, subject)
      || b.total - a.total
      || a.roll.localeCompare(b.roll)
  );

  setResultMessage(`Sorted by ${SUBJECT_LABELS[subject]} topper.`);
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
    refreshBoards();
    return;
  }

  const max = Math.max(...students.map((student) => student.total));
  const maxSubjectScore = currentSortSubject
    ? Math.max(...students.map((student) => getSubjectScore(student, currentSortSubject)))
    : -1;
  const subjectLabel = SUBJECT_LABELS[currentSortSubject] ?? "";

  for (const student of students) {
    const topBadge = student.total === max ? "<span class=\"tag-top\">TOP</span>" : "";
    const subjectBadge = currentSortSubject && getSubjectScore(student, currentSortSubject) === maxSubjectScore
      ? `<span class="tag-top">${escapeHtml(subjectLabel)} TOP</span>`
      : "";
    table.innerHTML += `
      <tr>
        <td><img src="${getStudentImage(student)}" alt="student photo"></td>
        <td>${escapeHtml(student.name)} ${topBadge} ${subjectBadge}</td>
        <td>${escapeHtml(student.roll)}</td>
        <td>${student.total}</td>
        <td>${student.percentage}%</td>
      </tr>
    `;
  }

  updateStats();
  refreshBoards();
}

function toggleMode() {
  document.body.classList.toggle("dark");
}

function importStudentsFromExcel() {
  const fileInput = document.getElementById("excelFile");
  const file = fileInput?.files?.[0];

  if (!file) {
    alert("Please choose an Excel file first.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("Excel parser library failed to load. Check internet connection and reload.");
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        setResultMessage("Selected file has no readable sheet.");
        return;
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const parsedRows = parseImportedRows(rows);

      if (!parsedRows.length) {
        setResultMessage("No valid student rows found in the file.");
        return;
      }

      const summary = upsertImportedStudents(parsedRows);
      const message = `Import complete: ${summary.added} added, ${summary.updated} updated, ${summary.skipped} skipped.`;
      setResultMessage(message);
      fileInput.value = "";
      displayStudents();
    } catch (error) {
      console.error(error);
      setResultMessage("Could not import file. Please verify Excel format and column names.");
    }
  };

  reader.readAsArrayBuffer(file);
}

function parseImportedRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return [];
  }

  const headerRow = rows[0].map((cell) => normalizeHeader(cell));
  const looksLikeHeader = hasExpectedHeader(headerRow);
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const parsed = [];

  for (const row of dataRows) {
    if (!Array.isArray(row) || row.every((value) => String(value).trim() === "")) {
      continue;
    }

    const student = looksLikeHeader
      ? parseStudentRowByHeader(row, headerRow)
      : parseStudentRowByIndex(row);

    if (student) {
      parsed.push(student);
    }
  }

  return parsed;
}

function hasExpectedHeader(headerRow) {
  const requiredHeaderFound = getHeaderIndex(headerRow, HEADER_ALIASES.roll) !== -1
    || getHeaderIndex(headerRow, HEADER_ALIASES.name) !== -1;

  const marksHeaderFound = getHeaderIndex(headerRow, HEADER_ALIASES.dsa) !== -1
    || getHeaderIndex(headerRow, HEADER_ALIASES.os) !== -1
    || getHeaderIndex(headerRow, HEADER_ALIASES.dbms) !== -1
    || getHeaderIndex(headerRow, HEADER_ALIASES.cn) !== -1;

  return requiredHeaderFound || marksHeaderFound;
}

function parseStudentRowByHeader(row, headerRow) {
  const roll = getValueByAliases(row, headerRow, HEADER_ALIASES.roll).trim();
  const name = getValueByAliases(row, headerRow, HEADER_ALIASES.name).trim();

  if (!roll || !name) {
    return null;
  }

  const phone = getValueByAliases(row, headerRow, HEADER_ALIASES.phone).trim();
  const address = getValueByAliases(row, headerRow, HEADER_ALIASES.address).trim();

  const dsa = parseMark(getValueByAliases(row, headerRow, HEADER_ALIASES.dsa));
  const os = parseMark(getValueByAliases(row, headerRow, HEADER_ALIASES.os));
  const dbms = parseMark(getValueByAliases(row, headerRow, HEADER_ALIASES.dbms));
  const cn = parseMark(getValueByAliases(row, headerRow, HEADER_ALIASES.cn));

  return createStudentFromImport({ roll, name, phone, address, dsa, os, dbms, cn });
}

function parseStudentRowByIndex(row) {
  const roll = String(row[0] ?? "").trim();
  const name = String(row[1] ?? "").trim();

  if (!roll || !name) {
    return null;
  }

  const phone = String(row[2] ?? "").trim();
  const address = String(row[3] ?? "").trim();

  const dsa = parseMark(row[4]);
  const os = parseMark(row[5]);
  const dbms = parseMark(row[6]);
  const cn = parseMark(row[7]);

  return createStudentFromImport({ roll, name, phone, address, dsa, os, dbms, cn });
}

function upsertImportedStudents(importedStudents) {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const imported of importedStudents) {
    if (!imported.roll || !imported.name) {
      skipped += 1;
      continue;
    }

    const existing = students.find((student) => student.roll === imported.roll);

    if (existing) {
      existing.name = imported.name;
      existing.phone = imported.phone;
      existing.address = imported.address;
      existing.dsa = imported.dsa;
      existing.os = imported.os;
      existing.dbms = imported.dbms;
      existing.cn = imported.cn;
      existing.total = imported.total;
      existing.percentage = imported.percentage;
      updated += 1;
      continue;
    }

    students.push(imported);
    added += 1;
  }

  return { added, updated, skipped };
}

function createStudentFromImport({ roll, name, phone, address, dsa, os, dbms, cn }) {
  const total = dsa + os + dbms + cn;
  const percentage = (total / 4).toFixed(2);

  return {
    roll,
    name,
    phone,
    address,
    dsa,
    os,
    dbms,
    cn,
    total,
    percentage,
    photoURL: ""
  };
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9%]/g, "");
}

function getValueByAliases(row, headerRow, aliases) {
  const index = getHeaderIndex(headerRow, aliases);
  if (index === -1) {
    return "";
  }

  return String(row[index] ?? "");
}

function getHeaderIndex(headerRow, aliases) {
  for (const alias of aliases) {
    const index = headerRow.indexOf(alias);
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function parseMark(value) {
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, numeric));
}

function initSidebarNavigation() {
  const navItems = document.querySelectorAll(".nav-item[data-view]");

  for (const item of navItems) {
    item.addEventListener("click", () => {
      switchView(item.dataset.view);
    });
  }
}

function switchView(view) {
  if (!view) {
    return;
  }

  currentView = view;

  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });

  document.querySelectorAll(".view-section[data-view]").forEach((section) => {
    section.classList.toggle("is-hidden", section.dataset.view !== view);
  });

  refreshBoards();
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
    dsa,
    os,
    dbms,
    cn,
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

function refreshBoards() {
  renderResultsView();
  renderAttendanceView();
  renderMessagesView();
  renderAccountView();
}

function renderResultsView() {
  const board = document.getElementById("resultsBoard");
  if (!board) {
    return;
  }

  if (!students.length) {
    board.innerHTML = `
      <div class="status-item">
        <h3>No result data</h3>
        <p>Add students to see ranking details.</p>
      </div>
    `;
    return;
  }

  const ranked = [...students].sort((a, b) => b.total - a.total || a.roll.localeCompare(b.roll));

  board.innerHTML = ranked
    .map((student, index) => {
      const topper = index === 0 ? ` <span class="tag-top">TOP</span>` : "";
      return `
        <div class="status-item">
          <h3>#${index + 1} ${escapeHtml(student.name)}${topper}</h3>
          <p>Roll ${escapeHtml(student.roll)} | Total ${student.total}/400 | ${student.percentage}%</p>
        </div>
      `;
    })
    .join("");
}

function renderAttendanceView() {
  const board = document.getElementById("attendanceBoard");
  if (!board) {
    return;
  }

  if (!students.length) {
    board.innerHTML = `
      <div class="status-item">
        <h3>No attendance data</h3>
        <p>Add students to generate attendance status.</p>
      </div>
    `;
    return;
  }

  const items = students
    .map((student) => {
      const attendance = Math.max(60, Math.min(99, Math.round(Number(student.percentage) * 0.8 + 20)));
      const status = attendance >= 90 ? "Excellent" : attendance >= 75 ? "Regular" : "Need Improvement";
      return { student, attendance, status };
    })
    .sort((a, b) => b.attendance - a.attendance);

  board.innerHTML = items
    .map(
      ({ student, attendance, status }) => `
        <div class="status-item">
          <h3>${escapeHtml(student.name)} (${escapeHtml(student.roll)})</h3>
          <p>Attendance: ${attendance}% | Status: ${status}</p>
        </div>
      `
    )
    .join("");
}

function renderMessagesView() {
  const board = document.getElementById("messagesBoard");
  if (!board) {
    return;
  }

  if (!students.length) {
    board.innerHTML = `
      <div class="status-item">
        <h3>No messages yet</h3>
        <p>Messages will appear once student records are available.</p>
      </div>
    `;
    return;
  }

  const topper = [...students].sort((a, b) => b.total - a.total || a.roll.localeCompare(b.roll))[0];
  const averageScore = (
    students.reduce((sum, student) => sum + Number(student.percentage), 0) / students.length
  ).toFixed(2);

  board.innerHTML = `
    <div class="status-item">
      <h3>Academic Update</h3>
      <p>Top performer right now is ${escapeHtml(topper.name)} (${escapeHtml(topper.roll)}).</p>
    </div>
    <div class="status-item">
      <h3>Class Performance</h3>
      <p>Current class average is ${averageScore}% with ${students.length} active records.</p>
    </div>
    <div class="status-item">
      <h3>Reminder</h3>
      <p>Use Search to open any record quickly and Update to modify details.</p>
    </div>
  `;
}

function renderAccountView() {
  const board = document.getElementById("accountBoard");
  if (!board) {
    return;
  }

  const today = new Date().toLocaleDateString();
  const totalStudents = students.length;
  const totalFees = (totalStudents * 1500).toLocaleString();

  board.innerHTML = `
    <div class="status-item">
      <h3>Admin Summary</h3>
      <p>Dashboard date: ${today}</p>
    </div>
    <div class="status-item">
      <h3>Records</h3>
      <p>Total student records: ${totalStudents}</p>
    </div>
    <div class="status-item">
      <h3>Fees Snapshot</h3>
      <p>Estimated due fees: ${totalFees}</p>
    </div>
  `;
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

function getSubjectScore(student, subject) {
  const score = Number(student?.[subject]);
  return Number.isFinite(score) ? score : 0;
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

const HEADER_ALIASES = {
  roll: ["roll", "rollno", "rollnumber", "admissionid", "studentid", "id"],
  name: ["name", "studentname", "fullname", "student"],
  phone: ["phone", "phoneno", "phonenumber", "mobile", "mobileno", "contact", "contactno"],
  address: ["address", "addr", "location"],
  dsa: ["dsa", "dsamarks", "dsa_score", "dsascore"],
  os: ["os", "osmarks", "os_score", "osscore", "operatingsystem", "operatingsystems"],
  dbms: ["dbms", "dbmsmarks", "dbms_score", "dbmsscore"],
  cn: ["cn", "cnmarks", "cn_score", "cnscore", "computernetwork", "computernetworks"]
};

const SUBJECT_LABELS = {
  dsa: "DSA",
  os: "OS",
  dbms: "DBMS",
  cn: "CN"
};

initSidebarNavigation();
switchView("profile");
displayStudents();
