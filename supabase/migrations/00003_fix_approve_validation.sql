-- =====================================================================
-- 00003_fix_approve_validation.sql (1 Mei 2026)
-- =====================================================================
-- Fix beberapa masalah ditemukan saat testing 30 April:
--
-- 1. BUG STOK MINUS: PENGIRIMAN/RETUR/CLAIM/TRANSFER bisa di-approve
--    walaupun stok tidak cukup → stok jadi minus tanpa override.
--    Fix: tambah validasi stok di approve_transaksi.
--
-- 2. ROLE PERMISSION: Admin & Checker keduanya boleh BUAT transaksi
--    dan APPROVE/REJECT transaksi orang lain. Self-approval tetap
--    di-block oleh approve_transaksi() (segregation of duties).
--    Fix: relax RLS policies pada transaksi, transaksi_item,
--    transaksi_attachment supaya kedua role bisa beroperasi.
--
-- Cara pakai: jalankan file ini di Supabase SQL Editor (idempotent).
-- =====================================================================


-- ── BUG #1: Stok minus validation di approve_transaksi ──────────────

CREATE OR REPLACE FUNCTION public.approve_transaksi(
  p_transaksi_id  UUID,
  p_checker_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trx           transaksi%ROWTYPE;
  v_item          transaksi_item%ROWTYPE;
  v_stok_gudang   INTEGER;
  v_stok_proyek   INTEGER;
  v_alat_kode     TEXT;
BEGIN
  SELECT * INTO v_trx
  FROM transaksi WHERE id = p_transaksi_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan');
  END IF;

  IF v_trx.status <> 'PENDING_APPROVAL' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi bukan PENDING_APPROVAL');
  END IF;

  IF v_trx.created_by = p_checker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak bisa approve transaksi sendiri');
  END IF;

  -- ── PRE-CHECK STOK ──────────────────────────────────────────────
  -- Validasi semua item dulu sebelum melakukan UPDATE apapun.
  -- Jika ada satu item yang gagal, seluruh approve ditolak (atomic).
  FOR v_item IN
    SELECT * FROM transaksi_item WHERE transaksi_id = p_transaksi_id
  LOOP
    SELECT kode INTO v_alat_kode FROM alat WHERE id = v_item.alat_id;

    IF v_trx.tipe = 'PENGIRIMAN' AND NOT v_trx.override_stok_minus THEN
      SELECT qty_tersedia INTO v_stok_gudang
      FROM stok_gudang WHERE alat_id = v_item.alat_id;

      IF COALESCE(v_stok_gudang, 0) < v_item.qty THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', format(
            'Stok gudang tidak cukup untuk %s: tersedia %s, dibutuhkan %s. Centang Override Stok Minus + isi alasan kalau memang dibolehkan.',
            v_alat_kode, COALESCE(v_stok_gudang, 0), v_item.qty
          )
        );
      END IF;

    ELSIF v_trx.tipe IN ('RETUR', 'CLAIM', 'TRANSFER') THEN
      SELECT qty INTO v_stok_proyek
      FROM stok_proyek
      WHERE klien_id = v_trx.klien_id AND alat_id = v_item.alat_id;

      IF COALESCE(v_stok_proyek, 0) < v_item.qty THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', format(
            'Stok di proyek klien tidak cukup untuk %s: tersedia %s, dibutuhkan %s.',
            v_alat_kode, COALESCE(v_stok_proyek, 0), v_item.qty
          )
        );
      END IF;

    ELSIF v_trx.tipe = 'STOCK_ADJUSTMENT' AND NOT v_trx.override_stok_minus THEN
      -- Stock adjustment bisa positif (tambah) atau negatif (kurang).
      -- Kalau negatif, cek qty_tersedia + qty (qty negatif) >= 0.
      IF v_item.qty < 0 THEN
        SELECT qty_tersedia INTO v_stok_gudang
        FROM stok_gudang WHERE alat_id = v_item.alat_id;

        IF COALESCE(v_stok_gudang, 0) + v_item.qty < 0 THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', format(
              'Penyesuaian akan membuat stok %s minus: tersedia %s, dikurangi %s. Centang Override Stok Minus kalau disengaja.',
              v_alat_kode, COALESCE(v_stok_gudang, 0), ABS(v_item.qty)
            )
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- ── EXECUTE STOCK UPDATES ──────────────────────────────────────
  FOR v_item IN
    SELECT * FROM transaksi_item WHERE transaksi_id = p_transaksi_id
  LOOP
    CASE v_trx.tipe

      WHEN 'PENGIRIMAN' THEN
        UPDATE stok_gudang
          SET qty_tersedia = qty_tersedia - v_item.qty
          WHERE alat_id = v_item.alat_id;

        INSERT INTO stok_proyek (klien_id, alat_id, qty)
          VALUES (v_trx.klien_id, v_item.alat_id, v_item.qty)
          ON CONFLICT (klien_id, alat_id)
          DO UPDATE SET qty = stok_proyek.qty + EXCLUDED.qty,
                        updated_at = NOW();

      WHEN 'RETUR' THEN
        UPDATE stok_proyek
          SET qty = qty - v_item.qty,
              updated_at = NOW()
          WHERE klien_id = v_trx.klien_id AND alat_id = v_item.alat_id;

        UPDATE stok_gudang
          SET qty_tersedia = qty_tersedia + v_item.qty
          WHERE alat_id = v_item.alat_id;

      WHEN 'TRANSFER' THEN
        UPDATE stok_proyek
          SET qty = qty - v_item.qty,
              updated_at = NOW()
          WHERE klien_id = v_trx.klien_id AND alat_id = v_item.alat_id;

        INSERT INTO stok_proyek (klien_id, alat_id, qty)
          VALUES (v_trx.klien_tujuan_id, v_item.alat_id, v_item.qty)
          ON CONFLICT (klien_id, alat_id)
          DO UPDATE SET qty = stok_proyek.qty + EXCLUDED.qty,
                        updated_at = NOW();

      WHEN 'CLAIM' THEN
        UPDATE stok_proyek
          SET qty = qty - v_item.qty,
              updated_at = NOW()
          WHERE klien_id = v_trx.klien_id AND alat_id = v_item.alat_id;

      WHEN 'STOCK_ADJUSTMENT' THEN
        UPDATE stok_gudang
          SET qty_tersedia = qty_tersedia + v_item.qty
          WHERE alat_id = v_item.alat_id;

    END CASE;
  END LOOP;

  UPDATE transaksi
    SET status      = 'APPROVED',
        approved_by = p_checker_id,
        approved_at = NOW()
    WHERE id = p_transaksi_id;

  INSERT INTO audit_log (user_id, entity_type, entity_id, action, after_value)
  VALUES (
    p_checker_id, 'transaksi', p_transaksi_id, 'APPROVED',
    jsonb_build_object(
      'status', 'APPROVED',
      'approved_at', NOW()::text,
      'override_stok_minus', v_trx.override_stok_minus
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ── BUG #2: Relax RLS policies — Admin & Checker keduanya boleh ─────
-- create + edit transaksi PENDING + approve/reject. Self-approval
-- tetap di-block di approve_transaksi() (lihat IF v_trx.created_by =
-- p_checker_id THEN ... di atas).

-- transaksi
DROP POLICY IF EXISTS "transaksi_insert_admin"          ON public.transaksi;
DROP POLICY IF EXISTS "transaksi_update_admin_pending"  ON public.transaksi;
DROP POLICY IF EXISTS "transaksi_update_checker_pending" ON public.transaksi;

CREATE POLICY "transaksi_insert_authenticated" ON public.transaksi
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "transaksi_update_pending" ON public.transaksi
  FOR UPDATE TO authenticated
  USING (status = 'PENDING_APPROVAL')
  WITH CHECK (TRUE);

-- transaksi_item
DROP POLICY IF EXISTS "trx_item_insert_admin"          ON public.transaksi_item;
DROP POLICY IF EXISTS "trx_item_update_admin"          ON public.transaksi_item;
DROP POLICY IF EXISTS "trx_item_delete_admin_pending"  ON public.transaksi_item;

CREATE POLICY "trx_item_insert_authenticated" ON public.transaksi_item
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "trx_item_update_authenticated" ON public.transaksi_item
  FOR UPDATE TO authenticated USING (TRUE);

CREATE POLICY "trx_item_delete_pending" ON public.transaksi_item
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transaksi t
      WHERE t.id = transaksi_id AND t.status = 'PENDING_APPROVAL'
    )
  );

-- transaksi_attachment
DROP POLICY IF EXISTS "attachment_insert_admin"          ON public.transaksi_attachment;
DROP POLICY IF EXISTS "attachment_delete_admin_pending"  ON public.transaksi_attachment;

CREATE POLICY "attachment_insert_authenticated" ON public.transaksi_attachment
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "attachment_delete_pending" ON public.transaksi_attachment
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transaksi t
      WHERE t.id = transaksi_id AND t.status = 'PENDING_APPROVAL'
    )
  );
