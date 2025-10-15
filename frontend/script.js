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
const startRegistrationCameraBtn = document.getElementById("startRegistrationCameraBtn");
const stopRegistrationCameraBtn = document.getElementById("stopRegistrationCameraBtn");
const registrationCameraStatus = document.getElementById("registrationCameraStatus");

// Kamera Absensi
const videoAttendance = document.getElementById("videoAttendance");
const startAttendanceCameraBtn = document.getElementById("startAttendanceCameraBtn");
const stopAttendanceCameraBtn = document.getElementById("stopAttendanceCameraBtn");
const attendanceCameraStatus = document.getElementById("attendanceCameraStatus");

// Data Pendaftaran
const nameInput = document.getElementById("nameInput");
const nimInput = document.getElementById("nimInput");
const captureFaceBtn = document.getElementById("captureFaceBtn");
const saveStudentBtn = document.getElementById("saveStudentBtn");
const registeredFacesList = document.getElementById("registeredFacesList");
const registeredFacesCount = document.getElementById("registeredFacesCount");
const capturedFaceCount = document.getElementById("capturedFaceCount");

// Statistik Absensi
const attendanceRecords = document.getElementById("attendanceRecords");
const saveBtn = document.getElementById("saveBtn");

// Model AI
const loadingModelsDiv = document.getElementById("loadingModelsDiv");
const modelLoadProgress = document.getElementById("modelLoadProgress");

// ============================
// Navigasi Antar Halaman
// ============================
function setActiveSection(section) {
  [registrationSection, attendanceSection, settingsSection].forEach((s) =>
    s.classList.remove("active")
  );
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
    showPopup("Kamera Aktif", "Kamera berhasil dinyalakan.", "green");
  } catch (err) {
    showPopup("Gagal", "Tidak dapat mengakses kamera.", "red");
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
  showPopup("Kamera Dimatikan", "Kamera berhasil dihentikan.", "yellow");
}

// Tombol kamera
startRegistrationCameraBtn.addEventListener("click", () =>
  startCamera(videoRegistration, registrationCameraStatus)
);
stopRegistrationCameraBtn.addEventListener("click", () =>
  stopCamera(videoRegistration, registrationCameraStatus, registrationStream)
);
startAttendanceCameraBtn.addEventListener("click", () =>
  startCamera(videoAttendance, attendanceCameraStatus)
);
stopAttendanceCameraBtn.addEventListener("click", () =>
  stopCamera(videoAttendance, attendanceCameraStatus, attendanceStream)
);

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
    showPopup("Model AI Siap", "Model pendeteksi wajah berhasil dimuat.", "green");
  } catch (e) {
    modelLoadProgress.textContent = "Gagal memuat model wajah.";
    showPopup("Error", "Model FaceAPI gagal dimuat.", "red");
  }
}

// ============================
// Logika Pendaftaran
// ============================
let registeredStudents = JSON.parse(localStorage.getItem("students")) || [];
let capturedFaces = [];

captureFaceBtn.addEventListener("click", async () => {
  if (!videoRegistration.srcObject)
    return showPopup("Kamera Mati", "Aktifkan kamera pendaftaran terlebih dahulu.", "red");

  const detection = await faceapi
    .detectSingleFace(videoRegistration, new faceapi.TinyFaceDetectorOptions());
  if (!detection)
    return showPopup("Tidak Terdeteksi", "Wajah tidak terlihat jelas, coba lagi.", "yellow");

  capturedFaces.push(detection);
  capturedFaceCount.textContent = capturedFaces.length;
  showPopup("Wajah Terdeteksi", "Wajah berhasil ditangkap.", "green");
});

saveStudentBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const nim = nimInput.value.trim();

  if (!name || !nim || capturedFaces.length === 0) {
    return showPopup("Gagal", "Isi data lengkap dan ambil minimal satu wajah.", "red");
  }

  registeredStudents.push({ name, nim });
  localStorage.setItem("students", JSON.stringify(registeredStudents));
  updateRegisteredList();
  nameInput.value = "";
  nimInput.value = "";
  capturedFaces = [];
  capturedFaceCount.textContent = "0";
  showPopup("Berhasil", "Mahasiswa berhasil didaftarkan.", "green");
});

function updateRegisteredList() {
  registeredFacesList.innerHTML = "";
  if (registeredStudents.length === 0) {
    registeredFacesList.innerHTML =
      `<div class='text-center py-4 text-gray-400'>Belum ada mahasiswa terdaftar</div>`;
  } else {
    registeredStudents.forEach((s) => {
      const div = document.createElement("div");
      div.className = "p-2 bg-gray-100 rounded";
      div.textContent = `${s.nim} - ${s.name}`;
      registeredFacesList.appendChild(div);
    });
  }
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
    status: "Hadir",
  };
  attendanceToday.push(entry);
  updateAttendanceDisplay();
  showPopup("Presensi Berhasil", `${student.name} telah tercatat hadir.`, "green");
}

function updateAttendanceDisplay() {
  attendanceRecords.innerHTML = "";
  if (attendanceToday.length === 0) {
    attendanceRecords.innerHTML =
      `<div class='text-center py-4 text-gray-400'>Belum ada kehadiran hari ini</div>`;
  } else {
    attendanceToday.forEach((a) => {
      const div = document.createElement("div");
      div.className = "attendance-card status-hadir";
      div.innerHTML = `<div class='font-semibold text-green-700'>${a.name}</div>
        <div class='text-sm text-gray-600'>${a.nim}</div>
        <div class='text-xs text-gray-500'>${a.time}</div>`;
      attendanceRecords.appendChild(div);
    });
  }
}

saveBtn.addEventListener("click", () => {
  if (attendanceToday.length === 0)
    return showPopup("Tidak Ada Data", "Belum ada data untuk disimpan.", "red");

  localStorage.setItem("attendance", JSON.stringify(attendanceToday));
  showPopup("Tersimpan", "Data absensi berhasil disimpan!", "green");
  attendanceToday = [];
  updateAttendanceDisplay();
});

// ============================
// Pengaturan Dinamis
// ============================
const settingMainTitle = document.getElementById("settingMainTitle");
const settingHeaderSubtitle = document.getElementById("settingHeaderSubtitle");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

saveSettingsBtn.addEventListener("click", () => {
  document.getElementById("mainTitle").textContent = settingMainTitle.value;
  document.getElementById("headerSubtitle").textContent = settingHeaderSubtitle.value;
  showPopup("Berhasil", "Pengaturan disimpan!", "green");
});

// ============================
// POP-UP NOTIFICATION SYSTEM
// ============================
const popupOverlay = document.getElementById("popupOverlay");
const popupTitle = document.getElementById("popupTitle");
const popupMessage = document.getElementById("popupMessage");
const popupCloseBtn = document.getElementById("popupCloseBtn");

function showPopup(title, message, color = "blue") {
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  popupOverlay.classList.remove("hidden");
  popupOverlay.classList.add("show");

  const colorClass = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
  };
  popupTitle.className = `text-xl font-bold mb-2 ${colorClass[color] || "text-blue-600"}`;
}

popupCloseBtn.addEventListener("click", () => {
  popupOverlay.classList.add("hidden");
  popupOverlay.classList.remove("show");
});

// ============================
// Inisialisasi Awal
// ============================
window.addEventListener("DOMContentLoaded", () => {
  loadModels();
  updateRegisteredList();
});
