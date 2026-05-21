**Rollout**

Jalur yang disarankan sekarang:

1. Jalankan `00_pos_hold_checkout_stability.sql`
2. Uji transaksi:
   - bayar tunai
   - bayar QRIS / non-tunai
   - hold order
   - lanjutkan pending order ke paid
3. Jika semua stabil, jalankan `03_wifi_voucher_trigger_optimization.sql`

Alternatif jika ingin eksekusi bertahap:

1. `add_hold_invoice_settings.sql`
2. `01_add_client_transaction_id.sql`
3. `02_upsert_sale_with_items_idempotent.sql`

**Catatan**

- Jalankan saat jam transaksi sepi.
- Deploy app mobile setelah rollout utama sukses.
- `00_pos_hold_checkout_stability.sql` adalah file kanonik untuk database baru atau cabang baru.
- `fix_checkout_idempotency_v1.sql` dan file `upsert_atomic_order_v*.sql` sebaiknya dianggap arsip historis, bukan jalur rollout aktif.
- Tahap voucher WiFi sebaiknya tetap dipisah agar checkout utama tetap aman jika ada masalah voucher.

**Smoke Test**

1. Buat transaksi baru lalu bayar tunai.
2. Pastikan hanya 1 baris `sales` tercipta.
3. Ulangi skenario dengan QRIS / non-tunai.
4. Buat order `Pending`, lalu lanjutkan ke `Paid`.
5. Buat beberapa order hold berurutan dan pastikan `order_no` tidak bentrok.
6. Jika fitur voucher aktif, cek jumlah voucher yang terpasang sesuai nominal.

**Status Validasi**

- Empat skenario inti checkout sudah diuji dan hasilnya bagus:
- bayar tunai
- bayar QRIS / non-tunai
- hold order
- lanjutkan pending order ke paid

**Kesimpulan**

- Masalah utama checkout / pembayaran yang sebelumnya menyebabkan loading berkepanjangan dinyatakan stabil secara fungsional setelah rollout `00_pos_hold_checkout_stability.sql` dan smoke test inti lulus.
- Tahap voucher WiFi tetap diperlakukan sebagai tahap lanjutan yang terpisah dari checkout utama.
- Script voucher WiFi perlu mengenali status selesai termasuk `done` selain `paid`, `selesai`, dan `completed`.

**Checklist Penutupan**

1. Pastikan `00_pos_hold_checkout_stability.sql` sudah diterapkan pada database target.
2. Simpan hasil smoke test sebagai bukti validasi issue checkout utama.
3. Monitor transaksi real untuk memastikan tidak ada gejala transaksi dobel, timeout, atau loading lama yang berulang.
4. Jika fitur voucher WiFi dipakai, terapkan `03_wifi_voucher_trigger_optimization.sql` versi terbaru yang sudah mendukung status `done`.
5. Setelah monitoring aman, issue checkout utama bisa ditutup.
