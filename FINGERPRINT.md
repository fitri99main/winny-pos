# Fingerprint Setup & Troubleshooting Guide

Panduan ini menjelaskan langkah-langkah untuk menyiapkan alat pembaca sidik jari (fingerprint scanner) agar dapat berfungsi dengan aplikasi POS.

## Persyaratan Sistem

Aplikasi ini menggunakan DigitalPersona Web SDK. Agar browser dapat berkomunikasi dengan alat fingerprint, Anda wajib menginstal client software di Windows.

### Software yang Dibutuhkan
Pastikan salah satu dari software berikut sudah terinstal:
1. **DigitalPersona Lite Client v2.1.1** (Direkomendasikan)
2. **HID Authentication Device Client**

### Hardware yang Didukung
- DigitalPersona U.are.U 4500 USB
- Perangkat ZKTeco yang menggunakan sensor DigitalPersona (4500)

## Langkah Instalasi

1. **Pasang Alat**: Hubungkan alat fingerprint ke port USB komputer.
2. **Instal Driver/Client**: Jalankan installer **DigitalPersona Lite Client v2.1.1**.
3. **Cek Layanan (Service)**:
   - Tekan `Win + R`, ketik `services.msc`, lalu tekan Enter.
   - Cari layanan bernama **DigitalPersona Lite Client** atau **Biometric Authentication Service**.
   - Pastikan statusnya adalah **Running** (Berjalan). Jika tidak, klik kanan dan pilih **Start**.
4. **Izin Browser**: Jika browser meminta izin untuk mengakses perangkat HID, pilih **Allow** atau **Izinkan**.

## Troubleshooting

### Alat Tidak Terdeteksi
- Pastikan kabel USB terpasang dengan benar.
- Coba pindahkan ke port USB lain.
- Pastikan lampu di alat fingerprint menyala (untuk model 4500).

### Error: "Pastikan DigitalPersona Lite Client berjalan" atau "ERR_CONNECTION_REFUSED"
- Ini berarti aplikasi web tidak dapat berkomunikasi dengan service di Windows.
- **Penyebab Utama**: Service belum jalan atau Port sedang dipakai aplikasi lain.
- **Port Penting**: SDK resmi berjalan di port **52181** (HTTP) atau **52182** (HTTPS).
- **Cara Diagnosa Lanjut**:
  1. Buka **Command Prompt (CMD)**.
  2. Ketik perintah ini: `netstat -ano | findstr :52181`
  3. Jika hasilnya kosong: Berarti layanannya **belum jalan**. Silakan cari **DigitalPersona Biometric Service** di `services.msc`.
  4. Jika ada hasilnya: Catat **PID** (nomor di ujung kanan). Cek di Task Manager aplikasi apa yang memakai port tersebut.

### Masalah HTTPS
- Jika aplikasi berjalan di `https://`, browser mungkin memblokir koneksi ke `http://localhost:52181`.
- Coba buka alamat ini langsung di browser untuk memberikan izin: `https://localhost:52182/get_device_list`
- Jika muncul peringatan "Your connection is not private", pilih **Advanced** lalu **Proceed to localhost**.

### Masalah Ekstensi Browser (McAfee WebAdvisor, dll)
- Kadang koneksi ke `localhost` diblokir oleh ekstensi keamanan di browser.
- **Tanda-tanda**: Muncul logo atau peringatan McAfee di pojok browser atau saat membuka link localhost.
- **Solusi**:
  1. Klik ikon **Puzzle** (Extensions) di pojok kanan atas browser (Chrome/Edge).
  2. Cari **McAfee WebAdvisor** atau sejenisnya.
  3. Nonaktifkan sementara atau tambahkan `localhost` ke daftar putih (whitelist) di pengaturan ekstensi tersebut.
  4. Coba akses [http://localhost:52181](http://localhost:52181) - jika muncul "Not Found" itu normal (artinya koneksi sudah tersabung tapi tidak boleh lewat browser langsung). Jika "Site cannot be reached", berarti masih diblokir.

### Catatan Port 8080 (Bridge)
- Folder `bridge/` (Port 8080) hanya digunakan untuk keperluan **Simulasi/Testing** jika tidak ada alat asli. Aplikasi utama POS menggunakan port **52181** secara langsung.

### Sidik Jari Sulit Terbaca
- Pastikan permukaan sensor bersih dari debu atau minyak.
- Pastikan jari tidak terlalu kering atau terlalu basah.
- Tempelkan jari tepat di tengah sensor dengan sedikit tekanan.
