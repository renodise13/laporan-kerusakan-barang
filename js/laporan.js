let reportFormInitialized = false;

window.addEventListener('laporSarprasReady', function () {
  const page = document.body.dataset.page;
  if (page === 'dashboard-user') {
    renderUserDashboard();
  }

  if (page === 'buat-laporan') {
    if (!reportFormInitialized) {
      initReportForm();
      reportFormInitialized = true;
    }
  }

  if (page === 'riwayat') {
    renderHistory();
  }

  if (page === 'profil') {
    renderProfile();
  }

  if (page === 'detail-laporan') {
    renderDetailPage();
  }
});

window.addEventListener('laporSarprasReportsUpdated', function () {
  const page = document.body.dataset.page;
  if (page === 'dashboard-user') renderUserDashboard();
  if (page === 'riwayat') renderHistory();
  if (page === 'detail-laporan') renderDetailPage();
});

function getCurrentUser() {
  const storage = window.LaporSarprasStorage;
  return storage ? storage.getCurrentUser() : null;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getStatusClass(status) {
  if (status === 'Menunggu') return 'status-waiting';
  if (status === 'Sedang Diproses') return 'status-processing';
  if (status === 'Selesai') return 'status-done';
  return 'status-waiting';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderUserDashboard() {
  const currentUser = getCurrentUser();
  const reports = window.LaporSarprasStorage.getReports().filter(
    (report) => report.reporterUsername === currentUser.username
  );

  const waiting = reports.filter((report) => report.status === 'Menunggu').length;
  const inProgress = reports.filter((report) => report.status === 'Sedang Diproses').length;
  const done = reports.filter((report) => report.status === 'Selesai').length;

  document.getElementById('welcomeName').textContent = `Halo, ${currentUser.name}`;
  document.getElementById('countWaiting').textContent = waiting;
  document.getElementById('countProcess').textContent = inProgress;
  document.getElementById('countDone').textContent = done;
  document.getElementById('countTotal').textContent = reports.length;

  const latest = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const tbody = document.getElementById('latestReportsTable');

  if (!tbody) {
    return;
  }

  if (!latest.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada laporan yang dibuat.</td></tr>';
    return;
  }

  tbody.innerHTML = latest
    .map(
      (report) => `
        <tr>
          <td>${escapeHtml(report.ticketNumber)}</td>
          <td>${escapeHtml(report.itemName)}</td>
          <td>${escapeHtml(report.location)}</td>
          <td>${formatDate(report.createdAt)}</td>
          <td><span class="badge ${getStatusClass(report.status)}">${escapeHtml(report.status)}</span></td>
          <td><a href="detail-laporan.html?id=${report.id}" class="action-link">Lihat</a></td>
        </tr>
      `
    )
    .join('');
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  if (!file) {
    throw new Error('Foto laporan belum dipilih.');
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Format foto tidak valid. Gunakan JPG, JPEG, atau PNG.');
  }

  const dataUrl = await readFileAsDataURL(file);
  const image = new Image();

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const maxWidth = 1200;
      const ratio = Math.min(maxWidth / image.width, 1);
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);

      const quality = file.size > 600000 ? 0.7 : 0.85;
      const compressed = canvas.toDataURL('image/jpeg', quality);

      if (compressed.length > 180000) {
        resolve(compressed);
        return;
      }

      resolve(compressed);
    };

    image.onerror = () => reject(new Error('File foto gagal diproses.'));
    image.src = dataUrl;
  });
}

