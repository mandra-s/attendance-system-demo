// ============================
// Referensi Elemen
// ============================
const navRegistration = document.getElementById("navRegistration");
const navAttendance = document.getElementById("navAttendance");
const navSettings = document.getElementById("navSettings");

const registrationSection = document.getElementById("registrationSection");
const attendanceSection = document.getElementById("attendanceSection");
const settingsSection = document.getElementById("settingsSection");

// Kamera Pendaftaran
const videoRegistration = document.getElementById("videoRegistration");
const canvasRegistration = document.getElementById("canvasRegistration");
const startRegistrationCameraBtn = document.getElementById("startRegistrationCameraBtn");
const stopRegistrationCameraBtn = document.getElementById("stopRegistrationCameraBtn");
const registrationCameraStatus = document.getElementById("registrationCameraStatus");

// Kamera Absensi
const videoAttendance = document.getElementById("videoAttendance");
const canvasAttendance = document.getElementById("canvasAttendance");
const startAttendanceCameraBtn = document.getElementById("startAttendanceCameraBtn");
const stopAttendanceCameraBtn = document.getElementById("stopAttendanceCameraBtn");
const attendanceCameraStatus = document.getElementById("attendanceCameraStatus");

// Data Pendaftaran
const nameInput = document.getElementById("nameInput");
const nimInput = document.getElementById("nimInput");
const captureFaceBtn = document.getElementById("captureFaceBtn");
const saveStudentBtn = document.getElementById("saveStudentBtn");
const clearCaptureBtn = document.getElementById("clearCaptureBtn");
const registeredFacesList = document.getElementById("registeredFacesList");
const registeredFacesCount = document.getElementById("registeredFacesCount");
const capturedFaceCount = document.getElementById("capturedFaceCount");

// Statistik Absensi
const totalPresent = document.getElementById("totalPresent");
const registeredStudentsDisplay = document.getElementById("registeredStudentsDisplay");
const attendanceRecords = document.getElementById("attendanceRecords");
const attendanceCount = document.getElementById("attendanceCount");
const saveBtn = document.getElementById("saveBtn");

// Model AI
const loadingModelsDiv = document.getElementById("loadingModelsDiv");
const modelLoadProgress = document.getElementById("modelLoadProgress");

// ============================
// Navigasi Antar Halaman
// ============================
function setActiveSection(section) {
  [registrationSection, attendanceSection, settingsSection].forEach((s) => s.classList.remove("active"));
  section.classList.add("active");
}

navRegistration.addEventListener("click", () => setActiveSection(registrationSection));
navAttendance.addEventListener("click", () => setActiveSection(attendanceSection));
navSettings.addEventListener("click", () => setActiveSection(settingsSection));

// ============================
// Inisialisasi Kamera
// ============================
let registrationStream, attendanceStream;

async function startCamera(videoElement, statusElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    if (videoElement === videoRegistration) registrationStream = stream;
    else attendanceStream = stream;

    statusElement.innerHTML = `<div class='inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-700'>
      <span class='w-3 h-3 rounded-full bg-green-500 mr-2'></span> Kamera aktif
    </div>`;
  } catch (err) {
    statusElement.textContent = "Tidak dapat mengakses kamera: " + err.message;
  }
}

function stopCamera(videoElement, statusElement, streamRef) {
  if (streamRef && streamRef.getTracks) {
    streamRef.getTracks().forEach(track => track.stop());
  }
  videoElement.srcObject = null;
  statusElement.innerHTML = `<div class='inline-flex items-center px-4 py-2 rounded-full bg-gray-100'>
    <span class='w-3 h-3 rounded-full bg-gray-400 mr-2'></span> Kamera tidak aktif
  </div>`;
}

// Tombol kamera pendaftaran
startRegistrationCameraBtn.addEventListener("click", () => startCamera(videoRegistration, registrationCameraStatus));
stopRegistrationCameraBtn.addEventListener("click", () => stopCamera(videoRegistration, registrationCameraStatus, registrationStream));

// Tombol kamera absensi
startAttendanceCameraBtn.addEventListener("click", () => startCamera(videoAttendance, attendanceCameraStatus));
stopAttendanceCameraBtn.addEventListener("click", () => stopCamera(videoAttendance, attendanceCameraStatus, attendanceStream));

