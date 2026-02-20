const students = [];
let currentView = "profile";
let currentSortSubject = "";
const attendanceByDate = Object.create(null);
const receipts = [];
let currentAttendanceDate = getTodayISO();

const filters = { query: "", fee: "all", topper: "all" };
const chartState = { avgTrend: null, subjectWise: null, feeSplit: null };

const STORAGE_KEYS = {
  students: "sms_students_v2",
  attendanceByDate: "sms_attendance_by_date_v2",
  receipts: "sms_receipts_v2",
  theme: "sms_theme_v1",
  attendanceDate: "sms_attendance_date_v1"
};

const DEFAULT_TOTAL_FEE = 1500;
const LATE_FEE_RATE_PER_30_DAYS = 0.02;
const DEFAULT_PAYMENT_METHOD = "Cash";

const HEADER_ALIASES = {
  roll: ["roll", "rollno", "rollnumber", "admissionid", "studentid", "id"],
  name: ["name", "studentname", "fullname", "student"],
  phone: ["phone", "phoneno", "phonenumber", "mobile", "mobileno", "contact", "contactno"],
  address: ["address", "addr", "location"],
  dsa: ["dsa", "dsamarks", "dsa_score", "dsascore"],
  os: ["os", "osmarks", "os_score", "osscore", "operatingsystem", "operatingsystems"],
  dbms: ["dbms", "dbmsmarks", "dbms_score", "dbmsscore"],
  cn: ["cn", "cnmarks", "cn_score", "cnscore", "computernetwork", "computernetworks"],
  feetotal: ["feetotal", "totalfee", "feestotal", "fees", "annualfee", "amount"],
  feepaid: ["feepaid", "paidfee", "paid", "amountpaid", "payment"],
  feedue: ["feedue", "leftfee", "duefee", "pendingfee", "balance", "remainingfee"],
  feeduedate: ["feeduedate", "duedate", "lastdate", "paymentduedate"]
};

const SUBJECT_LABELS = { dsa: "DSA", os: "OS", dbms: "DBMS", cn: "CN" };

const DEFAULT_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#dbe7f4"/>
  <circle cx="60" cy="42" r="20" fill="#86a8c9"/>
  <path d="M24 109c4-22 17-33 36-33s32 11 36 33" fill="#86a8c9"/>
</svg>
`)}`;
let previewPhotoURL = "";

function val(id) {
  const node = document.getElementById(id);
  return node ? node.value : "";
}

function textOf(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.value = value;
  }
}

function rollv() {
  return val("roll");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseMark(value) {
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, numeric));
}

function parseMoney(value, fallback = 0) {
  const numeric = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, numeric);
}

function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

function formatAmount(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: safeAmount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9%]/g, "");
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return dateToISO(date);
}

function normalizeDateTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function dateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromISO(isoDate) {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function getTodayISO() {
  return dateToISO(new Date());
}

function getDefaultDueDateISO() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return dateToISO(date);
}

function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map((item) => Number(item));
  if (!year || !month) {
    return monthKey;
  }
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function normalizeFeeValues(feeTotalValue, feePaidValue, feeDueValue = "") {
  let feeTotal = parseMoney(feeTotalValue, DEFAULT_TOTAL_FEE);
  if (feeTotal <= 0) {
    feeTotal = DEFAULT_TOTAL_FEE;
  }

  let feePaid;
  if (hasValue(feePaidValue)) {
    feePaid = parseMoney(feePaidValue, 0);
  } else if (hasValue(feeDueValue)) {
    const feeDue = Math.min(parseMoney(feeDueValue, feeTotal), feeTotal);
    feePaid = feeTotal - feeDue;
  } else {
    feePaid = 0;
  }

  feePaid = Math.min(Math.max(0, feePaid), feeTotal);
  return { feeTotal, feePaid, feeDue: Math.max(0, feeTotal - feePaid) };
}

function getInstallmentTotalFromArray(installments) {
  if (!Array.isArray(installments)) {
    return 0;
  }
  return installments.reduce((sum, item) => sum + parseMoney(item?.amount, 0), 0);
}

function getInstallmentTotal(student) {
  return getInstallmentTotalFromArray(student?.installments ?? []);
}

function calculateLateFee(feeDue, dueDateValue) {
  if (feeDue <= 0) {
    return 0;
  }

  const dueDate = normalizeDate(dueDateValue);
  if (!dueDate) {
    return 0;
  }

  const due = dateFromISO(dueDate);
  const today = dateFromISO(getTodayISO());
  const diffMs = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 0;
  }

  const periods = Math.ceil(diffDays / 30);
  return Number((feeDue * LATE_FEE_RATE_PER_30_DAYS * periods).toFixed(2));
}

function getFeeInfo(student) {
  const fees = normalizeFeeValues(student?.feeTotal, student?.feePaid);
  const installmentTotal = getInstallmentTotal(student);
  const feePaid = Math.min(fees.feeTotal, Math.max(fees.feePaid, installmentTotal));
  const feeDue = Math.max(0, fees.feeTotal - feePaid);
  const lateFee = calculateLateFee(feeDue, student?.feeDueDate);

  return {
    feeTotal: fees.feeTotal,
    feePaid,
    feeDue,
    lateFee,
    totalPayable: feeDue + lateFee
  };
}