function initReportForm() {
  const currentUser = getCurrentUser();
  const form = document.getElementById('reportForm');
  const photoInput = document.getElementById('photo');
  const previewBox = document.getElementById('previewBox');
  const previewImage = document.getElementById('previewImage');

  if (currentUser && document.getElementById('reporterName')) {
    document.getElementById('reporterName').value = currentUser.name;
  }

  if (photoInput) {
    photoInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) {
        previewBox.classList.add('hidden');
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        previewImage.src = event.target.result;
        previewBox.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  if (!form) {
    return;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const fields = {
      reporterName: formData.get('reporterName')?.toString().trim(),
      reporterClass: formData.get('reporterClass')?.toString().trim(),
      itemName: formData.get('itemName')?.toString().trim(),
      category: formData.get('category')?.toString().trim(),
      location: formData.get('location')?.toString().trim(),
      description: formData.get('description')?.toString().trim(),
      priority: formData.get('priority')?.toString().trim(),
      photo: formData.get('photo')
    };

    if (!fields.reporterName || !fields.reporterClass || !fields.itemName || !fields.category || !fields.location || !fields.description || !fields.priority || !fields.photo) {
      alert('Semua data wajib diisi, termasuk foto kerusakan.');
      return;
    }

    try {
      const file = fields.photo;
      const compressedPhoto = await compressImage(file);
      const now = new Date().toISOString();
      const report = {
        id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ticketNumber: window.LaporSarprasStorage.nextTicketNumber(),
        reporterName: fields.reporterName,
        reporterUsername: currentUser.username,
        reporterClass: fields.reporterClass,
        itemName: fields.itemName,
        category: fields.category,
        location: fields.location,
        description: fields.description,
        priority: fields.priority,
        status: 'Menunggu',
        createdAt: now,
        updatedAt: now,
        photo: compressedPhoto,
        photoAfter: '',
        notes: '',
        history: [
          {
            status: 'Menunggu',
            date: now,
            message: 'Laporan berhasil dibuat.'
          }
        ]
      };

      await window.LaporSarprasStorage.createReport(report);

      alert(`Laporan berhasil dibuat. Nomor tiket Anda: ${report.ticketNumber}`);
      form.reset();
      previewBox.classList.add('hidden');
      window.location.href = 'riwayat.html';
    } catch (error) {
      alert(error.message || 'Gagal mengirim laporan.');
    }
  });
}

