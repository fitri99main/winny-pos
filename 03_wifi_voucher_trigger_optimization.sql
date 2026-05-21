-- =============================================================
-- Tahap 3: Optimasi trigger voucher WiFi
-- Jalankan paling akhir setelah checkout / hold / payment stabil.
-- =============================================================

CREATE OR REPLACE FUNCTION assign_wifi_voucher_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_voucher_count INTEGER := 0;
  v_min_spend NUMERIC;
  v_multiplier NUMERIC;
  v_enable_wifi BOOLEAN;
  v_total NUMERIC;
  v_existing_count INTEGER := 0;
  v_needed_count INTEGER := 0;
BEGIN
  SELECT
    enable_wifi_vouchers,
    COALESCE(wifi_voucher_min_amount, 15000),
    COALESCE(wifi_voucher_multiplier, 15000)
  INTO
    v_enable_wifi, v_min_spend, v_multiplier
  FROM public.store_settings
  WHERE id = 1;

  v_total := COALESCE(NEW.total_amount, 0);

  IF v_enable_wifi IS TRUE AND v_total >= v_min_spend THEN
    IF v_multiplier > 0 THEN
      v_voucher_count := FLOOR(v_total / v_multiplier);
    ELSE
      v_voucher_count := 1;
    END IF;

    IF v_voucher_count < 1 THEN v_voucher_count := 1; END IF;
    v_voucher_count := LEAST(v_voucher_count, 10);

    IF (TG_OP = 'INSERT' AND LOWER(NEW.status) IN ('paid', 'selesai', 'completed', 'done')) OR
       (TG_OP = 'UPDATE' AND LOWER(NEW.status) IN ('paid', 'selesai', 'completed', 'done') AND
        (OLD.status IS NULL OR LOWER(OLD.status) NOT IN ('paid', 'selesai', 'completed', 'done'))) THEN

      SELECT COUNT(*)
      INTO v_existing_count
      FROM public.wifi_vouchers
      WHERE sale_id = NEW.id;

      v_needed_count := GREATEST(v_voucher_count - v_existing_count, 0);

      IF v_needed_count > 0 THEN
        WITH candidate_vouchers AS (
          SELECT id
          FROM public.wifi_vouchers
          WHERE is_used = FALSE
          ORDER BY created_at ASC
          LIMIT v_needed_count
          FOR UPDATE SKIP LOCKED
        )
        UPDATE public.wifi_vouchers
        SET is_used = TRUE,
            used_at = NOW(),
            sale_id = NEW.id
        WHERE id IN (SELECT id FROM candidate_vouchers);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_wifi_voucher ON public.sales;
CREATE TRIGGER trg_assign_wifi_voucher
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION assign_wifi_voucher_on_sale();

DROP TRIGGER IF EXISTS trg_assign_wifi_voucher_insert ON public.sales;
CREATE TRIGGER trg_assign_wifi_voucher_insert
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION assign_wifi_voucher_on_sale();
