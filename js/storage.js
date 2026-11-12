(function () {
  const config = window.LaporSarprasSupabaseConfig;
  if (!config || !window.supabase?.createClient) {
    throw new Error('Konfigurasi Supabase atau library Supabase belum tersedia.');
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let currentUser = null;
  let reports = [];

  function getCurrentUser() {
    return currentUser;
  }

  function setCurrentUser(user) {
    currentUser = user;
  }

  async function getProfile(user) {
    const { data, error } = await client
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new Error(`Gagal memuat profil akun: ${error.message}`);
    }

    return {
      id: data.id,
      email: user.email,
      username: Object.entries(config.loginEmails)
        .find(([, loginEmail]) => loginEmail === user.email)?.[0] || user.email,
      name: data.name,
      role: data.role
    };
  }

  async function restoreSession() {
    const { data, error } = await client.auth.getSession();
    if (error) {
      throw new Error(`Gagal memeriksa sesi login: ${error.message}`);
    }

    if (!data.session) {
      currentUser = null;
      return null;
    }

    currentUser = await getProfile(data.session.user);
    return currentUser;
  }

  async function signIn(username, password) {
    const email = config.loginEmails[username.trim().toLowerCase()];
    if (!email) {
      throw new Error('Username atau password tidak sesuai.');
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error('Username atau password tidak sesuai.');
    }
    currentUser = await getProfile(data.user);
    return currentUser;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(`Gagal keluar dari akun: ${error.message}`);
    }
    currentUser = null;
    reports = [];
  }

  async function refreshReports() {
    const { data, error } = await client
      .from('reports')
      .select('id, payload')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Gagal memuat laporan bersama: ${error.message}`);
    }

    reports = data.map((row) => ({ ...row.payload, id: row.id }));
    return reports;
  }

  function getReports() {
    return reports.slice();
  }

  async function createReport(report) {
    if (!currentUser) {
      throw new Error('Silakan login kembali untuk mengirim laporan.');
    }

    const { error } = await client.from('reports').insert({
      id: report.id,
      user_id: currentUser.id,
      payload: report
    });

    if (error) {
      throw new Error(`Gagal menyimpan laporan ke database: ${error.message}`);
    }

    reports = [report, ...reports.filter((item) => item.id !== report.id)];
  }

  async function updateReport(report) {
    const { data, error } = await client
      .from('reports')
      .update({ payload: report, updated_at: new Date().toISOString() })
      .eq('id', report.id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Gagal memperbarui laporan: ${error.message}`);
    }
    if (!data) {
      throw new Error('Laporan tidak ditemukan atau akun tidak memiliki izin untuk mengubahnya.');
    }

    reports = reports.map((item) => item.id === report.id ? report : item);
  }

  async function importLegacyReports() {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Hanya admin yang dapat mengimpor laporan dari perangkat ini.');
    }

    let legacyReports;
    try {
      legacyReports = JSON.parse(localStorage.getItem('laporsarpras_reports') || '[]');
    } catch (error) {
      throw new Error(`Data laporan lokal tidak dapat dibaca: ${error.message}`);
    }

    if (!Array.isArray(legacyReports)) {
      throw new Error('Format data laporan lokal tidak valid.');
    }

    const existingIds = new Set(reports.map((report) => report.id));
    const toImport = legacyReports
      .filter((report) => report && report.id && !existingIds.has(report.id))
      .map((report) => ({
        id: String(report.id),
        user_id: currentUser.id,
        payload: { ...report, _legacyImport: true }
      }));

    if (!toImport.length) {
      return 0;
    }

    const { error } = await client.from('reports').insert(toImport);
    if (error) {
      throw new Error(`Gagal mengimpor laporan lokal: ${error.message}`);
    }

    await refreshReports();
    return toImport.length;
  }

  function nextTicketNumber() {
    const suffix = window.crypto?.randomUUID
      ? window.crypto.randomUUID().slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();
    return `TK-${Date.now()}-${suffix}`;
  }

  window.LaporSarprasStorage = {
    client,
    getCurrentUser,
    setCurrentUser,
    restoreSession,
    signIn,
    signOut,
    refreshReports,
    getReports,
    createReport,
    updateReport,
    importLegacyReports,
    nextTicketNumber
  };
})();
