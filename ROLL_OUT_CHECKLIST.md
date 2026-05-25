**Rollout Checklist**

Dokumen ini untuk eksekusi aman sebelum deploy setelah audit pasif pada:

- `realtime throttling` di POS screen
- `lock contention` di function SQL checkout

Belum ada asumsi deploy di dokumen ini. Fokusnya adalah validasi bertahap dan keputusan `go / no-go`.

**Scope**

- Jalur SQL utama: [00_pos_hold_checkout_stability.sql](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/00_pos_hold_checkout_stability.sql:1)
- Jalur voucher lanjutan: [03_wifi_voucher_trigger_optimization.sql](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/03_wifi_voucher_trigger_optimization.sql:1)
- Area risiko utama:
- `upsert_sale_with_items`
- realtime order sync di POS mobile
- refetch transaksi dan branch data di web POS/admin

**Baseline**

Jalankan 3 skenario tetap berikut sebelum perubahan apa pun:

1. `order baru`
2. `hold / edit order`
3. `bayar / close order`

Catat hasil berikut:

- durasi checkout / RPC
- jumlah timeout
- jumlah refetch order list
- jumlah event realtime `sales` dan `sale_items`
- apakah `sales`, `sale_items`, stok, voucher, dan status meja tetap konsisten

**Fase 1**

Tujuan: observability tanpa mengubah perilaku aplikasi.

Checklist:

1. Pastikan tidak ada deploy atau migrasi lain berjalan bersamaan.
2. Jalankan 3 skenario baseline.
3. Catat lonjakan event setelah 1 transaksi normal.
4. Catat apakah timeout client terjadi walau transaksi akhirnya tetap commit.
5. Catat apakah perubahan checkout ikut memicu update berantai ke:
- `stock_movements`
- `ingredients`
- `products`
- `tables`

Selesai jika:

- sumber bottleneck utama sudah jelas
- baseline sebelum patch sudah terdokumentasi

**Fase 2**

Tujuan: patch SQL kecil dengan risiko minimum.

Fokus:

- kurangi kerja transaksi di `upsert_sale_with_items`
- prioritaskan pengurangan `delete + insert all sale_items`
- pertahankan `client_transaction_id` dan jalur idempotency yang sudah ada

Checklist:

1. Terapkan patch kecil hanya pada jalur checkout SQL.
2. Ulangi 3 skenario baseline.
3. Verifikasi:
- `sales` konsisten
- `sale_items` tidak dobel atau hilang
- `order_no` tetap benar
- `stock_movements` tidak melonjak tidak wajar
- stok produk dan bahan tetap sesuai
- voucher WiFi tetap sesuai aturan
4. Bandingkan hasil dengan baseline awal.

Lanjut ke fase berikutnya hanya jika:

- timeout turun
- durasi checkout membaik
- integritas data tetap aman

**Fase 3**

Tujuan: kurangi burst realtime dan refetch penuh di UI.

Fokus:

- mobile POS memakai payload realtime lebih dulu
- refetch penuh hanya fallback
- tambahkan throttle nyata untuk refresh order list
- kurangi fan-out subscription berat di web

Checklist:

1. Uji order masuk cepat beruntun.
2. Uji edit order berulang.
3. Uji restore held order.
4. Pastikan order tidak hilang atau duplikat.
5. Pastikan UI tetap update tanpa terlalu sering manual refresh.
6. Bandingkan jumlah refetch penuh sebelum dan sesudah patch UI.

**Go**

Lanjut ke kandidat deploy hanya jika semua ini lolos:

- checkout lebih stabil dari baseline
- `hold / edit / bayar` tetap konsisten
- `order_no` tetap benar
- stok tetap konsisten
- voucher tetap benar
- realtime POS tidak menampilkan order ganda
- refetch penuh turun
- tidak ada error baru di flow kasir utama

**No-Go**

Jangan deploy jika salah satu ini muncul:

- timeout tetap sama atau lebih buruk
- mismatch `sales` vs `sale_items`
- selisih stok setelah edit / hold / paid
- order hilang atau ganda
- status meja salah
- voucher salah assign
- UI butuh manual refresh terlalu sering agar akurat

**Keputusan Aman**

1. Jika `Fase 2` lolos tetapi realtime masih noisy, lanjut `Fase 3` dan tunda deploy.
2. Jika `Fase 2` gagal, stop dan jangan lanjut ke patch UI.
3. Jika `Fase 2` dan `Fase 3` lolos, hasilnya layak masuk kandidat deploy.

**Catatan**

- Jalankan saat jam transaksi sepi.
- Simpan hasil baseline dan hasil sesudah patch sebagai bukti validasi.
- Jika ada mismatch data, prioritaskan investigasi integritas transaksi sebelum mengejar performa tambahan.
