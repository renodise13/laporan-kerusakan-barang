document.addEventListener('DOMContentLoaded', function () {
  const storage = window.LaporSarprasStorage;
  const loginForm = document.getElementById('loginForm');

  if (!storage) {
    showPageError('Koneksi database belum siap. Muat ulang halaman atau hubungi administrator.');
    return;
  }

  bindLogoutButtons(storage);

  if (loginForm) {
    initLoginPage(storage, loginForm);
    return;
  }

  initializeProtectedPage(storage);
});

function initLoginPage(storage, form) {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitButton = document.getElementById('loginSubmit');
  const message = document.getElementById('authMessage');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    message.textContent = '';
    submitButton.disabled = true;

    try {
      const username = usernameInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      if (!username || !password) {
        throw new Error('Username dan password wajib diisi.');
      }

      const user = await storage.signIn(username, password);
      window.location.href = user.role === 'admin' ? 'pages/admin.html' : 'pages/dashboard.html';
    } catch (error) {
      message.textContent = error.message || 'Autentikasi gagal.';
    } finally {
      submitButton.disabled = false;
    }
  });

  storage.restoreSession()
    .then((user) => {
      if (user) {
        window.location.href = user.role === 'admin' ? 'pages/admin.html' : 'pages/dashboard.html';
      }
    })
    .catch((error) => { message.textContent = error.message; });
}

async function initializeProtectedPage(storage) {
  try {
    const currentUser = await storage.restoreSession();
    if (!currentUser) {
      window.location.href = '../login.html';
      return;
    }

    const requiredRole = document.body.dataset.role;
    if (requiredRole && currentUser.role !== requiredRole) {
      window.location.href = currentUser.role === 'admin' ? 'admin.html' : 'dashboard.html';
      return;
    }

    await storage.refreshReports();
    window.dispatchEvent(new CustomEvent('laporSarprasReady'));

    const channel = storage.client
      .channel('lapor-sarpras-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, async function () {
        try {
          await storage.refreshReports();
          window.dispatchEvent(new CustomEvent('laporSarprasReportsUpdated'));
        } catch (error) {
          showPageError(error.message);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          showPageError('Pembaruan langsung gagal tersambung. Muat ulang halaman untuk mengambil laporan terbaru.');
        }
      });

    window.addEventListener('beforeunload', function () {
      storage.client.removeChannel(channel);
    });
  } catch (error) {
    showPageError(error.message || 'Gagal menyiapkan akun dan laporan.');
  }
}

function bindLogoutButtons(storage) {
  document.querySelectorAll('#logoutBtn, #profileLogoutBtn').forEach((button) => {
    button.addEventListener('click', async function () {
      button.disabled = true;
      try {
        await storage.signOut();
        window.location.href = '../login.html';
      } catch (error) {
        button.disabled = false;
        showPageError(error.message);
      }
    });
  });
}

function showPageError(message) {
  const main = document.querySelector('main');
  if (!main) {
    window.alert(message);
    return;
  }

  let banner = document.getElementById('syncErrorBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'syncErrorBanner';
    banner.className = 'sync-error-banner';
    banner.setAttribute('role', 'alert');
    main.prepend(banner);
  }
  banner.textContent = message;
}
