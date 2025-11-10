lucide.createIcons();

// -------------------- Toast Notifications --------------------
const toastContainer = document.getElementById('toastContainer');
function showPopup(title = 'Info', message = '', type = 'info', timeout = 4500) {
  if (!toastContainer) return console.warn("toastContainer not found");
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div style="flex:1">
      <div class="t-title">${title}</div>
      <div class="t-msg">${message}</div>
    </div>
    <button aria-label="close" style="border:none;background:transparent;cursor:pointer;font-weight:700">×</button>
  `;
  const closeBtn = toast.querySelector('button');
  closeBtn.addEventListener('click', () => toast.remove());
  toastContainer.appendChild(toast);
  if (timeout > 0) setTimeout(() => toast.remove(), timeout);
}

// -------------------- Sidebar & Menu --------------------
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');

if (toggleSidebarBtn && sidebar) {
  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('show');
    sidebar.classList.toggle('hidden');
  });
}
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.add('hidden'));

document.addEventListener('click', (e) => {
  if (window.innerWidth <= 960 && sidebar && sidebar.classList.contains('show')) {
    const inside = sidebar.contains(e.target) || toggleSidebarBtn.contains(e.target);
    if (!inside) sidebar.classList.add('hidden');
  }
});

// -------------------- Face API Helpers --------------------
const MODEL_URL = 'assets/models';
let stream = null;
let detectionInterval = null;

async function ensureModelsLoaded() {
  if (!window.faceapi) {
    console.warn('face-api.js belum dimuat.');
    showPopup('Error', 'Face API belum dimuat.', 'error');
    return false;
  }
  try {
    if (!faceapi.nets.ssdMobilenetv1.params) {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      try { await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL); } catch {}
    }
    console.log('Model wajah siap');
    return true;
  } catch (err) {
    console.error(err);
    showPopup('Error', 'Gagal memuat model wajah.', 'error');
    return false;
  }
}

async function startCamera(video, statusEl) {
  try {
    if (stream) return;
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    if (statusEl) statusEl.textContent = 'Kamera Aktif';
    showPopup('Kamera', 'Kamera berhasil dijalankan', 'success', 2000);
    return true;
  } catch (err) {
    console.error(err);
    showPopup('Kamera', 'Tidak dapat mengakses kamera.', 'error', 4000);
    if (statusEl) statusEl.textContent = 'Gagal mengakses kamera';
    return false;
  }
}

function stopCamera(video, canvas, statusEl) {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.pause();
  video.srcObject = null;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (statusEl) statusEl.textContent = 'Kamera Dimatikan';
  showPopup('Kamera', 'Kamera dimatikan', 'info', 2000);
}

function resizeCanvasToVideo(video, canvas) {
  if (!video || !canvas) return;
  canvas.width = video.videoWidth || video.clientWidth;
  canvas.height = video.videoHeight || video.clientHeight;
}

async function captureDescriptor(video) {
  if (!window.faceapi) return null;
  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection ? detection.descriptor : null;
  } catch (e) {
    console.error('Descriptor capture error:', e);
    return null;
  }
}

// 🔹 Ekspor global agar bisa diakses dari file lain
window.FaceUtils = {
  showPopup,
  ensureModelsLoaded,
  startCamera,
  stopCamera,
  resizeCanvasToVideo,
  captureDescriptor
};