function getFeeTotals() {
  return students.reduce(
    (totals, student) => {
      const info = getFeeInfo(student);
      totals.total += info.feeTotal;
      totals.paid += info.feePaid;
      totals.due += info.feeDue;
      totals.late += info.lateFee;
      return totals;
    },
    { total: 0, paid: 0, due: 0, late: 0 }
  );
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

function getRecentInstallments(student, count) {
  if (!Array.isArray(student.installments)) {
    return [];
  }
  return [...student.installments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}

function setNodeText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function setBarPercent(id, percent) {
  const node = document.getElementById(id);
  if (node) {
    node.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function formatShortDate(isoDate) {
  if (!isoDate) {
    return "-";
  }
  const date = dateFromISO(isoDate);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function getGradeMeta(percentage) {
  if (percentage >= 90) {
    return { label: "A+", className: "grade-top" };
  }
  if (percentage >= 80) {
    return { label: "A", className: "grade-high" };
  }
  if (percentage >= 65) {
    return { label: "B", className: "grade-mid" };
  }
  if (percentage >= 45) {
    return { label: "C", className: "grade-basic" };
  }
  return { label: "D", className: "grade-low" };
}

function updateFormPreview() {
  const name = val("name").trim() || "Student Name";
  const roll = rollv().trim() || "-";

  const dsa = parseMark(val("dsa"));
  const os = parseMark(val("os"));
  const dbms = parseMark(val("dbms"));
  const cn = parseMark(val("cn"));

  const total = dsa + os + dbms + cn;
  const academicPercent = Math.round((total / 400) * 100);

  const fees = normalizeFeeValues(val("feeTotal"), val("feePaid"));
  const feePercent = fees.feeTotal > 0 ? Math.round((fees.feePaid / fees.feeTotal) * 100) : 0;

  const dueDate = normalizeDate(val("feeDueDate"));
  const gradeMeta = getGradeMeta(academicPercent);

  setNodeText("previewName", name);
  setNodeText("previewRoll", `Roll ${roll}`);
  setNodeText("previewAcademicPercent", `${academicPercent}%`);
  setNodeText("previewFeePercent", `${feePercent}%`);
  setNodeText("previewDueTag", dueDate ? `Due ${formatShortDate(dueDate)}` : "Due Date -");
  setNodeText("previewTotalTag", `Total ${total} / 400`);

  setBarPercent("previewAcademicBar", academicPercent);
  setBarPercent("previewFeeBar", feePercent);

  const gradeNode = document.getElementById("previewGrade");
  if (gradeNode) {
    gradeNode.textContent = `Grade ${gradeMeta.label}`;
    gradeNode.className = `preview-grade ${gradeMeta.className}`;
  }

  const previewPhoto = document.getElementById("previewPhoto");
  if (previewPhoto) {
    previewPhoto.src = previewPhotoURL || DEFAULT_PHOTO;
  }
}

async function handlePreviewPhotoChange() {
  const photoInput = document.getElementById("photo");
  const photo = photoInput?.files?.[0];

  if (!photo || !photo.type.startsWith("image/")) {
    previewPhotoURL = "";
    updateFormPreview();
    return;
  }

  try {
    previewPhotoURL = await readFileAsDataURL(photo);
  } catch (error) {
    console.error(error);
    previewPhotoURL = "";
  }

  updateFormPreview();
}

function resetFeeInputs() {
  textOf("feeTotal", String(DEFAULT_TOTAL_FEE));
  textOf("feePaid", "0");
  textOf("feeDueDate", getDefaultDueDateISO());
  textOf("paymentDate", getTodayISO());
  textOf("paymentMethod", DEFAULT_PAYMENT_METHOD);
  updateFormPreview();
}

function clearForm() {
  const ids = ["roll", "name", "phone", "address", "dsa", "os", "dbms", "cn", "feeTotal", "feePaid", "feeDueDate", "photo"];
  for (const id of ids) {
    textOf(id, "");
  }
  previewPhotoURL = "";
  resetFeeInputs();
  updateFormPreview();
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getAttendanceStoreForDate(date, createIfMissing) {
  const normalizedDate = normalizeDate(date) || getTodayISO();
  if (!attendanceByDate[normalizedDate] && createIfMissing) {
    attendanceByDate[normalizedDate] = Object.create(null);
  }
  return attendanceByDate[normalizedDate] || null;
}

function cleanupAttendanceDate(date) {
  const store = attendanceByDate[date];
  if (store && !Object.keys(store).length) {
    delete attendanceByDate[date];
  }
}

function removeRollFromAttendance(roll) {
  for (const date of Object.keys(attendanceByDate)) {
    if (attendanceByDate[date][roll]) {
      delete attendanceByDate[date][roll];
      cleanupAttendanceDate(date);
    }
  }
}

function syncAttendanceStore() {
  let changed = false;
  const validRolls = new Set(students.map((student) => student.roll));

  for (const [date, dayStore] of Object.entries(attendanceByDate)) {
    for (const roll of Object.keys(dayStore)) {
      const status = dayStore[roll];
      if (!validRolls.has(roll) || (status !== "present" && status !== "absent")) {
        delete dayStore[roll];
        changed = true;
      }
    }
    if (!Object.keys(dayStore).length) {
      delete attendanceByDate[date];
      changed = true;
    }
  }

  return changed;
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
    localStorage.setItem(STORAGE_KEYS.attendanceByDate, JSON.stringify(attendanceByDate));
    localStorage.setItem(STORAGE_KEYS.receipts, JSON.stringify(receipts));
    localStorage.setItem(STORAGE_KEYS.attendanceDate, currentAttendanceDate);
  } catch (error) {
    console.error(error);
  }
}
async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Invalid image result"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

async function getPhotoDataURL(fallback) {
  const photoInput = document.getElementById("photo");
  const photo = photoInput?.files?.[0];

  if (!photo || !photo.type.startsWith("image/")) {
    return fallback || "";
  }

  return readFileAsDataURL(photo);
}

async function buildStudentFromForm(existingStudent = null) {
  const roll = rollv().trim();
  const name = val("name").trim();
  const phone = val("phone").trim();
  const address = val("address").trim();

  const dsa = parseMark(val("dsa"));
  const os = parseMark(val("os"));
  const dbms = parseMark(val("dbms"));
  const cn = parseMark(val("cn"));
  const fees = normalizeFeeValues(val("feeTotal"), val("feePaid"));
  const feeDueDate = normalizeDate(val("feeDueDate")) || existingStudent?.feeDueDate || getDefaultDueDateISO();

  const total = dsa + os + dbms + cn;
  const percentage = (total / 4).toFixed(2);
  const photoURL = await getPhotoDataURL(existingStudent?.photoURL || "");

  const installments = Array.isArray(existingStudent?.installments)
    ? existingStudent.installments.map((item) => ({ ...item }))
    : [];
  const installmentTotal = getInstallmentTotalFromArray(installments);
  const feePaid = Math.min(fees.feeTotal, Math.max(fees.feePaid, installmentTotal));
  const now = new Date().toISOString();

  return {
    roll,
    name,
    phone,
    address,
    dsa,
    os,
    dbms,
    cn,
    feeTotal: fees.feeTotal,
    feePaid,
    feeDueDate,
    installments,
    total,
    percentage,
    photoURL,
    createdAt: existingStudent?.createdAt || now,
    updatedAt: now
  };
}

async function addStudent() {
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

  try {
    const student = await buildStudentFromForm();
    students.push(student);
    persistState();
    clearForm();
    setResultMessage("Student added successfully.");
    displayStudents();
  } catch (error) {
    console.error(error);
    alert("Could not read photo. Try another image.");
  }
}

async function updateStudent() {
  const roll = rollv().trim();
  const existing = students.find((item) => item.roll === roll);

  if (!roll || !existing) {
    alert("Enter a valid roll number to update.");
    return;
  }

  try {
    const updated = await buildStudentFromForm(existing);
    Object.assign(existing, updated);
    persistState();
    clearForm();
    setResultMessage("Student record updated.");
    displayStudents();
  } catch (error) {
    console.error(error);
    alert("Could not update student photo. Try another image.");
  }
}

function deleteStudent() {
  const roll = rollv().trim();
  const index = students.findIndex((student) => student.roll === roll);

  if (!roll || index === -1) {
    alert("Enter a valid roll number to delete.");
    return;
  }

  students.splice(index, 1);
  removeRollFromAttendance(roll);
  persistState();
  clearForm();
  setResultMessage("Student record deleted.");
  displayStudents();
}

function findStudentsByQuery(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const exactRoll = students.find((student) => student.roll.toLowerCase() === q);
  if (exactRoll) {
    return [exactRoll];
  }

  return students
    .filter((student) => {
      return student.name.toLowerCase().includes(q)
        || student.roll.toLowerCase().includes(q)
        || (student.phone || "").toLowerCase().includes(q);
    })
    .sort((a, b) => b.total - a.total || a.roll.localeCompare(b.roll));
}

function renderStudentResultCard(student, showInstallments) {
  const topperTag = getTopperTag(student);
  const feeInfo = getFeeInfo(student);
  const installmentCount = Array.isArray(student.installments) ? student.installments.length : 0;
  const dueDate = student.feeDueDate || "-";
  const recentInstallments = getRecentInstallments(student, 3);

  const installmentHtml = showInstallments
    ? `
      <div class="result-sub">
        <strong>Installments:</strong> ${installmentCount}
        ${recentInstallments.length
          ? `
            <ul class="mini-list">
              ${recentInstallments
                .map((item) => `<li>${escapeHtml(item.date)} - ${formatAmount(item.amount)} (${escapeHtml(item.method)})</li>`)
                .join("")}
            </ul>
          `
          : "<p>No installments yet.</p>"
        }
      </div>
    `
    : "";

  return `
    <div class="result-card">
      <img class="result-avatar" src="${getStudentImage(student)}" alt="student photo">
      <div class="result-details">
        <h3>${escapeHtml(student.name)}${topperTag}</h3>
        <p><span>Roll:</span> ${escapeHtml(student.roll)}</p>
        <p><span>Phone:</span> ${escapeHtml(student.phone || "-")}</p>
        <p><span>Address:</span> ${escapeHtml(student.address || "-")}</p>
        <p><span>Total:</span> ${student.total} / 400</p>
        <p><span>Percentage:</span> ${student.percentage}%</p>
        <p><span>Total Fee:</span> ${formatAmount(feeInfo.feeTotal)}</p>
        <p><span>Paid Fee:</span> ${formatAmount(feeInfo.feePaid)}</p>
        <p><span>Left Fee:</span> ${formatAmount(feeInfo.feeDue)}</p>
        <p><span>Late Fee:</span> ${formatAmount(feeInfo.lateFee)}</p>
        <p><span>Due Date:</span> ${escapeHtml(dueDate)}</p>
        ${installmentHtml}
      </div>
    </div>
  `;
}

function searchStudent() {
  const query = val("searchRoll").trim();

  if (!query) {
    setResultMessage("Enter roll, name, or phone to search.");
    return;
  }

  const matches = findStudentsByQuery(query);
  if (!matches.length) {
    setResultMessage("Student not found.");
    return;
  }

  const result = document.getElementById("result");
  if (matches.length === 1) {
    result.innerHTML = renderStudentResultCard(matches[0], true);
    return;
  }

  result.innerHTML = `
    <div class="result-list">
      ${matches.slice(0, 6).map((student) => renderStudentResultCard(student, false)).join("")}
    </div>
  `;
}

function sortTopper() {
  currentSortSubject = "";
  students.sort((a, b) => b.total - a.total || a.roll.localeCompare(b.roll));
  persistState();
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

  persistState();
  setResultMessage(`Sorted by ${SUBJECT_LABELS[subject]} topper.`);
  displayStudents();
}

function getFilteredStudents() {
  let filtered = [...students];
  const query = filters.query.trim().toLowerCase();

  if (query) {
    filtered = filtered.filter((student) => {
      return student.roll.toLowerCase().includes(query)
        || student.name.toLowerCase().includes(query)
        || (student.phone || "").toLowerCase().includes(query);
    });
  }

  if (filters.fee === "due") {
    filtered = filtered.filter((student) => getFeeInfo(student).feeDue > 0);
  } else if (filters.fee === "paid") {
    filtered = filtered.filter((student) => getFeeInfo(student).feeDue === 0);
  }

  if (filters.topper === "topper" && students.length) {
    const max = Math.max(...students.map((student) => student.total));
    filtered = filtered.filter((student) => student.total === max);
  }

  return filtered;
}

function displayStudents() {
  const table = document.getElementById("table");
  const attendanceChanged = syncAttendanceStore();
  if (attendanceChanged) {
    persistState();
  }

  const visibleStudents = getFilteredStudents();

  table.innerHTML = `
    <tr>
      <th>Photo</th>
      <th>Name</th>
      <th>Roll</th>
      <th>Total</th>
      <th>%</th>
      <th>Paid</th>
      <th>Left</th>
      <th>Late Fee</th>
    </tr>
  `;

  if (!students.length) {
    table.innerHTML += `<tr><td class="table-empty" colspan="8">No student records yet.</td></tr>`;
    updateStats();
    refreshBoards();
    return;
  }

  if (!visibleStudents.length) {
    table.innerHTML += `<tr><td class="table-empty" colspan="8">No records match current filters.</td></tr>`;
    updateStats();
    refreshBoards();
    return;
  }

  const maxTotal = Math.max(...students.map((student) => student.total));
  const maxSubjectScore = currentSortSubject
    ? Math.max(...students.map((student) => getSubjectScore(student, currentSortSubject)))
    : -1;
  const subjectLabel = SUBJECT_LABELS[currentSortSubject] ?? "";

  for (const student of visibleStudents) {
    const topBadge = student.total === maxTotal ? "<span class=\"tag-top\">TOP</span>" : "";
    const subjectBadge = currentSortSubject && getSubjectScore(student, currentSortSubject) === maxSubjectScore
      ? `<span class="tag-top">${escapeHtml(subjectLabel)} TOP</span>`
      : "";
    const feeInfo = getFeeInfo(student);
    const dueChip = feeInfo.feeDue === 0
      ? `<span class="fee-chip fee-paid">Paid</span>`
      : `<span class="fee-chip fee-left">${formatAmount(feeInfo.feeDue)} left</span>`;
    const lateFee = feeInfo.lateFee > 0 ? formatAmount(feeInfo.lateFee) : "-";

    table.innerHTML += `
      <tr>
        <td><img src="${getStudentImage(student)}" alt="student photo"></td>
        <td>${escapeHtml(student.name)} ${topBadge} ${subjectBadge}</td>
        <td>${escapeHtml(student.roll)}</td>
        <td>${student.total}</td>
        <td>${student.percentage}%</td>
        <td>${formatAmount(feeInfo.feePaid)}</td>
        <td>${dueChip}</td>
        <td>${lateFee}</td>
      </tr>
    `;
  }

  updateStats();
  refreshBoards();
}

function toggleMode() {
  document.body.classList.toggle("dark");
  const mode = document.body.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem(STORAGE_KEYS.theme, mode);
}

function initSidebarNavigation() {
  const navItems = document.querySelectorAll(".nav-item[data-view]");
  for (const item of navItems) {
    item.addEventListener("click", () => switchView(item.dataset.view));
  }
}

function initFilterControls() {
  const topSearch = document.getElementById("topSearch");
  const feeFilter = document.getElementById("filterFeeStatus");
  const topperFilter = document.getElementById("filterTopperStatus");

  if (topSearch) {
    topSearch.addEventListener("input", () => {
      filters.query = topSearch.value;
      displayStudents();
    });
  }

  if (feeFilter) {
    feeFilter.addEventListener("change", () => {
      filters.fee = feeFilter.value;
      displayStudents();
    });
  }

  if (topperFilter) {
    topperFilter.addEventListener("change", () => {
      filters.topper = topperFilter.value;
      displayStudents();
    });
  }
}

function initFormPreview() {
  const previewInputIds = ["roll", "name", "dsa", "os", "dbms", "cn", "feeTotal", "feePaid", "feeDueDate"];
  for (const id of previewInputIds) {
    const input = document.getElementById(id);
    if (!input) {
      continue;
    }
    input.addEventListener("input", updateFormPreview);
    input.addEventListener("change", updateFormPreview);
  }

  const photoInput = document.getElementById("photo");
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      handlePreviewPhotoChange();
    });
  }

  updateFormPreview();
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

function updateStats() {
  const totalStudents = students.length;
  const topScore = totalStudents ? Math.max(...students.map((student) => student.total)) : 0;
  const averageScore = totalStudents
    ? (students.reduce((sum, student) => sum + Number(student.percentage), 0) / totalStudents).toFixed(2)
    : "0.00";
  const feeTotals = getFeeTotals();

  const statFees = document.getElementById("statFees");
  const statStudents = document.getElementById("statStudents");
  const statTopper = document.getElementById("statTopper");
  const statAverage = document.getElementById("statAverage");

  if (statFees) statFees.textContent = formatAmount(feeTotals.due + feeTotals.late);
  if (statStudents) statStudents.textContent = String(totalStudents);
  if (statTopper) statTopper.textContent = String(topScore);
  if (statAverage) statAverage.textContent = `${averageScore}%`;
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
  const feeTotal = getValueByAliases(row, headerRow, HEADER_ALIASES.feetotal);
  const feePaid = getValueByAliases(row, headerRow, HEADER_ALIASES.feepaid);
  const feeDue = getValueByAliases(row, headerRow, HEADER_ALIASES.feedue);
  const feeDueDate = getValueByAliases(row, headerRow, HEADER_ALIASES.feeduedate);

  return createStudentFromImport({ roll, name, phone, address, dsa, os, dbms, cn, feeTotal, feePaid, feeDue, feeDueDate });
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
  const feeTotal = row[8] ?? "";
  const feePaid = row[9] ?? "";
  const feeDue = row[10] ?? "";
  const feeDueDate = row[11] ?? "";

  return createStudentFromImport({ roll, name, phone, address, dsa, os, dbms, cn, feeTotal, feePaid, feeDue, feeDueDate });
}

function createStudentFromImport({ roll, name, phone, address, dsa, os, dbms, cn, feeTotal, feePaid, feeDue, feeDueDate }) {
  const total = dsa + os + dbms + cn;
  const percentage = (total / 4).toFixed(2);
  const fees = normalizeFeeValues(feeTotal, feePaid, feeDue);
  const now = new Date().toISOString();

  return {
    roll,
    name,
    phone,
    address,
    dsa,
    os,
    dbms,
    cn,
    feeTotal: fees.feeTotal,
    feePaid: fees.feePaid,
    feeDueDate: normalizeDate(feeDueDate) || getDefaultDueDateISO(),
    installments: [],
    total,
    percentage,
    photoURL: "",
    createdAt: now,
    updatedAt: now
  };
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
    if (!existing) {
      students.push(imported);
      added += 1;
      continue;
    }

    const existingInstallments = Array.isArray(existing.installments) ? existing.installments : [];
    const installmentTotal = getInstallmentTotalFromArray(existingInstallments);
    const normalizedPaid = Math.min(imported.feeTotal, Math.max(imported.feePaid, installmentTotal));

    existing.name = imported.name;
    existing.phone = imported.phone;
    existing.address = imported.address;
    existing.dsa = imported.dsa;
    existing.os = imported.os;
    existing.dbms = imported.dbms;
    existing.cn = imported.cn;
    existing.feeTotal = imported.feeTotal;
    existing.feePaid = normalizedPaid;
    existing.feeDueDate = imported.feeDueDate;
    existing.total = imported.total;
    existing.percentage = imported.percentage;
    existing.updatedAt = new Date().toISOString();
    updated += 1;
  }

  return { added, updated, skipped };
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
      setResultMessage(`Import complete: ${summary.added} added, ${summary.updated} updated, ${summary.skipped} skipped.`);
      fileInput.value = "";
      persistState();
      displayStudents();
    } catch (error) {
      console.error(error);
      setResultMessage("Could not import file. Please verify Excel format and column names.");
    }
  };

  reader.readAsArrayBuffer(file);
}

