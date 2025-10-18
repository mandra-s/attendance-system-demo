/* script.js
   Bertugas menangani:
   - kamera (start/stop)
   - pemuatan model face-api
   - pendaftaran wajah (menyimpan descriptor ke localStorage)
   - absensi (mencocokkan descriptor -> mencatat ke attendance list)
   - popup notifikasi
*/

/* ---------- UTIL / POPUP ---------- */
const popupOverlay = () => document.getElementById('popupOverlay');
const popupTitleEl = () => document.getElementById('popupTitle');
const popupMsgEl = () => document.getElementById('popupMsg');
const popupCloseBtn = () => document.getElementById('popupClose');

function showPopup(title, message) {
  const overlay = popupOverlay();
  if (!overlay) return;
  popupTitleEl().textContent = title;
  popupMsgEl().textContent = message;
  overlay.classList.remove('hidden');
  overlay.classList.add('show');
}
function hidePopup() {
  const overlay = popupOverlay();
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.classList.remove('show');
}
if (popupCloseBtn()) popupCloseBtn().addEventListener('click', hidePopup);

/* ---------- storage helpers ---------- */
function loadStudents() {
  try {
    return JSON.parse(localStorage.getItem('ps_students') || '[]');
  } catch (e) {
    return [];
  }
}
function saveStudents(arr) {
  localStorage.setItem('ps_students', JSON.stringify(arr));
}
function loadAttendance() {
  try {
    return JSON.parse(localStorage.getItem('ps_attendance') || '[]');
  } catch (e) {
    return [];
  }
}
function saveAttendance(arr) {
  localStorage.setItem('ps_attendance', JSON.stringify(arr));
}

/* ---------- face-api models ---------- */
let modelsLoaded = false;
async function loadModels() {
  const MODEL_URL = 'assets/models/';
  try {
    // gunakan ssdMobilenetv1 agar descriptor faceRecognition tersedia
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    // optional: expressions
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log('✅ face-api models loaded');
  } catch (err) {
    console.error('Model load error', err);
    showPopup('Gagal memuat model', 'Periksa folder assets/models dan koneksi.',);
  }
}

/* ---------- Kamera ---------- */
let currentStream = null;
async function startCamera(videoEl) {
  if (!videoEl) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = s;
    await videoEl.play();
    currentStream = s;
    console.log('Kamera aktif');
    return true;
  } catch (err) {
    console.error('Gagal membuka kamera', err);
    showPopup('Gagal akses kamera', 'Pastikan kamera tersedia dan izinkan akses di browser.');
    return false;
  }
}
function stopCamera(videoEl) {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.srcObject = null;
    }
  } catch (e) {
    console.warn('stopCamera issue', e);
  }
}

/* ---------- Helper untuk canvas overlay ---------- */
function ensureCanvasForVideo(videoEl) {
  // canvas dibuat di container video (video.parentElement)
  const parent = videoEl.parentElement;
  let canvas = parent.querySelector('canvas');
  if (!canvas) {
    canvas = faceapi.createCanvasFromMedia(videoEl);
    parent.appendChild(canvas);
  }
  const displaySize = { width: videoEl.width, height: videoEl.height };
  faceapi.matchDimensions(canvas, displaySize);
  return canvas;
}

