# Accurate Branch Lookup v2 — Secure (Mock)

## Flow

```
Popup                            Firebase
  │                                │
  ├─ Masukkan email                │
  ├─ Kirim OTP → (mock)            │
  ├─ Masukkan 123456               │
  ├─ Verifikasi ✓                  │
  ├─ PUT /tokens/{token}.json ────►│  { email, createdAt }
  ├─ Simpan ke chrome.storage ──┐  │
  │                             │  │
Popup tutup                     │  │
  │                             │  │
Content Script                  │  │
  ├─ Baca token dari storage ◄──┘  │
  ├─ GET /tokens/{token}.json ────►│  cek valid
  ├─ GET /flimty.json ────────────►│  ambil data customer
  └─ Filter & tampilkan hasil      │
```

## Mock credentials

| Field | Value |
|-------|-------|
| Email | bebas (apa saja, asal format email) |
| OTP | `123456` (fixed) |

## Data di Firebase

```
/{root}/
├── flimty/customer_sub/   ← data customer (existing)
└── tokens/{token}.json    ← { email, createdAt } — session token (auto-generated)
```

## File

```
extension-secure/
├── manifest.json
├── popup.html       ← login UI (email + OTP)
├── popup.js         ← mock OTP + bearer token
├── content.js       ← lookup + token verification
├── style.css
└── README.md
```
