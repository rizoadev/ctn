(function() {
    const CONFIG = {
        API_URL: 'https://ikamai-sandbox.firebaseio.com/sdfhsiuahef4rhaelrwheg54/flimty.json',
        DEBOUNCE_TIME: 300
    };

    function updateAccurateInput(inputEl, value) {
        if (!inputEl) return;
        inputEl.value = value;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function performLookup(query) {
        const resultsList = document.getElementById('ext-results-list');
        if (!query || query.length < 2) {
            resultsList.innerHTML = '<div style="padding:20px; color:#999; text-align:center;">Ketik minimal 2 karakter...</div>';
            return;
        }

        resultsList.innerHTML = '<div style="padding:20px; text-align:center;">Searching database...</div>';

        try {
            const response = await fetch(CONFIG.API_URL);
            const data = await response.json();
            
            if (!data || !data.customer_sub) return;

            const searchLower = query.toLowerCase();
            const filtered = [];

            Object.keys(data.customer_sub).forEach(key => {
                const item = data.customer_sub[key];
                if (item.nama.toLowerCase().includes(searchLower) || item.kode_utama.toLowerCase().includes(searchLower)) {
                    filtered.push({ ...item, id_key: key });
                }
            });

            if (filtered.length === 0) {
                resultsList.innerHTML = '<div style="padding:20px; text-align:center;">Tidak ada hasil.</div>';
                return;
            }

            resultsList.innerHTML = filtered.map(item => `
                <div class="ext-item" data-val="${item.nama}">
                    <span class="ext-item-name">${item.nama}</span>
                    <span class="ext-item-meta">${item.kode_utama} | ID: ${item.id_key}</span>
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
            resultsList.innerHTML = `<div style="padding:20px; color:red;">Error: ${err.message}</div>`;
        }
    }

    function init() {
        const targetInput = document.querySelector('input[name="charField1"]');
        if (!targetInput || document.getElementById('branch-lookup-btn')) return;

        const container = targetInput.closest('.input-control.text');
        
        // Injeksi Tombol
        const btn = document.createElement('button');
        btn.id = 'branch-lookup-btn';
        btn.innerHTML = 'Lookup';
        btn.type = 'button';
        Object.assign(btn.style, {
            marginLeft: '0', marginRight: '8px', padding: '0 12px', background: '#60a917',
            color: 'white', border: 'none', cursor: 'pointer', height: '34px',
            borderRadius: '2px', fontWeight: 'bold'
        });

        container.style.display = 'inline-flex';
        container.prepend(btn);

        // Injeksi Modal (jika belum ada)
        if (!document.getElementById('ext-lookup-overlay')) {
            const modal = `
                <div id="ext-lookup-overlay">
                    <div class="ext-modal-box">
                        <div class="ext-modal-header">
                            <span>Lookup Branch Customer</span>
                            <span id="ext-close" style="cursor:pointer">&times;</span>
                        </div>
                        <div class="ext-modal-body">
                            <input type="text" id="ext-search-field" placeholder="Cari nama atau kode...">
                            <div id="ext-results-list"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modal);
        }

        // Events
        btn.onclick = () => document.getElementById('ext-lookup-overlay').style.display = 'flex';
        document.getElementById('ext-close').onclick = () => document.getElementById('ext-lookup-overlay').style.display = 'none';
        
        let timer;
        document.getElementById('ext-search-field').oninput = (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => performLookup(e.target.value), CONFIG.DEBOUNCE_TIME);
        };
    }

    // Jalankan injeksi
    setInterval(init, 2000); // Gunakan interval karena halaman Accurate bersifat dinamis
})();