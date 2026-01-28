-- Seed Products
INSERT INTO public.products (code, name, category, price, stock, image_url)
SELECT * FROM (VALUES 
  ('P001', 'Kopi Susu Gula Aren', 'Coffee', 18000, 100, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1937&auto=format&fit=crop'),
  ('P002', 'Cappuccino', 'Coffee', 22000, 100, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=1935&auto=format&fit=crop'),
  ('P003', 'Americano', 'Coffee', 15000, 100, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1974&auto=format&fit=crop'),
  ('P004', 'Nasi Goreng Spesial', 'Food', 25000, 50, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=1925&auto=format&fit=crop'),
  ('P005', 'Mie Goreng Jawa', 'Food', 22000, 50, 'https://images.unsplash.com/photo-1626804475297-411dbe6314f3?q=80&w=1974&auto=format&fit=crop'),
  ('P006', 'Croissant Butter', 'Snack', 18000, 30, 'https://images.unsplash.com/photo-1555507036-ab1f40388085?q=80&w=1926&auto=format&fit=crop'),
  ('P007', 'French Fries', 'Snack', 15000, 100, 'https://images.unsplash.com/photo-1518013431117-e98367fb9e03?q=80&w=2070&auto=format&fit=crop'),
  ('P008', 'Es Teh Manis', 'Beverage', 5000, 200, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=1964&auto=format&fit=crop')
) AS v(code, name, category, price, stock, image_url)
WHERE NOT EXISTS (SELECT 1 FROM public.products);
