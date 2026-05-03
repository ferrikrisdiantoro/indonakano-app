-- =====================================================================
-- 00004_audit_override_alasan.sql (2 Mei 2026)
-- =====================================================================
-- Fix: audit log saat APPROVE belum mencatat override_alasan.
-- Saat tester filter audit log untuk lihat alasan override, kosong.
--
-- Hanya update fungsi approve_transaksi (penambahan override_alasan
-- ke after_value). Logic stok validation TIDAK berubah dari 00003.
--
-- Cara pakai: jalankan di Supabase SQL Editor (idempotent).
-- =====================================================================

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

  -- ── AUDIT LOG (NEW: include override_alasan) ───────────────────
  INSERT INTO audit_log (user_id, entity_type, entity_id, action, after_value)
  VALUES (
    p_checker_id, 'transaksi', p_transaksi_id, 'APPROVED',
    jsonb_strip_nulls(jsonb_build_object(
      'status', 'APPROVED',
      'approved_at', NOW()::text,
      'override_stok_minus', v_trx.override_stok_minus,
      'override_alasan',
        CASE WHEN v_trx.override_stok_minus
             THEN NULLIF(TRIM(COALESCE(v_trx.override_alasan, '')), '')
             ELSE NULL END
    ))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
