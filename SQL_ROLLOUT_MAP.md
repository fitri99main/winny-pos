**Active SQL Rollout**

Gunakan file berikut untuk deploy aktif:

1. [00_pos_hold_checkout_stability.sql](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/00_pos_hold_checkout_stability.sql:1)
2. [03_wifi_voucher_trigger_optimization.sql](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/03_wifi_voucher_trigger_optimization.sql:1)

**When To Use**

- `00_pos_hold_checkout_stability.sql`: rollout utama untuk stabilitas `hold`, `checkout`, idempotency, dan penomoran invoice/HOLD.
- `03_wifi_voucher_trigger_optimization.sql`: rollout lanjutan setelah alur transaksi utama stabil.

**Legacy / Archive**

File berikut disimpan sebagai arsip historis dan tidak disarankan untuk rollout baru:

- `fix_checkout_idempotency_v1.sql`
- `fix_database_busy_v8.sql`
- `fix_invoice_prefix.sql`
- `upsert_atomic_order.sql`
- `upsert_atomic_order_v6.sql` sampai `upsert_atomic_order_v14.sql`
- `setup_wifi_trigger.sql`

**Reason**

- Beberapa file lama hanya memecahkan sebagian masalah.
- Sebagian file lama bisa menimpa function aktif dengan versi yang belum punya perbaikan terbaru.
- Rollout aktif sekarang sudah menggabungkan patch yang lolos uji `hold`, `hold -> paid`, dan WiFi voucher.
