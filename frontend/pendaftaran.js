document.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('video');
  const canvas = document.getElementById('overlayCanvas');
  const nameInput = document.getElementById('nameInput');
  const nrpInput = document.getElementById('nrpInput');
  const startBtn = document.getElementById('startCameraBtn');
  const stopBtn = document.getElementById('stopCameraBtn');
  const registerBtn = document.getElementById('registerBtn');
  const clearBtn = document.getElementById('clearAllBtn');
  const statusEl = document.getElementById('registrationStatus');
  const list = document.getElementById('registeredList');

  await FaceUtils.ensureModelsLoaded();

  function updateList() {
    const data = JSON.parse(localStorage.getItem('registeredFaces') || '[]');
    list.innerHTML = data.length
      ? data.map(d => `<div>${d.name} (${d.nrp})</div>`).join('')
      : '<div class="content-text">Belum ada data terdaftar</div>';
  }

  startBtn.addEventListener('click', async () => {
    await FaceUtils.startCamera(video, statusEl);
  });

  stopBtn.addEventListener('click', () => {
    FaceUtils.stopCamera(video, canvas, statusEl);
  });

  registerBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const nrp = nrpInput.value.trim();
    if (!name || !nrp) {
      FaceUtils.showPopup('Error', 'Isi nama dan NRP terlebih dahulu.', 'error');
      return;
    }

    const descriptor = await FaceUtils.captureDescriptor(video);
    if (!descriptor) {
      FaceUtils.showPopup('Gagal', 'Wajah tidak terdeteksi.', 'error');
      return;
    }

    const data = JSON.parse(localStorage.getItem('registeredFaces') || '[]');
    data.push({ name, nrp, descriptor: Array.from(descriptor) });
    localStorage.setItem('registeredFaces', JSON.stringify(data));

    FaceUtils.showPopup('Berhasil', `${name} (${nrp}) terdaftar.`, 'success');
    updateList();
  });

  clearBtn.addEventListener('click', () => {
    localStorage.removeItem('registeredFaces');
    updateList();
    FaceUtils.showPopup('Data Dihapus', 'Semua data pendaftaran dihapus.', 'info');
  });

  updateList();
});