// ============================
// Model Face API
// ============================
async function loadModels() {
  modelLoadProgress.textContent = "Memuat model deteksi wajah...";
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    loadingModelsDiv.style.display = "none";
  } catch (e) {
    modelLoadProgress.textContent = "Gagal memuat model wajah.";
  }
}

// ============================
// Logika Pendaftaran
// ============================
let registeredStudents = JSON.parse(localStorage.getItem("students")) || [];
let capturedFaces = [];

captureFaceBtn.addEventListener("click", async () => {
  if (!videoRegistration.srcObject) return alert("Kamera belum aktif!");
  const detection = await faceapi.detectSingleFace(videoRegistration, new faceapi.TinyFaceDetectorOptions());
  if (!detection) return alert("Wajah tidak terdeteksi, coba lagi.");

  capturedFaces.push(detection);
  capturedFaceCount.textContent = capturedFaces.length;
});

saveStudentBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const nim = nimInput.value.trim();

  if (!name || !nim || capturedFaces.length === 0) {
    alert("Isi semua data dan ambil minimal satu wajah!");
    return;
  }

  registeredStudents.push({ name, nim });
  localStorage.setItem("students", JSON.stringify(registeredStudents));
  updateRegisteredList();
  nameInput.value = "";
  nimInput.value = "";
  capturedFaces = [];
  capturedFaceCount.textContent = "0";
});

clearCaptureBtn.addEventListener("click", () => {
  capturedFaces = [];
  capturedFaceCount.textContent = "0";
});

function updateRegisteredList() {
  registeredFacesList.innerHTML = "";
  if (registeredStudents.length === 0) {
    registeredFacesList.innerHTML = `<div class='text-center py-4 text-gray-400'>Belum ada mahasiswa terdaftar</div>`;
  } else {
    registeredStudents.forEach((s) => {
      const div = document.createElement("div");
      div.className = "p-2 bg-gray-100 rounded";
      div.textContent = `${s.nim} - ${s.name}`;
      registeredFacesList.appendChild(div);
    });
  }
  registeredFacesCount.textContent = registeredStudents.length;
  registeredStudentsDisplay.textContent = registeredStudents.length;
}

// ============================
// Logika Absensi
// ============================
let attendanceToday = [];

function markAttendance(student) {
  const now = new Date();
  const entry = {
    name: student.name,
    nim: student.nim,
    time: now.toLocaleTimeString(),
    status: "Hadir"
  };
  attendanceToday.push(entry);
  updateAttendanceDisplay();
}

function updateAttendanceDisplay() {
  attendanceRecords.innerHTML = "";
  attendanceToday.forEach((a) => {
    const div = document.createElement("div");
    div.className = "attendance-card status-hadir";
    div.innerHTML = `<div class='font-semibold text-green-700'>${a.name}</div>
                     <div class='text-sm text-gray-600'>${a.nim}</div>
                     <div class='text-xs text-gray-500'>${a.time}</div>`;
    attendanceRecords.appendChild(div);
  });
  totalPresent.textContent = attendanceToday.length;
  attendanceCount.textContent = attendanceToday.length;
}

saveBtn.addEventListener("click", () => {
  if (attendanceToday.length === 0) {
    alert("Tidak ada data untuk disimpan!");
    return;
  }
  localStorage.setItem("attendance", JSON.stringify(attendanceToday));
  alert("Data absensi berhasil disimpan!");
  attendanceToday = [];
  updateAttendanceDisplay();
});

// ============================
// Pengaturan Dinamis
// ============================
const settingMainTitle = document.getElementById("settingMainTitle");
const settingHeaderSubtitle = document.getElementById("settingHeaderSubtitle");
const settingRegistrationSectionTitle = document.getElementById("settingRegistrationSectionTitle");
const settingAttendanceSectionTitle = document.getElementById("settingAttendanceSectionTitle");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

saveSettingsBtn.addEventListener("click", () => {
  document.getElementById("mainTitle").textContent = settingMainTitle.value;
  document.getElementById("headerSubtitle").textContent = settingHeaderSubtitle.value;
  document.getElementById("registrationSectionTitle").textContent = settingRegistrationSectionTitle.value;
  document.getElementById("attendanceSectionTitle").textContent = settingAttendanceSectionTitle.value;
  alert("Pengaturan berhasil disimpan!");
});

// ============================
// Inisialisasi Awal
// ============================
window.addEventListener("DOMContentLoaded", () => {
  loadModels();
  updateRegisteredList();
});
