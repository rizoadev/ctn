(function() {
    'use strict';

    const CONFIG = {
        // Backend API — ganti ke endpoint real nanti
        FIREBASE: 'https://ikamai-sandbox.firebaseio.com/sdfhsiuahef4rhaelrwheg54',
        DEBOUNCE_TIME: 300,
    };

    /* ============================================================
       LOGIC BEARER TOKEN
       
       1. Popup login → simpan token ke chrome.storage.local
          { auth: { email: "...", token: "bearer_xxx", createdAt: ... } }
       
       2. Content script (di sini) baca token dari chrome.storage.local
          → token tersimpan di browser, antar session tetap ada
       
       3. Setiap search, token dikirim via header:
          Authorization: Bearer <token>
       
       4. Backend/mock validasi token → kalo valid, return data customer
          Kalo 401/token invalid → suruh login ulang
       ============================================================ */

    // --- READ TOKEN DARI BROWSER STORAGE ---
    async function getBearerToken() {
        const { auth } = await chrome.storage.local.get('auth');
        return auth?.token || null;
    }

    // --- API CALL DENGAN BEARER TOKEN ---
    async function apiCall(method, path, body = null) {
        const token = await getBearerToken();
        const headers = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        const res = await fetch(CONFIG.FIREBASE + path + '.json', {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
        });

        // 401 = token ditolak backend
        if (res.status === 401) {
            chrome.storage.local.remove('auth');
            throw new AuthError('Token invalid atau expired');
        }

        return res.json();
    }

    class AuthError extends Error {
        constructor(m) { super(m); this.name = 'AuthError'; }
    }

    // --- VERIFIKASI TOKEN (via backend mock) ---
    // Nanti kalau pake backend real, cukup andelin response 401 di apiCall()
    async function verifyToken(token) {
        try {
            // Mock: cek apakah token ada di Firebase /tokens/
            const data = await fetch(CONFIG.FIREBASE + '/tokens/' + token + '.json')
                .then(r => r.json());
            return data && data.email ? data : null;
        } catch { return null; }
    }

    // --- SEARCH CUSTOMER ---
    async function performLookup(query) {
        const resultsList = document.getElementById('ext-results-list');

        if (!query || query.length < 2) {
            resultsList.innerHTML = '<div class="ext-placeholder">Ketik minimal 2 karakter...</div>';
            return;
        }

        // 1. Ambil token dari browser storage
        const token = await getBearerToken();
        if (!token) {
            resultsList.innerHTML = '<div class="ext-placeholder ext-error">🔐 Belum login — klik ikon ekstensi</div>';
            return;
        }

        // 2. (Mock) Verifikasi token ke server
        //    Real: cukup kirim request dengan Authorization header,
        //    backend otomatis return 401 kalo token invalid.
        const tokData = await verifyToken(token);
        if (!tokData) {
            resultsList.innerHTML = '<div class="ext-placeholder ext-error">🔐 Sesi habis — login ulang</div>';
            chrome.storage.local.remove('auth');
            return;
        }

        resultsList.innerHTML = '<div class="ext-placeholder">⏳ Mencari...</div>';

        try {
            // 3. Panggil API dengan Bearer token di header
            //    (apiCall() otomatis attach Authorization: Bearer <token>)
            const data = await apiCall('GET', '/flimty');

            if (!data?.customer_sub) {
                resultsList.innerHTML = '<div class="ext-placeholder">Data tidak tersedia</div>';
                return;
            }

            // 4. Filter & tampilkan
            const q = query.toLowerCase();
            const filtered = [];
            Object.keys(data.customer_sub).forEach(key => {
                const item = data.customer_sub[key];
                if (item.nama?.toLowerCase().includes(q) ||
                    item.kode_utama?.toLowerCase().includes(q)) {
                    filtered.push({ ...item, id: key });
                }
            });

            if (filtered.length === 0) {
                resultsList.innerHTML = '<div class="ext-placeholder">Tidak ada hasil.</div>';
                return;
            }

            resultsList.innerHTML = filtered.map(item => `
                <div class="ext-item" data-val="${escapeHtml(item.nama)}">
                    <span class="ext-item-name">${escapeHtml(item.nama)}</span>
                    <span class="ext-item-meta">${escapeHtml(item.kode_utama || '')} ${item.id ? '| ID: ' + escapeHtml(item.id) : ''}</span>
                </div>
            `).join('');

            resultsList.querySelectorAll('.ext-item').forEach(el => {
                el.onclick = function() {
                    const val = this.getAttribute('data-val');
                    const target = document.querySelector('input[name="charField1"]');
                    updateAccurateInput(target, val);
                    document.getElementById('ext-lookup-overlay').style.display = 'none';
                };
            });

        } catch (err) {
            if (err instanceof AuthError) {
                resultsList.innerHTML = '<div class="ext-placeholder ext-error">🔐 Sesi habis — login ulang</div>';
            } else {
                resultsList.innerHTML = `<div class="ext-placeholder ext-error">Error: ${escapeHtml(err.message)}</div>`;
            }
        }
    }

    // --- HELPERS ---
    function updateAccurateInput(el, val) {
        if (!el) return;
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function escapeHtml(t) {
        if (!t) return '';
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    // --- UI Injection ---
    function init() {
        const target = document.querySelector('input[name="charField1"]');
        if (!target || document.getElementById('branch-lookup-btn')) return;

        const c = target.closest('.input-control.text');
        if (!c) return;

        const btn = document.createElement('button');
        btn.id = 'branch-lookup-btn';
        btn.innerHTML = '🔍 Lookup';
        btn.type = 'button';
        Object.assign(btn.style, {
            padding: '0 12px',
            background: '#60a917',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            height: '34px',
            borderRadius: '2px',
            fontWeight: 'bold',
            fontSize: '13px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
        });

        c.style.display = 'inline-flex';
        c.prepend(btn);

        if (!document.getElementById('ext-lookup-overlay')) {
            const m = document.createElement('div');
            m.id = 'ext-lookup-overlay';
            m.innerHTML = `
                <div class="ext-modal-box">
                    <div class="ext-modal-header">
                        <span>🔍 Lookup Branch Customer</span>
                        <span id="ext-close" class="ext-close-btn">&times;</span>
                    </div>
                    <div class="ext-auth-status" id="ext-auth-status">⏳ cek sesi...</div>
                    <div class="ext-modal-body">
                        <input type="text" id="ext-search-field" placeholder="Cari nama atau kode...">
                        <div id="ext-results-list">
                            <div class="ext-placeholder">Ketik untuk mencari...</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(m);
        }

        btn.onclick = () => {
            document.getElementById('ext-lookup-overlay').style.display = 'flex';
            updateAuthStatus();
            document.getElementById('ext-search-field').focus();
        };
        document.getElementById('ext-close').onclick = () => {
            document.getElementById('ext-lookup-overlay').style.display = 'none';
        };
        document.getElementById('ext-lookup-overlay').onclick = (e) => {
            if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
        };

        let timer;
        document.getElementById('ext-search-field').oninput = (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => performLookup(e.target.value), CONFIG.DEBOUNCE_TIME);
        };
    }

    async function updateAuthStatus() {
        const el = document.getElementById('ext-auth-status');
        if (!el) return;
        const token = await getBearerToken();
        if (token) {
            const d = await verifyToken(token);
            if (d) {
                el.innerHTML = '✅ <b>Terautentikasi</b> — ' + escapeHtml(d.email);
                el.className = 'ext-auth-status authed';
            } else {
                el.innerHTML = '🔐 <b>Token invalid</b> — login ulang';
                el.className = 'ext-auth-status unauthed';
                chrome.storage.local.remove('auth');
            }
        } else {
            el.innerHTML = '🔐 <b>Belum login</b> — klik ikon ekstensi';
            el.className = 'ext-auth-status unauthed';
        }
    }

    // --- START ---
    setInterval(() => {
        init();
        if (document.getElementById('branch-lookup-btn')) clearInterval(this);
    }, 1500);

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.auth) {
            const o = document.getElementById('ext-lookup-overlay');
            if (o && o.style.display === 'flex') updateAuthStatus();
        }
    });

})();
