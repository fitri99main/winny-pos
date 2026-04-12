-- GUNAKAN TRANSACTION UNTUK KEAMANAN
BEGIN;

-- 1. IDENTIFIKASI DUPLIKAT & PEMETAAN ID
-- Membuat tabel sementara untuk memetakan mana ID duplikat dan mana ID asli (id terkecil)
CREATE TEMP TABLE duplicate_mappings AS
SELECT 
    id as duplicate_id,
    MIN(id) OVER (PARTITION BY order_no, branch_id ORDER BY id ASC) as original_id
FROM public.sales
WHERE order_no IS NOT NULL;

-- 2. UPDATE REFERENSI WIFI VOUCHERS
-- Pindahkan voucher dari ID duplikat ke ID asli agar tidak error saat penghapusan
UPDATE public.wifi_vouchers
SET sale_id = dm.original_id
FROM duplicate_mappings dm
WHERE public.wifi_vouchers.sale_id = dm.duplicate_id
AND dm.duplicate_id != dm.original_id;

-- 3. HAPUS SALE_ITEMS DUPLIKAT
-- Hapus item menu yang nempel di pesanan duplikat agar tidak dobel menu
DELETE FROM public.sale_items
USING duplicate_mappings dm
WHERE public.sale_items.sale_id = dm.duplicate_id
AND dm.duplicate_id != dm.original_id;

-- 4. HAPUS JOURNAL_ENTRIES DUPLIKAT (AKUNTANSI)
-- Hapus catatan jurnal agar laporan penjualan tidak menggelembung
DELETE FROM public.journal_entries
USING duplicate_mappings dm
WHERE public.journal_entries.reference_id = dm.duplicate_id::text
AND public.journal_entries.source_type = 'sale'
AND dm.duplicate_id != dm.original_id;

-- 5. HAPUS PESANAN SALES DUPLIKAT
DELETE FROM public.sales
WHERE id IN (
    SELECT duplicate_id 
    FROM duplicate_mappings 
    WHERE duplicate_id != original_id
);

-- 6. TAMBAHKAN UNIQUE CONSTRAINT (PENCEGAHAN PERMANEN)
-- Mencegah duplikat masuk lagi selamanya (Database akan menolak jika ada nomor pesanan ganda)
-- Catatan: Pastikan pembersihan di atas berhasil sebelum baris ini dijalankan.
ALTER TABLE public.sales
ADD CONSTRAINT unique_order_no_per_branch UNIQUE (order_no, branch_id);

COMMIT;