function renderHistory() {
  const currentUser = getCurrentUser();
  const reports = window.LaporSarprasStorage.getReports();
  const visibleReports = currentUser.role === 'admin'
    ? [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : reports.filter((report) => report.reporterUsername === currentUser.username).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const tbody = document.getElementById('historyTable');
  if (!tbody) {
    return;
  }

  if (!visibleReports.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada laporan yang tersedia.</td></tr>';
    return;
  }

  tbody.innerHTML = visibleReports
    .map(
      (report) => `
        <tr>
          <td>${escapeHtml(report.ticketNumber)}</td>
          <td>${escapeHtml(report.itemName)}</td>
          <td>${escapeHtml(report.location)}</td>
          <td>${formatDate(report.createdAt)}</td>
          <td><span class="badge ${getStatusClass(report.status)}">${escapeHtml(report.status)}</span></td>
          <td><img class="history-thumb" src="${report.photo || ''}" alt="Foto kerusakan" /></td>
          <td><a href="detail-laporan.html?id=${report.id}" class="action-link">Detail</a></td>
        </tr>
      `
    )
    .join('');
}

function renderProfile() {
  const currentUser = getCurrentUser();
  const avatar = document.getElementById('profileAvatar');
  const nameElement = document.getElementById('profileName');
  const usernameElement = document.getElementById('profileUsername');
  const roleElement = document.getElementById('profileRole');

  if (!currentUser) {
    return;
  }

  avatar.textContent = currentUser.name.charAt(0).toUpperCase();
  nameElement.textContent = currentUser.name;
  usernameElement.textContent = currentUser.username;
  roleElement.textContent = currentUser.role === 'admin' ? 'Admin / Petugas Sarpras' : 'Siswa / Guru';

}

function renderDetailPage() {
  const currentUser = getCurrentUser();
  const reportId = new URLSearchParams(window.location.search).get('id');
  const reports = window.LaporSarprasStorage.getReports();
  const report = reports.find((item) => item.id === reportId);
  const container = document.getElementById('detailContent');

  if (!container) {
    return;
  }

  if (!report) {
    document.getElementById('detailTitle').textContent = 'Laporan tidak ditemukan';
    container.innerHTML = '<div class="empty-state">Laporan yang Anda cari tidak ditemukan.</div>';
    return;
  }

  document.getElementById('detailTitle').textContent = `${report.ticketNumber} - ${report.itemName}`;

  const isAdmin = currentUser && currentUser.role === 'admin';
  const canEdit = isAdmin && currentUser.role === 'admin';

  const historyMarkup = (report.history || [])
    .map(
      (entry) => `
        <div class="detail-row">
          <span>${escapeHtml(entry.status)}</span>
          <strong>${formatDate(entry.date)}</strong>
        </div>
        <div class="detail-row">
          <span>Catatan</span>
          <strong>${escapeHtml(entry.message)}</strong>
        </div>
      `
    )
    .join('');

  const updateFormMarkup = canEdit
    ? `
      <form id="statusUpdateForm" class="detail-update-form">
        <div class="field-group">
          <label for="statusUpdate">Ubah status laporan</label>
          <select id="statusUpdate" name="statusUpdate">
            <option value="Menunggu" ${report.status === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
            <option value="Sedang Diproses" ${report.status === 'Sedang Diproses' ? 'selected' : ''}>Sedang Diproses</option>
            <option value="Selesai" ${report.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
          </select>
        </div>

        <div class="field-group">
          <label for="handlingNote">Catatan penanganan</label>
          <textarea id="handlingNote" name="handlingNote" rows="4" placeholder="Masukkan catatan penanganan..."></textarea>
        </div>

        <div class="field-group">
          <label for="repairPhoto">Foto hasil perbaikan</label>
          <input id="repairPhoto" name="repairPhoto" type="file" accept="image/png,image/jpeg,image/jpg" />
        </div>

        <button type="submit" class="primary-btn">Simpan Perubahan</button>
      </form>
    `
    : '';

  container.innerHTML = `
    <div class="detail-box">
      <div class="detail-row"><span>Nomor tiket</span><strong>${escapeHtml(report.ticketNumber)}</strong></div>
      <div class="detail-row"><span>Nama pelapor</span><strong>${escapeHtml(report.reporterName)}</strong></div>
      <div class="detail-row"><span>Username</span><strong>${escapeHtml(report.reporterUsername)}</strong></div>
      <div class="detail-row"><span>Kelas</span><strong>${escapeHtml(report.reporterClass || '-')}</strong></div>
      <div class="detail-row"><span>Nama barang</span><strong>${escapeHtml(report.itemName)}</strong></div>
      <div class="detail-row"><span>Kategori</span><strong>${escapeHtml(report.category)}</strong></div>
      <div class="detail-row"><span>Lokasi</span><strong>${escapeHtml(report.location)}</strong></div>
      <div class="detail-row"><span>Prioritas</span><strong>${escapeHtml(report.priority)}</strong></div>
      <div class="detail-row"><span>Status</span><strong><span class="badge ${getStatusClass(report.status)}">${escapeHtml(report.status)}</span></strong></div>
      <div class="detail-row"><span>Tanggal laporan</span><strong>${formatDate(report.createdAt)}</strong></div>
      <div class="detail-row"><span>Deskripsi</span><strong>${escapeHtml(report.description)}</strong></div>
      <div class="detail-row"><span>Catatan penanganan</span><strong>${escapeHtml(report.notes || 'Belum ada catatan.')}</strong></div>

      <div class="detail-photo-grid">
        <div class="photo-card">
          <h4>Foto kerusakan</h4>
          <img src="${report.photo || ''}" alt="Foto kerusakan" />
        </div>
        <div class="photo-card">
          <h4>Foto hasil perbaikan</h4>
          <img src="${report.photoAfter || 'https://via.placeholder.com/600x400?text=Belum+ada+foto+hasil+perbaikan'}" alt="Foto hasil perbaikan" />
        </div>
      </div>

      <div class="panel">
        <h3>Riwayat perubahan status</h3>
        ${historyMarkup || '<div class="empty-state">Belum ada riwayat perubahan status.</div>'}
      </div>

      ${updateFormMarkup}
    </div>
  `;

  const updateForm = document.getElementById('statusUpdateForm');
  if (updateForm) {
    updateForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const status = document.getElementById('statusUpdate').value;
      const notes = document.getElementById('handlingNote').value.trim();
      const imageFile = document.getElementById('repairPhoto').files[0];

      let photoAfter = report.photoAfter || '';
      if (imageFile) {
        try {
          photoAfter = await compressImage(imageFile);
        } catch (error) {
          alert(error.message || 'Foto hasil perbaikan gagal diproses.');
          return;
        }
      }

      const updatedReport = { ...report };
      updatedReport.status = status;
      updatedReport.notes = notes || updatedReport.notes || 'Petugas menyiapkan penanganan.';
      updatedReport.updatedAt = new Date().toISOString();
      if (photoAfter) updatedReport.photoAfter = photoAfter;

      const historyEntry = {
        status,
        date: new Date().toISOString(),
        message: notes || 'Status laporan diperbarui oleh petugas.'
      };
      updatedReport.history = [...(updatedReport.history || []), historyEntry];

      try {
        await window.LaporSarprasStorage.updateReport(updatedReport);
        alert('Status laporan berhasil diperbarui.');
        window.location.reload();
      } catch (error) {
        alert(error.message || 'Gagal memperbarui laporan.');
      }
    });
  }
}
