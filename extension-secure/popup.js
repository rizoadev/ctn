// popup.js — Mock OTP login (email + 123456 + bearer token)
const CONFIG = {
  FIREBASE: 'https://ikamai-sandbox.firebaseio.com/sdfhsiuahef4rhaelrwheg54',
  MOCK_OTP: '123456',
  BEARER_TOKEN: '34rw3aoyr834SECURE',
};

const $ = id => document.getElementById(id);
let currentEmail = '';

// --- UI ---
function showStep(name) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  $('step-' + name).classList.add('active');
}
function setStatus(id, msg, type = '') {
  const el = $(id);
  el.textContent = msg;
  el.className = 'status' + (type ? ' ' + type : '');
}
function clearStatus(id) {
  $(id).textContent = '';
  $(id).className = 'status';
}

// --- Firebase helpers ---
async function fbPut(path, data) {
  await fetch(CONFIG.FIREBASE + path + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
async function fbDelete(path) {
  await fetch(CONFIG.FIREBASE + path + '.json', { method: 'DELETE' });
}

// --- Storage ---
async function saveAuth(email, token) {
  await chrome.storage.local.set({ auth: { email, token, createdAt: Date.now() } });
}
async function clearAuth() {
  await chrome.storage.local.remove('auth');
}
async function getAuth() {
  const { auth } = await chrome.storage.local.get('auth');
  return auth || null;
}

// --- Step 1: Kirim OTP (mock — langsung pindah step) ---
$('btn-send').onclick = () => {
  const email = $('email').value.trim();
  if (!email || !email.includes('@')) return setStatus('status-email', 'Masukkan email valid', 'error');

  currentEmail = email;
  $('display-email').textContent = email;
  clearStatus('status-email');
  showStep('otp');
  $('otp').value = '';
  $('otp').focus();
};

$('email').onkeydown = e => { if (e.key === 'Enter') $('btn-send').click(); };

// --- Step 2: Verifikasi OTP (mock: 123456) ---
$('btn-verify').onclick = async () => {
  const otp = $('otp').value.trim();
  if (!otp) return setStatus('status-otp', 'Masukkan kode OTP', 'error');

  if (otp !== CONFIG.MOCK_OTP) {
    return setStatus('status-otp', 'Kode OTP salah. Coba 123456', 'error');
  }

  setStatus('status-otp', 'Memverifikasi...');
  $('btn-verify').disabled = true;

  try {
    // Bearer token — sandbox: fixed value
    const token = CONFIG.BEARER_TOKEN;

    // Simpan token ke Firebase (mock server)
    await fbPut('/tokens/' + token, {
      email: currentEmail,
      createdAt: Date.now(),
    });

    // Simpan ke local
    await saveAuth(currentEmail, token);
    showConnected(currentEmail, token);
  } catch (err) {
    setStatus('status-otp', 'Gagal: ' + err.message, 'error');
  } finally {
    $('btn-verify').disabled = false;
  }
};

$('otp').onkeydown = e => { if (e.key === 'Enter') $('btn-verify').click(); };
$('btn-back').onclick = () => { showStep('email'); clearStatus('status-otp'); };

// --- Step 3: Connected ---
function showConnected(email, token) {
  $('display-email2').textContent = email;
  // token-info hidden
  showStep('connected');
}

$('btn-logout').onclick = async () => {
  const auth = await getAuth();
  if (auth?.token) {
    await fbDelete('/tokens/' + auth.token).catch(() => {});
  }
  await clearAuth();
  $('email').value = '';
  showStep('email');
  clearStatus('status-email');
  clearStatus('status-otp');
};

// --- Init ---
(async () => {
  const auth = await getAuth();
  if (auth?.token) {
    showConnected(auth.email, auth.token);
  }
})();