function getExportRows(sourceStudents) {
  return sourceStudents.map((student) => {
    const fee = getFeeInfo(student);
    const monthPct = getMonthlyAttendancePercentage(student.roll, currentAttendanceDate).toFixed(2);

    return {
      Roll: student.roll,
      Name: student.name,
      Phone: student.phone || "",
      Address: student.address || "",
      DSA: student.dsa,
      OS: student.os,
      DBMS: student.dbms,
      CN: student.cn,
      Total: student.total,
      Percentage: student.percentage,
      FeeTotal: fee.feeTotal,
      FeePaid: fee.feePaid,
      FeeDue: fee.feeDue,
      LateFee: fee.lateFee,
      DueDate: student.feeDueDate || "",
      Installments: Array.isArray(student.installments) ? student.installments.length : 0,
      AttendanceMonthPct: monthPct
    };
  });
}

function convertRowsToCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers.map((header) => csvEscape(row[header])).join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

function exportStudentsCSV() {
  const rows = getExportRows(getFilteredStudents());
  if (!rows.length) {
    alert("No records available to export.");
    return;
  }

  const csv = convertRowsToCsv(rows);
  downloadTextFile(`students_${getTodayISO()}.csv`, csv, "text/csv;charset=utf-8");
}

function exportStudentsExcel() {
  const rows = getExportRows(getFilteredStudents());
  if (!rows.length) {
    alert("No records available to export.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("Excel library not loaded. Exporting CSV instead.");
    exportStudentsCSV();
    return;
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Students");
  XLSX.writeFile(workbook, `students_${getTodayISO()}.xlsx`);
}

function recordPayment() {
  const roll = val("paymentRoll").trim();
  const amount = parseMoney(val("paymentAmount"), 0);
  const paymentDate = normalizeDate(val("paymentDate")) || getTodayISO();
  const method = val("paymentMethod") || DEFAULT_PAYMENT_METHOD;
  const note = val("paymentNote").trim();

  if (!roll) {
    alert("Enter roll number for installment payment.");
    return;
  }

  if (amount <= 0) {
    alert("Enter a valid installment amount.");
    return;
  }

  const student = students.find((item) => item.roll === roll);
  if (!student) {
    alert("Student not found for this roll number.");
    return;
  }

  const before = getFeeInfo(student);
  if (before.feeDue <= 0) {
    setResultMessage("No pending fee for this student.");
    return;
  }

  const appliedAmount = Math.min(amount, before.feeDue);
  const installment = {
    id: createId("INS"),
    date: paymentDate,
    amount: appliedAmount,
    method,
    note
  };

  if (!Array.isArray(student.installments)) {
    student.installments = [];
  }
  student.installments.push(installment);
  student.feePaid = Math.min(before.feeTotal, before.feePaid + appliedAmount);
  student.updatedAt = new Date().toISOString();

  const after = getFeeInfo(student);
  const receipt = {
    id: createId("RCPT"),
    roll: student.roll,
    studentName: student.name,
    date: paymentDate,
    amount: appliedAmount,
    method,
    note,
    feeTotal: after.feeTotal,
    feePaid: after.feePaid,
    feeDue: after.feeDue,
    lateFee: after.lateFee
  };
  receipts.unshift(receipt);
  if (receipts.length > 800) {
    receipts.length = 800;
  }

  const extra = amount - appliedAmount;
  const extraText = extra > 0 ? ` Extra ${formatAmount(extra)} not applied.` : "";

  persistState();
  displayStudents();
  setResultMessage(`Installment recorded. Receipt ${receipt.id}.${extraText}`);
  textOf("paymentAmount", "");
  textOf("paymentNote", "");
}

function openReceiptWindow(student, receipt) {
  const win = window.open("", "_blank", "width=760,height=860");
  if (!win) {
    alert("Popup blocked. Allow popups and try again.");
    return;
  }

  win.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Fee Receipt - ${escapeHtml(receipt.id)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1d2f49; }
        h1 { margin: 0 0 6px; }
        p { margin: 6px 0; }
        .box { border: 1px solid #d1dceb; border-radius: 8px; padding: 12px; margin-top: 12px; }
      </style>
    </head>
    <body>
      <h1>Fee Receipt</h1>
      <p>Generated on ${escapeHtml(new Date().toLocaleString())}</p>
      <div class="box">
        <p><strong>Receipt No:</strong> ${escapeHtml(receipt.id)}</p>
        <p><strong>Student:</strong> ${escapeHtml(student.name)} (${escapeHtml(student.roll)})</p>
        <p><strong>Date:</strong> ${escapeHtml(receipt.date)}</p>
        <p><strong>Paid Amount:</strong> ${formatAmount(receipt.amount)}</p>
        <p><strong>Payment Method:</strong> ${escapeHtml(receipt.method)}</p>
        <p><strong>Note:</strong> ${escapeHtml(receipt.note || "-")}</p>
      </div>
      <div class="box">
        <p><strong>Total Fee:</strong> ${formatAmount(receipt.feeTotal)}</p>
        <p><strong>Total Paid:</strong> ${formatAmount(receipt.feePaid)}</p>
        <p><strong>Remaining Due:</strong> ${formatAmount(receipt.feeDue)}</p>
        <p><strong>Current Late Fee:</strong> ${formatAmount(receipt.lateFee)}</p>
      </div>
    </body>
    </html>
  `);

  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function generateFeeReceipt() {
  const roll = val("paymentRoll").trim() || val("searchRoll").trim();
  if (!roll) {
    alert("Enter roll in Payment Roll or Search field first.");
    return;
  }

  const student = students.find((item) => item.roll === roll);
  if (!student) {
    alert("Student not found for this roll number.");
    return;
  }

  const receipt = receipts.find((item) => item.roll === roll);
  if (!receipt) {
    setResultMessage("No receipt found. Record an installment first.");
    return;
  }

  openReceiptWindow(student, receipt);
}

function printReportCard() {
  const query = val("searchRoll").trim() || val("paymentRoll").trim();
  let student = null;

  if (query) {
    student = students.find((item) => item.roll === query) || findStudentsByQuery(query)[0] || null;
  } else if (students.length) {
    student = students[0];
  }

  if (!student) {
    alert("Search a student first, then click Print Report Card.");
    return;
  }

  const fee = getFeeInfo(student);
  const monthPct = getMonthlyAttendancePercentage(student.roll, currentAttendanceDate).toFixed(2);
  const installments = getRecentInstallments(student, 6);

  const win = window.open("", "_blank", "width=880,height=900");
  if (!win) {
    alert("Popup blocked. Allow popups and try again.");
    return;
  }

  win.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Report Card - ${escapeHtml(student.name)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1a2d45; }
        h1, h2 { margin: 0 0 8px; }
        .meta { margin: 0 0 14px; color: #435f80; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cdd8e6; padding: 8px 10px; text-align: left; }
        th { background: #edf3fb; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
        .box { border: 1px solid #cdd8e6; border-radius: 8px; padding: 10px; }
      </style>
    </head>
    <body>
      <h1>Student Report Card</h1>
      <p class="meta">Generated on ${escapeHtml(new Date().toLocaleString())}</p>
      <div class="box">
        <p><strong>Name:</strong> ${escapeHtml(student.name)}</p>
        <p><strong>Roll:</strong> ${escapeHtml(student.roll)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(student.phone || "-")}</p>
        <p><strong>Address:</strong> ${escapeHtml(student.address || "-")}</p>
      </div>

      <div class="grid">
        <div class="box">
          <h2>Academic</h2>
          <table>
            <tr><th>Subject</th><th>Marks</th></tr>
            <tr><td>DSA</td><td>${student.dsa}</td></tr>
            <tr><td>OS</td><td>${student.os}</td></tr>
            <tr><td>DBMS</td><td>${student.dbms}</td></tr>
            <tr><td>CN</td><td>${student.cn}</td></tr>
            <tr><th>Total</th><th>${student.total} / 400</th></tr>
            <tr><th>Percentage</th><th>${student.percentage}%</th></tr>
          </table>
        </div>
        <div class="box">
          <h2>Fee + Attendance</h2>
          <p><strong>Total Fee:</strong> ${formatAmount(fee.feeTotal)}</p>
          <p><strong>Paid:</strong> ${formatAmount(fee.feePaid)}</p>
          <p><strong>Due:</strong> ${formatAmount(fee.feeDue)}</p>
          <p><strong>Late Fee:</strong> ${formatAmount(fee.lateFee)}</p>
          <p><strong>Due Date:</strong> ${escapeHtml(student.feeDueDate || "-")}</p>
          <p><strong>Monthly Attendance:</strong> ${monthPct}%</p>
        </div>
      </div>

      <div class="box" style="margin-top:14px;">
        <h2>Recent Installments</h2>
        ${installments.length
          ? `
            <table>
              <tr><th>Date</th><th>Amount</th><th>Method</th><th>Note</th></tr>
              ${installments
                .map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${formatAmount(item.amount)}</td><td>${escapeHtml(item.method)}</td><td>${escapeHtml(item.note || "-")}</td></tr>`)
                .join("")}
            </table>
          `
          : "<p>No installments recorded yet.</p>"
        }
      </div>
    </body>
    </html>
  `);

  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
function setAttendance(roll, status) {
  if (!roll) {
    return;
  }

  const dayStore = getAttendanceStoreForDate(currentAttendanceDate, true);
  if (status === "present" || status === "absent") {
    dayStore[roll] = status;
  } else {
    delete dayStore[roll];
  }

  cleanupAttendanceDate(currentAttendanceDate);
  persistState();

  if (currentView === "attendance") {
    renderAttendanceView();
  }
}

function markAllAttendance(status) {
  if (status !== "present" && status !== "absent") {
    return;
  }

  const dayStore = getAttendanceStoreForDate(currentAttendanceDate, true);
  for (const student of students) {
    dayStore[student.roll] = status;
  }

  persistState();
  if (currentView === "attendance") {
    renderAttendanceView();
  }
}

function clearAttendanceMarks() {
  delete attendanceByDate[currentAttendanceDate];
  persistState();

  if (currentView === "attendance") {
    renderAttendanceView();
  }
}

function getAttendanceStatusLabel(status) {
  if (status === "present") return "Present";
  if (status === "absent") return "Absent";
  return "Not Marked";
}

function getAttendanceSummary(date) {
  const dayStore = getAttendanceStoreForDate(date, false);
  let present = 0;
  let absent = 0;
  let unmarked = 0;

  for (const student of students) {
    const status = dayStore?.[student.roll];
    if (status === "present") {
      present += 1;
    } else if (status === "absent") {
      absent += 1;
    } else {
      unmarked += 1;
    }
  }

  return { present, absent, unmarked };
}

function getMonthlyAttendancePercentage(roll, dateISO) {
  const monthKey = String(dateISO || "").slice(0, 7);
  if (!monthKey) {
    return 0;
  }

  let present = 0;
  let marked = 0;

  for (const [date, dayStore] of Object.entries(attendanceByDate)) {
    if (!date.startsWith(monthKey)) {
      continue;
    }

    const status = dayStore?.[roll];
    if (status === "present") {
      present += 1;
      marked += 1;
    } else if (status === "absent") {
      marked += 1;
    }
  }

  return marked ? (present / marked) * 100 : 0;
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
  const filteredCount = getFilteredStudents().length;

  board.innerHTML = `
    <div class="status-item">
      <h3>Records in view</h3>
      <p>${filteredCount} of ${students.length} records match current filters.</p>
    </div>
    ${ranked
      .slice(0, 8)
      .map((student, index) => {
        const topper = index === 0 ? ` <span class="tag-top">TOP</span>` : "";
        return `
          <div class="status-item">
            <h3>#${index + 1} ${escapeHtml(student.name)}${topper}</h3>
            <p>Roll ${escapeHtml(student.roll)} | Total ${student.total}/400 | ${student.percentage}%</p>
          </div>
        `;
      })
      .join("")}
  `;
}

function renderAttendanceView() {
  const board = document.getElementById("attendanceBoard");
  if (!board) {
    return;
  }

  syncAttendanceStore();

  if (!students.length) {
    board.innerHTML = `
      <div class="status-item">
        <h3>No attendance data</h3>
        <p>Add students to start attendance marking.</p>
      </div>
    `;
    return;
  }

  currentAttendanceDate = normalizeDate(currentAttendanceDate) || getTodayISO();
  const dayStore = getAttendanceStoreForDate(currentAttendanceDate, true);
  const summary = getAttendanceSummary(currentAttendanceDate);
  const currentMonthLabel = formatMonthKey(currentAttendanceDate.slice(0, 7));

  board.innerHTML = `
    <div class="attendance-toolbar">
      <div class="attendance-summary">
        <span class="attendance-chip chip-present">Present: ${summary.present}</span>
        <span class="attendance-chip chip-absent">Absent: ${summary.absent}</span>
        <span class="attendance-chip chip-unmarked">Unmarked: ${summary.unmarked}</span>
      </div>
      <div class="attendance-date-wrap">
        <label>Attendance Date
          <input id="attendanceDate" type="date" value="${currentAttendanceDate}">
        </label>
        <span class="attendance-chip chip-unmarked">Month: ${escapeHtml(currentMonthLabel)}</span>
      </div>
      <div class="attendance-actions">
        <button type="button" class="attendance-btn btn-present" onclick="markAllAttendance('present')">Mark All Present</button>
        <button type="button" class="attendance-btn btn-absent" onclick="markAllAttendance('absent')">Mark All Absent</button>
        <button type="button" class="attendance-btn btn-clear" onclick="clearAttendanceMarks()">Clear Day</button>
      </div>
    </div>
    <div class="table-wrap attendance-table-wrap">
      <table class="attendance-table">
        <tr>
          <th>Roll</th>
          <th>Name</th>
          <th>Status</th>
          <th>Month %</th>
        </tr>
        ${students
          .map((student) => {
            const status = dayStore[student.roll] ?? "";
            const statusLabel = getAttendanceStatusLabel(status);
            const statusClass = status ? `att-${status}` : "att-unmarked";
            const monthPct = getMonthlyAttendancePercentage(student.roll, currentAttendanceDate).toFixed(2);

            return `
              <tr>
                <td>${escapeHtml(student.roll)}</td>
                <td>${escapeHtml(student.name)}</td>
                <td>
                  <div class="attendance-cell">
                    <select class="attendance-select" data-roll="${escapeHtml(student.roll)}">
                      <option value="" ${status === "" ? "selected" : ""}>Select</option>
                      <option value="present" ${status === "present" ? "selected" : ""}>Present</option>
                      <option value="absent" ${status === "absent" ? "selected" : ""}>Absent</option>
                    </select>
                    <span class="attendance-tag ${statusClass}">${statusLabel}</span>
                  </div>
                </td>
                <td>${monthPct}%</td>
              </tr>
            `;
          })
          .join("")}
      </table>
    </div>
  `;

  board.querySelectorAll(".attendance-select").forEach((select) => {
    select.addEventListener("change", () => {
      setAttendance(select.dataset.roll, select.value);
    });
  });

  const dateInput = document.getElementById("attendanceDate");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      currentAttendanceDate = normalizeDate(dateInput.value) || getTodayISO();
      persistState();
      renderAttendanceView();
    });
  }
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
  const feeTotals = getFeeTotals();
  const dueCount = students.filter((student) => getFeeInfo(student).feeDue > 0).length;

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
      <h3>Fee Reminder</h3>
      <p>${dueCount} students have pending fees. Due: ${formatAmount(feeTotals.due)} | Late Fee: ${formatAmount(feeTotals.late)}.</p>
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
  const feeTotals = getFeeTotals();
  const latestReceipt = receipts[0];

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
      <h3>Fee Snapshot</h3>
      <p>Total: ${formatAmount(feeTotals.total)} | Paid: ${formatAmount(feeTotals.paid)} | Due: ${formatAmount(feeTotals.due)} | Late: ${formatAmount(feeTotals.late)}</p>
    </div>
    <div class="status-item">
      <h3>Receipts</h3>
      <p>Total receipts: ${receipts.length}${latestReceipt ? ` | Latest: ${escapeHtml(latestReceipt.id)}` : ""}</p>
    </div>
  `;
}

function updateChart(key, canvas, config) {
  if (chartState[key]) {
    chartState[key].destroy();
  }
  chartState[key] = new Chart(canvas.getContext("2d"), config);
}

function drawChartFallback(canvas, message) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "14px Arial";
  ctx.fillStyle = "#6f8198";
  ctx.fillText(message, 14, 22);
}

function renderAverageTrendChart() {
  const canvas = document.getElementById("chartAvgTrend");
  if (!canvas) {
    return;
  }

  if (typeof Chart === "undefined") {
    drawChartFallback(canvas, "Chart.js not loaded");
    return;
  }

  const buckets = new Map();
  for (const student of students) {
    const dateObj = new Date(student.createdAt || student.updatedAt || Date.now());
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    const current = buckets.get(monthKey) || { sum: 0, count: 0 };
    current.sum += Number(student.percentage) || 0;
    current.count += 1;
    buckets.set(monthKey, current);
  }

  const labels = [...buckets.keys()].sort();
  const data = labels.map((key) => {
    const item = buckets.get(key);
    return item.count ? Number((item.sum / item.count).toFixed(2)) : 0;
  });

  if (!labels.length) {
    labels.push("No Data");
    data.push(0);
  }

  updateChart("avgTrend", canvas, {
    type: "line",
    data: {
      labels: labels.map((key) => (key === "No Data" ? key : formatMonthKey(key))),
      datasets: [{
        label: "Average %",
        data,
        tension: 0.3,
        borderColor: "#1f8ad8",
        backgroundColor: "rgba(31,138,216,0.18)",
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

function renderSubjectWiseChart() {
  const canvas = document.getElementById("chartSubjectWise");
  if (!canvas) {
    return;
  }

  if (typeof Chart === "undefined") {
    drawChartFallback(canvas, "Chart.js not loaded");
    return;
  }

  const total = students.length || 1;
  const sum = students.reduce(
    (acc, student) => {
      acc.dsa += student.dsa;
      acc.os += student.os;
      acc.dbms += student.dbms;
      acc.cn += student.cn;
      return acc;
    },
    { dsa: 0, os: 0, dbms: 0, cn: 0 }
  );

  updateChart("subjectWise", canvas, {
    type: "bar",
    data: {
      labels: ["DSA", "OS", "DBMS", "CN"],
      datasets: [{
        label: "Average Marks",
        data: [
          Number((sum.dsa / total).toFixed(2)),
          Number((sum.os / total).toFixed(2)),
          Number((sum.dbms / total).toFixed(2)),
          Number((sum.cn / total).toFixed(2))
        ],
        backgroundColor: ["#4c9ee3", "#1fc58f", "#f6a945", "#ec5b63"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

function renderFeeSplitChart() {
  const canvas = document.getElementById("chartFeeSplit");
  if (!canvas) {
    return;
  }

  if (typeof Chart === "undefined") {
    drawChartFallback(canvas, "Chart.js not loaded");
    return;
  }

  const feeTotals = getFeeTotals();
  const paid = Number(feeTotals.paid.toFixed(2));
  const pending = Number((feeTotals.due + feeTotals.late).toFixed(2));

  updateChart("feeSplit", canvas, {
    type: "doughnut",
    data: {
      labels: ["Collected", "Pending + Late"],
      datasets: [{
        data: [paid, pending],
        backgroundColor: ["#1f9c67", "#ec5b63"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderCharts() {
  renderAverageTrendChart();
  renderSubjectWiseChart();
  renderFeeSplitChart();
}

function refreshBoards() {
  renderResultsView();
  renderAttendanceView();
  renderMessagesView();
  renderAccountView();
  renderCharts();
}

function hydrateInstallment(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const amount = parseMoney(raw.amount, 0);
  if (amount <= 0) {
    return null;
  }

  return {
    id: String(raw.id ?? createId("INS")),
    date: normalizeDate(raw.date) || getTodayISO(),
    amount,
    method: String(raw.method ?? DEFAULT_PAYMENT_METHOD),
    note: String(raw.note ?? "")
  };
}

function hydrateReceipt(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const roll = String(raw.roll ?? "").trim();
  if (!roll) {
    return null;
  }

  return {
    id: String(raw.id ?? createId("RCPT")),
    roll,
    studentName: String(raw.studentName ?? ""),
    date: normalizeDate(raw.date) || getTodayISO(),
    amount: parseMoney(raw.amount, 0),
    method: String(raw.method ?? DEFAULT_PAYMENT_METHOD),
    note: String(raw.note ?? ""),
    feeTotal: parseMoney(raw.feeTotal, 0),
    feePaid: parseMoney(raw.feePaid, 0),
    feeDue: parseMoney(raw.feeDue, 0),
    lateFee: parseMoney(raw.lateFee, 0)
  };
}

function hydrateStudent(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const roll = String(raw.roll ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!roll || !name) {
    return null;
  }

  const dsa = parseMark(raw.dsa);
  const os = parseMark(raw.os);
  const dbms = parseMark(raw.dbms);
  const cn = parseMark(raw.cn);
  const total = dsa + os + dbms + cn;
  const percentage = (total / 4).toFixed(2);

  const fees = normalizeFeeValues(raw.feeTotal, raw.feePaid, raw.feeDue);
  const installments = Array.isArray(raw.installments)
    ? raw.installments.map((item) => hydrateInstallment(item)).filter(Boolean)
    : [];
  const installmentTotal = getInstallmentTotalFromArray(installments);
  const feePaid = Math.min(fees.feeTotal, Math.max(fees.feePaid, installmentTotal));
  const createdAt = normalizeDateTime(raw.createdAt) || new Date().toISOString();
  const updatedAt = normalizeDateTime(raw.updatedAt) || createdAt;

  return {
    roll,
    name,
    phone: String(raw.phone ?? "").trim(),
    address: String(raw.address ?? "").trim(),
    dsa,
    os,
    dbms,
    cn,
    feeTotal: fees.feeTotal,
    feePaid,
    feeDueDate: normalizeDate(raw.feeDueDate) || getDefaultDueDateISO(),
    installments,
    total,
    percentage,
    photoURL: String(raw.photoURL ?? ""),
    createdAt,
    updatedAt
  };
}

function loadStoredState() {
  const storedStudents = safeParse(localStorage.getItem(STORAGE_KEYS.students), []);
  if (Array.isArray(storedStudents)) {
    for (const item of storedStudents) {
      const student = hydrateStudent(item);
      if (student) {
        students.push(student);
      }
    }
  }

  const storedAttendance = safeParse(localStorage.getItem(STORAGE_KEYS.attendanceByDate), {});
  if (storedAttendance && typeof storedAttendance === "object") {
    for (const [date, dayStore] of Object.entries(storedAttendance)) {
      const normalizedDate = normalizeDate(date);
      if (!normalizedDate || typeof dayStore !== "object" || !dayStore) {
        continue;
      }

      const cleanStore = Object.create(null);
      for (const [roll, status] of Object.entries(dayStore)) {
        if (status === "present" || status === "absent") {
          cleanStore[String(roll)] = status;
        }
      }
      attendanceByDate[normalizedDate] = cleanStore;
    }
  }

  const legacyAttendanceByRoll = safeParse(localStorage.getItem("attendanceByRoll"), null);
  if (legacyAttendanceByRoll && typeof legacyAttendanceByRoll === "object" && !Object.keys(attendanceByDate).length) {
    const today = getTodayISO();
    const store = Object.create(null);
    for (const [roll, status] of Object.entries(legacyAttendanceByRoll)) {
      if (status === "present" || status === "absent") {
        store[String(roll)] = status;
      }
    }
    attendanceByDate[today] = store;
  }

  const storedReceipts = safeParse(localStorage.getItem(STORAGE_KEYS.receipts), []);
  if (Array.isArray(storedReceipts)) {
    for (const item of storedReceipts) {
      const receipt = hydrateReceipt(item);
      if (receipt) {
        receipts.push(receipt);
      }
    }
  }

  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  const savedAttendanceDate = normalizeDate(localStorage.getItem(STORAGE_KEYS.attendanceDate));
  if (savedAttendanceDate) {
    currentAttendanceDate = savedAttendanceDate;
  }
}

loadStoredState();
initSidebarNavigation();
initFilterControls();
initFormPreview();
switchView("profile");
resetFeeInputs();
displayStudents();
