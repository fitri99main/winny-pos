**Backend Follow-Up**

Tanggal verifikasi live: `2026-05-21`

Temuan read-only pada database aktif:
- `client_transaction_id` sudah aktif dipakai dan tidak terlihat duplikasi pada sampel transaksi terbaru.
- `order_no` juga tidak menunjukkan duplikasi pada sampel transaksi terbaru.
- `hold_invoice_last_number` tidak sinkron dengan data historis HOLD.
- `enable_wifi_vouchers` aktif, tetapi pool `wifi_vouchers` kosong.

**File Baru**

1. `04_sync_hold_invoice_counter.sql`
2. `05_disable_wifi_vouchers_if_pool_empty.sql`

**Urutan Aman Saat Jam Sepi**

1. Jalankan `04_sync_hold_invoice_counter.sql`
2. Verifikasi hasil query di akhir script
3. Pilih salah satu:
   - Jika belum ada voucher yang akan diimpor, jalankan `05_disable_wifi_vouchers_if_pool_empty.sql`
   - Jika voucher akan tetap dipakai, isi pool voucher dulu lalu verifikasi trigger WiFi

**Kapan Tidak Perlu Menjalankan Script Voucher**

- Jika Anda memang akan segera mengimpor voucher WiFi pada hari yang sama
- Jika fitur voucher tidak pernah dipakai dan lebih mudah dimatikan langsung dari pengaturan admin

**Smoke Test Setelah SQL**

1. Buat 1 transaksi `Pending` lalu cek nomor HOLD berikutnya tidak mundur atau bentrok.
2. Lanjutkan transaksi tersebut ke `Paid` / `Completed`.
3. Buat 1 transaksi tunai normal dan pastikan checkout tetap sukses satu kali.
4. Jika voucher dimatikan, pastikan struk tidak lagi mengharapkan voucher WiFi.

**Catatan**

- File ini belum dieksekusi otomatis.
- Semua perubahan di atas disiapkan untuk rollout manual terjadwal.
