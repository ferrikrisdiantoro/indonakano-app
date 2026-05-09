-- =====================================================================
-- 00005_fix_delete_rls_policies.sql (9 Mei 2026)
-- =====================================================================
-- Bug: hapus harga sewa di kontrak detail "berhasil" (toast hijau muncul)
-- tapi row tidak hilang dari tabel.
--
-- Akar masalah: RLS aktif tapi tabel `harga_sewa` TIDAK punya policy
-- untuk DELETE. Postgres dengan RLS enabled secara default MENOLAK
-- semua operasi yang tidak dideklarasikan eksplisit. DELETE silently
-- direject (0 rows affected, no error). Aplikasi mengira sukses.
--
-- Tabel lain yang juga miss DELETE policy:
--   - transaksi (rollback path di createTransaksiAction)
--   - tagihan (rollback path di generateTagihanAction)
--
-- Migration ini:
--   1. Tambah DELETE policy yang missing
--   2. Tetap restrictive (mengikuti pola tabel lain):
--      - harga_sewa: admin only + tidak boleh locked
--      - transaksi: hanya status PENDING_APPROVAL
--      - tagihan: admin only + hanya status DRAFT
--
-- Cara pakai: jalankan di Supabase SQL Editor (idempotent).
-- =====================================================================


-- ── DELETE policy untuk harga_sewa ──────────────────────────────────
-- Konsisten dengan harga_update_admin_unlocked: hanya admin, hanya
-- yang belum locked. Locked = TRUE artinya kontrak sudah dipakai
-- transaksi APPROVED → harga sudah immutable demi audit trail.

DROP POLICY IF EXISTS "harga_delete_admin_unlocked" ON public.harga_sewa;

CREATE POLICY "harga_delete_admin_unlocked" ON public.harga_sewa
  FOR DELETE TO authenticated
  USING (public.is_admin() AND locked = FALSE);


-- ── DELETE policy untuk transaksi ──────────────────────────────────
-- Untuk rollback path: kalau insert transaksi sukses tapi insert
-- transaksi_item gagal, action akan delete header transaksi-nya.
-- Tanpa policy ini, header orphan tinggal di DB.
--
-- Status PENDING_APPROVAL only — APPROVED/REJECTED/VOID immutable.
-- Tidak require admin karena kedua role boleh buat (pasangan dengan
-- transaksi_insert_authenticated yang sudah relax di 00003).

DROP POLICY IF EXISTS "transaksi_delete_pending" ON public.transaksi;

CREATE POLICY "transaksi_delete_pending" ON public.transaksi
  FOR DELETE TO authenticated
  USING (status = 'PENDING_APPROVAL');


-- ── DELETE policy untuk tagihan ────────────────────────────────────
-- Untuk rollback path generateTagihanAction.
-- Hanya DRAFT yang boleh dihapus; FINAL/VOID tetap untuk audit.

DROP POLICY IF EXISTS "tagihan_delete_admin_draft" ON public.tagihan;

CREATE POLICY "tagihan_delete_admin_draft" ON public.tagihan
  FOR DELETE TO authenticated
  USING (public.is_admin() AND status = 'DRAFT');


-- ── Verifikasi ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_harga    INTEGER;
  v_trx      INTEGER;
  v_tag      INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_harga FROM pg_policy
   WHERE polrelid = 'public.harga_sewa'::regclass AND polcmd = 'd';
  SELECT COUNT(*) INTO v_trx   FROM pg_policy
   WHERE polrelid = 'public.transaksi'::regclass AND polcmd = 'd';
  SELECT COUNT(*) INTO v_tag   FROM pg_policy
   WHERE polrelid = 'public.tagihan'::regclass AND polcmd = 'd';

  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '  DELETE RLS POLICIES — VERIFIKASI';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '  harga_sewa DELETE policies : % (target: ≥1)', v_harga;
  RAISE NOTICE '  transaksi  DELETE policies : % (target: ≥1)', v_trx;
  RAISE NOTICE '  tagihan    DELETE policies : % (target: ≥1)', v_tag;
  RAISE NOTICE '═══════════════════════════════════════════';

  IF v_harga = 0 OR v_trx = 0 OR v_tag = 0 THEN
    RAISE EXCEPTION 'Salah satu policy DELETE belum terbuat!';
  END IF;

  RAISE NOTICE '✅ Semua DELETE policy aktif';
END;
$$;
