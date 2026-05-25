**Phase 2 SQL Checklist**

Dokumen ini khusus untuk patch SQL kecil sebelum menyentuh realtime UI.

Fokus utama:

- mengecilkan kerja transaksi di `upsert_sale_with_items`
- mengurangi lock contention saat `hold`, `edit`, dan `paid`
- menjaga integritas `sales`, `sale_items`, stok, dan voucher

Referensi utama:

- [00_pos_hold_checkout_stability.sql](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/00_pos_hold_checkout_stability.sql:1)
- [ROLL_OUT_CHECKLIST.md](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/ROLL_OUT_CHECKLIST.md:1)
- [CHECKOUT_FIX_ROLLOUT.md](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/CHECKOUT_FIX_ROLLOUT.md:1)

**Scope**

Area yang boleh disentuh di fase ini:

- body function `upsert_sale_with_items`
- query item di dalam function
- guard kecil untuk skip rewrite item yang tidak berubah

Area yang jangan disentuh dulu:

- subscription realtime mobile / web
- flow voucher selain jika benar-benar terdampak checkout
- trigger stok besar-besaran
- perubahan kontrak payload dari app

**Masalah Utama Saat Ini**

Jalur aktif checkout masih melakukan pola ini:

1. update / insert `sales`
2. `DELETE FROM public.sale_items WHERE sale_id = v_sale_id`
3. insert ulang semua `sale_items`
4. finalisasi `order_no`

Dampak risikonya:

- trigger stok jalan ulang untuk semua item
- kerja transaksi membesar walau perubahan item kecil
- lock window ikut meluas ke `sale_items`, `stock_movements`, `products`, dan `ingredients`

**Target Patch**

Target minimum yang aman:

1. hindari rewrite `sale_items` jika payload item identik
2. jika belum bisa diff penuh, minimal pastikan update non-item tidak menghapus lalu insert ulang item
3. pertahankan:
- `client_transaction_id`
- logic hold invoice
- logic final invoice
- return shape function

Target yang bagus jika sempat:

1. update item by diff
2. delete hanya item yang hilang
3. insert hanya item baru
4. update hanya item yang berubah

**Pre-Check**

Sebelum patch:

1. Pastikan file kanonik yang aktif tetap [00_pos_hold_checkout_stability.sql](/C:/Users/USER/Downloads/kejaan%20ayah/winny-main/00_pos_hold_checkout_stability.sql:1).
2. Pastikan tidak ada rollout SQL lain berjalan bersamaan.
3. Simpan baseline untuk 3 skenario:
- `order baru`
- `hold / edit order`
- `bayar / close order`
4. Catat:
- durasi RPC checkout
- jumlah timeout
- jumlah row `sale_items` yang berubah
- jumlah `stock_movements` yang tercipta

**Patch Sequence**

Urutan kerja yang aman:

1. Tambahkan guard paling kecil dulu.
2. Uji skenario `update sale tanpa ubah item`.
3. Jika lolos, uji `hold / edit` dengan perubahan item kecil.
4. Jika masih berat, baru pertimbangkan diff item yang lebih granular.

**Checklist Implementasi**

Saat patch SQL:

1. Jangan ubah nama function.
2. Jangan ubah parameter function.
3. Jangan ubah shape JSON hasil return.
4. Jangan hapus guard `idempotency`.
5. Jangan ubah jalur `order_no` final kecuali memang perlu.
6. Tambahkan logika untuk membedakan:
- update metadata sale saja
- update item sale
7. Jika item tidak berubah, skip:
- `DELETE FROM public.sale_items`
- insert ulang semua item

**Smoke Test**

Uji minimal ini setelah patch:

1. Buat transaksi baru lalu bayar tunai.
2. Ulangi dengan non-tunai.
3. Buat `Pending` lalu lanjutkan ke `Paid`.
4. Edit transaksi tanpa mengubah item.
5. Edit transaksi dengan menambah 1 item.
6. Edit transaksi dengan menghapus 1 item.
7. Hold order lalu restore dan bayar.

**Verifikasi Data**

Per transaksi, cek:

- hanya 1 baris `sales` yang aktif untuk transaksi tersebut
- `sale_items` sesuai item final
- `order_no` tidak bentrok
- `client_transaction_id` tidak dobel
- stok tidak berubah jika metadata-only update
- stok berubah sesuai delta jika item berubah
- voucher tetap sesuai aturan jika transaksi selesai

**Query Verifikasi**

Gunakan query baca saja berikut setelah uji:

```sql
select id, order_no, status, client_transaction_id, total_amount, updated_at
from public.sales
order by id desc
limit 20;
```

```sql
select sale_id, count(*) as item_count, sum(quantity) as total_qty
from public.sale_items
group by sale_id
order by sale_id desc
limit 20;
```

```sql
select sale_item_id, product_id, type, quantity, created_at
from public.stock_movements
order by created_at desc
limit 50;
```

```sql
select client_transaction_id, count(*)
from public.sales
where client_transaction_id is not null
group by client_transaction_id
having count(*) > 1;
```

Jika perlu cek 1 transaksi spesifik:

```sql
select s.id, s.order_no, s.status, s.total_amount, si.product_name, si.quantity, si.price
from public.sales s
left join public.sale_items si on si.sale_id = s.id
where s.id = :sale_id
order by si.id;
```

**Go**

Fase 2 dianggap lolos jika:

- timeout turun dari baseline
- edit metadata tidak memicu churn item penuh
- `sale_items` tetap konsisten
- stok tetap benar
- tidak ada duplikasi `client_transaction_id`
- tidak ada bentrok `order_no`

**No-Go**

Stop dan jangan lanjut ke fase UI jika:

- `sales` dan `sale_items` mismatch
- stok berubah padahal item tidak berubah
- hold atau paid gagal menyimpan nomor invoice
- timeout tidak membaik
- voucher atau status meja ikut rusak

**Catatan**

- Jika patch minimum sudah menurunkan timeout secara nyata, jangan paksakan diff penuh di fase yang sama.
- Prioritas fase ini adalah mengurangi risiko operasional, bukan mengejar desain function paling sempurna.
