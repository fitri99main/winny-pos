-- PELACAK TRANSAKSI
-- Kita gunakan nomor order yang Anda berikan untuk melacak di mana datanya bersembunyi.

SELECT 
    s.order_no, 
    s.date,
    s.total_amount,
    s.branch_id as "ID Cabang di Transaksi",
    b.name as "Nama Cabang (Jika Ada)",
    CASE 
        WHEN s.branch_id IS NULL THEN 'Data Tanpa Cabang (Orphan)'
        WHEN b.id IS NULL THEN 'Data Mengarah ke Cabang yang SUDAH DIHAPUS'
        ELSE 'Data Aman di Cabang: ' || b.name
    END as status_data
FROM 
    sales s
LEFT JOIN 
    branches b ON s.branch_id = b.id
WHERE 
    s.order_no LIKE '%1769679972539%'; -- Mencocokkan ID yang Anda kirim
