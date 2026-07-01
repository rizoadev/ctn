# Accurate Branch Lookup — Chrome Extension

> Chrome extension untuk lookup Branch Customer di Accurate.id, dengan OTP login + Bearer token.

## Daftar Isi

- [V1 — Original](#v1--original)
- [V2 — Secure (With Auth)](#v2--secure-with-auth)
- [Struktur Repo](#struktur-repo)
- [Development](#development)

---

## V1 — Original

**Folder:** `extension/`

Extension content script sederhana — inject tombol Lookup di halaman Accurate, baca data customer dari Firebase publik, filter client-side.

| File | Fungsi |
|------|--------|
| `manifest.json` | Manifest v3, content script di `*.accurate.id/*` |
| `content.js` | Inject tombol + modal, fetch data dari Firebase, filter & tampilkan |
| `style.css` | Styling modal |

**Cara install:** Load unpacked di `chrome://extensions`.

---

## V2 — Secure (With Auth)

**Folder:** `extension-secure/`

Upgrade keamanan — user harus login via OTP dulu, baru bisa akses lookup.

### Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    POPUP (otp login)                        │
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐    │
│  │ Email     │ ──► │ OTP      │ ──► │ Connected +      │    │
│  │ (input)   │     │ 123456   │     │ Bearer token     │    │
│  └──────────┘     └──────────┘     └────────┬─────────┘    │
│                                              │              │
│                    chrome.storage.local      │              │
│                    { auth: {                 │              │
│                      email,                  │              │
│                      token: "34rw3aoyr..."   │              │
│                      createdAt               │              │
│                    }}                         │              │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                  ═════════════════════════════╪═══════════════
                    CONTENT SCRIPT (accurate.id)│
                                               ▼
                    ┌──────────────────────────────────────┐
                    │  getBearerToken()                     │
                    │  → baca token dari chrome.storage     │
                    └────────────┬─────────────────────────┘
                                 │
                    ┌────────────▼─────────────────────────┐
                    │  verifyToken(token)                   │
                    │  → GET /tokens/{token}.json           │
                    │  → valid? lanjut | invalid? login     │
                    └────────────┬─────────────────────────┘
                                 │
                    ┌────────────▼─────────────────────────┐
                    │  apiCall(GET, '/flimty')              │
                    │  → header: Authorization: Bearer xxx  │
                    │  → ambil data customer                │
                    └────────────┬─────────────────────────┘
                                 │
                    ┌────────────▼─────────────────────────┐
                    │  Filter by query                      │
                    │  Tampilkan hasil di modal             │
                    └──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE (mock backend)                   │
│                                                             │
│  /{root}/                                                    │
│  ├── flimty/customer_sub/   ← data customer (existing)      │
│  └── tokens/{token}.json    ← { email, createdAt }          │
│                                                             │
│  Rules: public read/write (sandbox)                         │
└─────────────────────────────────────────────────────────────┘
```

### Flow Login

```
Step 1: Buka popup → masukkan email (bebas, asal format email)
Step 2: Klik "Kirim OTP" → pindah ke halaman OTP
Step 3: Masukkan 123456 → klik Verifikasi
Step 4: Extension simpan token ke:
          • chrome.storage.local (browser)
          • Firebase /tokens/{token}.json (server mock)
Step 5: Popup nutup → siap dipakai
```

### Flow Search

```
Step 1: Buka Accurate.id → inject tombol Lookup
Step 2: Klik Lookup → modal terbuka
Step 3: Auth status: cek token dari chrome.storage → validasi ke Firebase
Step 4: Ketik minimal 2 karakter → search
Step 5: Content script:
          1. Ambil token dari chrome.storage
          2. Verifikasi token ke Firebase /tokens/{token}
          3. Baca data customer dari Firebase /flimty
          4. Filter client-side
          5. Tampilkan hasil
Step 6: Klik hasil → auto-fill ke field Accurate
```

### Data Flow

```
                 POPUP                        FIREBASE                   CONTENT SCRIPT
                  │                              │                            │
  ── Login ──►    │                              │                            │
                  │  PUT /tokens/{token}.json ──►│  { email, createdAt }      │
                  │  chrome.storage.local set ───┘                            │
                  │                              │                            │
  ── Search ──►   │                              │                            │
                  │                              │                            │
                  │                              │◄── GET /tokens/{token} ───┤
                  │                              │── { email } ──────────────►│
                  │                              │                            │
                  │                              │◄── GET /flimty ───────────┤
                  │                              │── customer_sub  ──────────►│
                  │                              │                            │
                  │                              │                   Filter & render
```

### Bearer Token

Token disimpan di `chrome.storage.local` (browser storage):

```json
{
  "auth": {
    "email": "user@kantor.com",
    "token": "34rw3aoyr834SECURE",
    "createdAt": 1719824000000
  }
}
```

Setiap API call, content script attach header:

```
Authorization: Bearer 34rw3aoyr834SECURE
```

### Mock Credentials (Sandbox)

| Item | Value |
|------|-------|
| Email | bebas (format email) |
| OTP | `123456` |
| Bearer Token | `34rw3aoyr834SECURE` |

### File Structure

```
extension-secure/
├── manifest.json          ← Manifest v3, host_permissions Firebase
├── popup.html             ← Login UI (email + OTP)
├── popup.js               ← OTP flow + save token
├── content.js             ← Lookup UI + Bearer token API call
├── style.css              ← Modal styling
└── README.md              ← File ini
```

### Cara Install

1. Buka `chrome://extensions`
2. Nyalakan **Developer mode** (pojok kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `extension-secure/`
5. Klik ikon extension → login dengan OTP `123456`
6. Buka `accurate.id` → tombol Lookup muncul

---

## Struktur Repo

```
ctn/
├── extension/                ← V1 (tanpa auth)
│   ├── manifest.json
│   ├── content.js
│   └── style.css
│
├── extension-secure/         ← V2 (dengan OTP + Bearer token)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── content.js
│   ├── style.css
│   └── README.md
│
├── README-INSTALL.md         ← Panduan install alternatif
└── README.md                 ← File ini
```

## Development

### Prasyarat

- Chrome/Chromium terbaru
- Firebase RTDB dengan akses public (sandbox)

### Setup Lokal

```bash
git clone <repo-url>
cd ctn
# Load extension/ atau extension-secure/ via chrome://extensions
```

### Migrasi V1 → V2

| Aspek | V1 | V2 |
|-------|----|----|
| Auth | ❌ Tidak ada | ✅ OTP (email + 123456) |
| Token | ❌ | ✅ Bearer token disimpan di browser |
| API call | Firebase langsung | Authorization: Bearer header |
| UI | Popup none | Popup login |
| Keamanan | Publik | Token-based (mock) |

### TODO (real backend)

- [ ] Ganti Firebase → backend REST API
- [ ] Validasi Bearer token real (JWT)
- [ ] OTP via SMS/email gateway
- [ ] Firebase rules diperketat

---

**License:** Internal — PT Ikamai
