document.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('video');
  const canvas = document.getElementById('overlayCanvas');
  const statusEl = document.getElementById('statusIndicator');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const stopCameraBtn = document.getElementById('stopCameraBtn');
  const presenceBtn = document.getElementById('presenceBtn');
  const detectedNameEl = document.getElementById('detectedName');
  const lastTimeEl = document.getElementById('lastTime');
  const summaryList = document.getElementById('summaryList');

  await FaceUtils.ensureModelsLoaded();

  startCameraBtn.addEventListener('click', async () => {
    await FaceUtils.startCamera(video, statusEl);
  });

  stopCameraBtn.addEventListener('click', () => {
    FaceUtils.stopCamera(video, canvas, statusEl);
  });

  presenceBtn.addEventListener('click', async () => {
    statusEl.textContent = 'Mencocokkan...';
    FaceUtils.showPopup('Presensi', 'Sedang mencocokkan wajah...', 'info', 2000);

    const descriptor = await FaceUtils.captureDescriptor(video);
    if (!descriptor) {
      statusEl.textContent = 'Wajah tidak terdeteksi';
      FaceUtils.showPopup('Presensi', 'Wajah tidak terdeteksi.', 'error', 3000);
      return;
    }

    // ambil data mahasiswa terdaftar (localStorage dulu, nanti dari backend)
    const stored = JSON.parse(localStorage.getItem('registeredFaces') || '[]');
    if (stored.length === 0) {
      FaceUtils.showPopup('Presensi', 'Belum ada data terdaftar.', 'error');
      statusEl.textContent = 'Belum ada data';
      return;
    }

    const labeled = stored.map(d => new faceapi.LabeledFaceDescriptors(
      d.name, [Float32Array.from(d.descriptor)]
    ));
    const matcher = new faceapi.FaceMatcher(labeled, 0.6);
    const best = matcher.findBestMatch(descriptor);

    if (best.label !== 'unknown') {
      const now = new Date().toLocaleString();
      detectedNameEl.textContent = best.label;
      lastTimeEl.textContent = now;
      statusEl.textContent = `Hadir: ${best.label}`;
      FaceUtils.showPopup('Presensi Berhasil', `Selamat datang, ${best.label}!`, 'success', 3000);
      const li = document.createElement('li');
      li.textContent = `${best.label} — ${now}`;
      summaryList.prepend(li);
    } else {
      detectedNameEl.textContent = 'Tidak dikenal';
      statusEl.textContent = 'Wajah tidak dikenal';
      FaceUtils.showPopup('Presensi Gagal', 'Wajah tidak dikenal.', 'error', 3000);
    }
  });
});