/* ---------- Pendaftaran (halaman pendaftaran.html) ---------- */
async function setupRegistrationPage() {
  // elemen
  const video = document.getElementById('video');
  const startBtn = document.getElementById('startCameraBtn');
  const stopBtn = document.getElementById('stopCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const nameInput = document.getElementById('nameInput');
  const nimInput = document.getElementById('nimInput');
  const statusEl = document.getElementById('registrationStatus');
  const listEl = document.getElementById('registeredList');

  // render daftar terdaftar
  function renderList() {
    const students = loadStudents();
    listEl.innerHTML = '';
    if (students.length === 0) {
      listEl.innerHTML = `<div class="text-gray-400 text-center py-4">Belum ada data terdaftar</div>`;
      return;
    }
    students.forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b';
      const count = (s.descriptors && s.descriptors.length) ? s.descriptors.length : 0;
      div.innerHTML = `<div class="font-medium">${s.name} ${s.nim ? `(${s.nim})` : ''}</div>
                       <div class="text-xs text-gray-600">samples: ${count}</div>`;
      listEl.appendChild(div);
    });
  }

  renderList();

  // tombol start camera
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      const ok = await startCamera(video);
      if (ok) {
        statusEl.textContent = 'Status: kamera aktif';
        // buat canvas overlay & mulai menscroll deteksi ringan (kotak)
        if (modelsLoaded) startPreviewDetections(video);
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopCamera(video);
      statusEl.textContent = 'Status: kamera dimatikan';
      const parent = video.parentElement;
      const canvas = parent.querySelector('canvas');
      if (canvas) canvas.remove();
    });
  }

  // tangkap face descriptor & simpan
  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const nim = nimInput.value.trim();
      if (!name) {
        showPopup('Perhatian', 'Masukkan nama terlebih dahulu.');
        return;
      }
      if (!video || !video.srcObject) {
        showPopup('Kamera mati', 'Nyalakan kamera sebelum mendaftar.');
        return;
      }
      if (!modelsLoaded) {
        showPopup('Model belum siap', 'Tunggu sampai model selesai dimuat.');
        return;
      }

      statusEl.textContent = 'Status: mendeteksi...';
      // deteksi single face dengan descriptor
      const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
      if (!detection) {
        statusEl.textContent = 'Status: wajah tidak terdeteksi. Coba ulang.';
        showPopup('Tidak Terdeteksi', 'Pastikan wajah terlihat jelas.');
        return;
      }

      // descriptor => array of numbers
      const descriptorArr = Array.from(detection.descriptor);

      // ambil students
      const students = loadStudents();
      // cek apakah nama sudah ada
      let student = students.find(s => s.name === name && s.nim === nim);
      if (!student) {
        student = { name, nim, descriptors: [] };
        students.push(student);
      }
      student.descriptors.push(descriptorArr);
      saveStudents(students);

      statusEl.textContent = `Status: tersimpan untuk ${name}.`;
      showPopup('Berhasil', `Wajah ${name} disimpan (samples: ${student.descriptors.length}).`);
      nameInput.value = '';
      nimInput.value = '';
      renderList();
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      const confirmClear = confirm('Hapus semua data pendaftaran?');
      if (!confirmClear) return;
      saveStudents([]);
      renderList();
      showPopup('Dihapus', 'Semua data pendaftaran telah dihapus.');
    });
  }
}

/* preview detection untuk pendaftaran (visual box) */
function startPreviewDetections(videoEl) {
  // pastikan videoEl ready
  if (!videoEl || !modelsLoaded) return;
  const canvas = ensureCanvasForVideo(videoEl);
  const displaySize = { width: videoEl.width, height: videoEl.height };
  faceapi.matchDimensions(canvas, displaySize);

  // interval ringan untuk preview
  const intervalId = setInterval(async () => {
    if (videoEl.paused || videoEl.ended) return;
    const detections = await faceapi.detectAllFaces(videoEl).withFaceLandmarks();
    const resized = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);
  }, 200);

  // simpan reference agar bisa dibersihkan bila kamera dimatikan
  videoEl._previewInterval = intervalId;
}

/* ---------- Absensi (halaman absensi.html) ---------- */
let attendanceInterval = null;
async function setupAttendancePage() {
  const video = document.getElementById('video');
  const startBtn = document.getElementById('startAttendanceBtn');
  const stopBtn = document.getElementById('stopAttendanceBtn');
  const statusEl = document.getElementById('attendanceStatus');
  const listEl = document.getElementById('attendanceList');
  const saveBtn = document.getElementById('saveAttendanceBtn');

  function renderAttendanceList() {
    const arr = loadAttendance();
    listEl.innerHTML = '';
    if (!arr || arr.length === 0) {
      listEl.innerHTML = `<div class="text-gray-400 text-center py-4">Belum ada rekaman</div>`;
      return;
    }
    arr.forEach(r => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b';
      div.innerHTML = `<div class="font-medium">${r.name} ${r.nim ? `(${r.nim})` : ''}</div>
                       <div class="text-xs text-gray-600">${r.time}</div>`;
      listEl.appendChild(div);
    });
  }

  renderAttendanceList();

  // start button: start camera, prepare labeled descriptors, start match loop
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (!modelsLoaded) {
        showPopup('Model belum siap', 'Tunggu sampai model dimuat.');
        return;
      }
      const ok = await startCamera(video);
      if (!ok) return;
      statusEl.textContent = 'Status: kamera aktif, menyiapkan data...';

      // prepare labeled descriptors
      const labeled = await prepareLabeledDescriptors();
      if (!labeled || labeled.length === 0) {
        showPopup('Data kosong', 'Belum ada wajah terdaftar. Daftarkan dulu di halaman pendaftaran.');
        statusEl.textContent = 'Status: tidak ada data terdaftar';
        stopCamera(video);
        return;
      }

      statusEl.textContent = 'Status: mulai absensi...';
      startAttendanceLoop(video, labeled);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopAttendanceLoop();
      stopCamera(video);
      statusEl.textContent = 'Status: dihentikan';
      const parent = video.parentElement;
      const canvas = parent.querySelector('canvas');
      if (canvas) canvas.remove();
      showPopup('Dihentikan', 'Absensi dihentikan.');
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const arr = loadAttendance();
      if (!arr || arr.length === 0) {
        showPopup('Tidak ada data', 'Belum ada rekaman untuk disimpan.');
        return;
      }
      // already in localStorage; show confirmation
      showPopup('Tersimpan', `Terdapat ${arr.length} rekaman di localStorage.`);
    });
  }

  // helper: update local attendance & UI
  function addAttendanceRecord(student) {
    const arr = loadAttendance();
    const now = new Date();
    const rec = { name: student.name, nim: student.nim || '', time: now.toLocaleString() };
    // hindari duplikasi di hari yang sama (sederhana: per name)
    if (arr.find(a => a.name === rec.name)) return;
    arr.push(rec);
    saveAttendance(arr);
    renderAttendanceList();
    showPopup('Presensi Tercatat', `${student.name} telah dicatat hadir.`);
  }
}

/* prepare labeled face descriptors from stored students */
async function prepareLabeledDescriptors() {
  const students = loadStudents();
  const labeled = [];
  for (const s of students) {
    // setiap s.descriptors adalah array of arrays (numbers)
    if (!s.descriptors || s.descriptors.length === 0) continue;
    const descriptors = s.descriptors.map(d => new Float32Array(d));
    const labeledFD = new faceapi.LabeledFaceDescriptors(s.name, descriptors);
    labeled.push(labeledFD);
  }
  return labeled;
}

/* attendance loop: detect face, match with faceMatcher */
function startAttendanceLoop(videoEl, labeledDescriptors) {
  const parent = videoEl.parentElement;
  const canvas = ensureCanvasForVideo(videoEl);
  const displaySize = { width: videoEl.width, height: videoEl.height };
  faceapi.matchDimensions(canvas, displaySize);

  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55); // threshold

  // clear existing interval
  if (attendanceInterval) clearInterval(attendanceInterval);

  attendanceInterval = setInterval(async () => {
    if (videoEl.paused || videoEl.ended) return;
    const detections = await faceapi.detectAllFaces(videoEl).withFaceLandmarks().withFaceDescriptors();
    const resized = faceapi.resizeResults(detections, displaySize);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);

    // match each descriptor
    for (const d of resized) {
      const best = faceMatcher.findBestMatch(d.descriptor);
      const box = d.detection.box;
      // draw label
      const label = best.label === 'unknown' ? 'Tidak Dikenali' : best.label;
      const drawBox = new faceapi.draw.DrawBox(box, { label });
      drawBox.draw(canvas);

      if (best.label !== 'unknown') {
        // tambah ke attendance (local) jika belum ada
        const students = loadStudents();
        const matchedStudent = students.find(s => s.name === best.label);
        if (matchedStudent) {
          // add record if not exists
          const arr = loadAttendance();
          if (!arr.find(a => a.name === matchedStudent.name)) {
            const now = new Date();
            arr.push({ name: matchedStudent.name, nim: matchedStudent.nim || '', time: now.toLocaleString() });
            saveAttendance(arr);
            // update UI: try to find attendanceList element
            const el = document.getElementById('attendanceList');
            if (el) {
              // re-render by calling helper: but helper exists only in setupAttendancePage scope,
              // so update directly: append new div
              const div = document.createElement('div');
              div.className = 'p-2 border-b';
              div.innerHTML = `<div class="font-medium">${matchedStudent.name} ${matchedStudent.nim ? `(${matchedStudent.nim})` : ''}</div>
                               <div class="text-xs text-gray-600">${now.toLocaleString()}</div>`;
              // if there's placeholder 'Belum ada rekaman', remove it
              if (el.querySelector('.text-gray-400')) el.innerHTML = '';
              el.appendChild(div);
            }
            // notify once
            showPopup('Presensi Tersimpan', `${matchedStudent.name} tercatat hadir.`);
          }
        }
      }
    }

  }, 1200); // jalankan tiap 1.2 detik
}

function stopAttendanceLoop() {
  if (attendanceInterval) {
    clearInterval(attendanceInterval);
    attendanceInterval = null;
  }
}

/* ---------- Auto init pada halaman yang sesuai ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  // Load models in background
  // If faceapi not loaded (e.g. index.html) skip
  if (typeof faceapi !== 'undefined') {
    await loadModels();
  }

  // Rute berdasarkan path filename
  const path = window.location.pathname || '';
  const file = path.substring(path.lastIndexOf('/') + 1);

  if (file === 'pendaftaran.html') {
    await setupRegistrationPage();
  } else if (file === 'absensi.html') {
    await setupAttendancePage();
  } else {
    // index or others: no-op
  }
});
