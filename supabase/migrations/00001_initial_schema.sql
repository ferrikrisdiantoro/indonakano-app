-- ============================================================
-- SCHEMA: Sistem Manajemen Sewa Perancah - PT INDONAKANO
-- Version: 1.0.0
-- Migration: 00001_initial_schema.sql
-- PRD Reference: Section 6.2 High-Level Data Model
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'CHECKER');

CREATE TYPE kontrak_status AS ENUM ('AKTIF', 'SELESAI', 'DIBATALKAN');

CREATE TYPE tipe_transaksi AS ENUM (
  'PENGIRIMAN',
  'RETUR',
  'TRANSFER',
  'CLAIM',
  'STOCK_ADJUSTMENT'
);

CREATE TYPE transaksi_status AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'VOID'
);

CREATE TYPE tagihan_status AS ENUM ('DRAFT', 'FINAL', 'VOID');

CREATE TYPE satuan_tagihan AS ENUM ('BL', 'HR');

-- ============================================================
-- TABLE: users
-- Profile table linked to Supabase auth.users.
-- id mirrors auth.users.id — created via trigger on signup.
-- ============================================================

CREATE TABLE public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  nama        TEXT        NOT NULL,
  role        user_role   NOT NULL DEFAULT 'CHECKER',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically create a user profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, nama, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nama', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CHECKER')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── Role helper functions (used by RLS policies) ────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_checker()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'CHECKER' AND is_active = TRUE
  );
$$;

-- ============================================================
-- TABLE: alat
-- Master list of scaffolding equipment items.
-- Soft-delete only (is_active = FALSE).
-- ============================================================

CREATE TABLE public.alat (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode           TEXT        NOT NULL UNIQUE,
  nama           TEXT        NOT NULL,
  satuan_default TEXT        NOT NULL DEFAULT 'unit',
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: klien
-- Client/project records. Soft-delete only.
-- ============================================================

CREATE TABLE public.klien (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode        TEXT        NOT NULL UNIQUE,
  nama        TEXT        NOT NULL,
  pic_nama    TEXT,
  pic_kontak  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: kontrak_sewa
-- Rental contract per client. Locks prices for the contract period.
-- tgl_tutup_periode_default: 25 = INDONAKANO billing cycle,
--   31 = end of month, NULL = last calendar day of month.
-- ============================================================

CREATE TABLE public.kontrak_sewa (
  id                          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  klien_id                    UUID           NOT NULL REFERENCES public.klien(id),
  nomor_kontrak               TEXT           NOT NULL,
  tanggal_mulai               DATE           NOT NULL,
  tanggal_selesai             DATE,
  tgl_tutup_periode_default   SMALLINT       CHECK (tgl_tutup_periode_default BETWEEN 1 AND 31),
  apply_ppn                   BOOLEAN        NOT NULL DEFAULT TRUE,
  status                      kontrak_status NOT NULL DEFAULT 'AKTIF',
  created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by                  UUID           NOT NULL REFERENCES public.users(id),
  UNIQUE (klien_id, nomor_kontrak)
);

-- ============================================================
-- TABLE: harga_sewa
-- Rental price per item per contract.
-- locked = TRUE once the first transaction using this contract is APPROVED.
-- Locked prices cannot be changed (enforced by RLS + app logic).
-- ============================================================

CREATE TABLE public.harga_sewa (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  kontrak_id     UUID        NOT NULL REFERENCES public.kontrak_sewa(id) ON DELETE CASCADE,
  alat_id        UUID        NOT NULL REFERENCES public.alat(id),
  harga_bulanan  NUMERIC(15,2) NOT NULL CHECK (harga_bulanan >= 0),
  locked         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kontrak_id, alat_id)
);

-- ============================================================
-- TABLE: stok_gudang
-- Current warehouse stock per alat. One row per alat.
-- Updated atomically when transactions are APPROVED.
-- ============================================================

CREATE TABLE public.stok_gudang (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  alat_id       UUID        NOT NULL UNIQUE REFERENCES public.alat(id),
  qty_tersedia  INTEGER     NOT NULL DEFAULT 0 CHECK (qty_tersedia >= -99999),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create stok_gudang row whenever a new alat is added
-- SECURITY DEFINER = runs as table owner, bypasses RLS policy on stok_gudang
CREATE OR REPLACE FUNCTION public.init_stok_gudang_on_alat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.stok_gudang (alat_id, qty_tersedia)
  VALUES (NEW.id, 0)
  ON CONFLICT (alat_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_stok_gudang
  AFTER INSERT ON public.alat
  FOR EACH ROW EXECUTE FUNCTION public.init_stok_gudang_on_alat();

-- ============================================================
-- TABLE: stok_proyek
-- Current stock per alat per client/project.
-- One row per (klien_id, alat_id) pair.
-- ============================================================

CREATE TABLE public.stok_proyek (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  klien_id   UUID        NOT NULL REFERENCES public.klien(id),
  alat_id    UUID        NOT NULL REFERENCES public.alat(id),
  qty        INTEGER     NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (klien_id, alat_id)
);

-- ============================================================
-- TABLE: transaksi
-- Header for all stock movements. Stock is NOT updated until
-- status transitions from PENDING_APPROVAL → APPROVED.
-- PRD Section 3.4: Approval Workflow.
-- ============================================================

CREATE TABLE public.transaksi (
  id                   UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipe                 tipe_transaksi    NOT NULL,
  tanggal              DATE              NOT NULL,
  klien_id             UUID              REFERENCES public.klien(id),
  klien_tujuan_id      UUID              REFERENCES public.klien(id),
  kontrak_id           UUID              REFERENCES public.kontrak_sewa(id),
  no_sj                TEXT,
  no_sj_operan         TEXT,
  catatan              TEXT,
  status               transaksi_status  NOT NULL DEFAULT 'PENDING_APPROVAL',
  override_stok_minus  BOOLEAN           NOT NULL DEFAULT FALSE,
  override_alasan      TEXT,
  -- Approval
  approved_by          UUID              REFERENCES public.users(id),
  approved_at          TIMESTAMPTZ,
  -- Rejection
  rejected_by          UUID              REFERENCES public.users(id),
  rejected_at          TIMESTAMPTZ,
  rejected_reason      TEXT,
  -- Void
  void_by              UUID              REFERENCES public.users(id),
  void_at              TIMESTAMPTZ,
  void_reason          TEXT,
  -- Audit
  created_by           UUID              NOT NULL REFERENCES public.users(id),
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  -- Constraint: klien required for all except STOCK_ADJUSTMENT
  CONSTRAINT chk_klien_required CHECK (
    tipe = 'STOCK_ADJUSTMENT' OR klien_id IS NOT NULL
  ),
  -- Constraint: tujuan required for TRANSFER
  CONSTRAINT chk_transfer_tujuan CHECK (
    tipe != 'TRANSFER' OR klien_tujuan_id IS NOT NULL
  ),
  -- Constraint: cannot transfer to same client
  CONSTRAINT chk_transfer_different_klien CHECK (
    tipe != 'TRANSFER' OR klien_id != klien_tujuan_id
  )
);

-- ============================================================
-- TABLE: transaksi_item
-- Line items for each transaction (one row per alat).
-- ============================================================

CREATE TABLE public.transaksi_item (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaksi_id  UUID        NOT NULL REFERENCES public.transaksi(id) ON DELETE CASCADE,
  alat_id       UUID        NOT NULL REFERENCES public.alat(id),
  qty           INTEGER     NOT NULL CHECK (qty != 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: transaksi_attachment
-- Uploaded SJ/BA documents linked to transactions.
-- ============================================================

CREATE TABLE public.transaksi_attachment (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaksi_id  UUID        NOT NULL REFERENCES public.transaksi(id) ON DELETE CASCADE,
  file_url      TEXT        NOT NULL,
  file_name     TEXT        NOT NULL,
  file_size     INTEGER     NOT NULL CHECK (file_size > 0),
  uploaded_by   UUID        NOT NULL REFERENCES public.users(id),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: tagihan
-- Invoice header. DRAFT → FINAL → VOID lifecycle.
-- Prices snapshot from kontrak_sewa at generation time.
-- ============================================================

CREATE TABLE public.tagihan (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  nomor            TEXT           NOT NULL UNIQUE,
  kontrak_id       UUID           NOT NULL REFERENCES public.kontrak_sewa(id),
  klien_id         UUID           NOT NULL REFERENCES public.klien(id),
  periode_mulai    DATE           NOT NULL,
  periode_akhir    DATE           NOT NULL,
  override_periode BOOLEAN        NOT NULL DEFAULT FALSE,
  override_alasan  TEXT,
  subtotal         NUMERIC(15,2)  NOT NULL DEFAULT 0,
  ppn_persen       NUMERIC(5,2)   NOT NULL DEFAULT 11.00,
  ppn_amount       NUMERIC(15,2)  NOT NULL DEFAULT 0,
  total            NUMERIC(15,2)  NOT NULL DEFAULT 0,
  status           tagihan_status NOT NULL DEFAULT 'DRAFT',
  void_reason      TEXT,
  void_by          UUID           REFERENCES public.users(id),
  void_at          TIMESTAMPTZ,
  pdf_url          TEXT,
  generated_by     UUID           NOT NULL REFERENCES public.users(id),
  generated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  finalized_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_periode CHECK (periode_akhir >= periode_mulai)
);

-- ============================================================
-- TABLE: tagihan_item
-- Invoice line items. Values are snapshots — immutable after
-- tagihan is FINAL. harga_per_satuan_snapshot stored at 4dp
-- to preserve HR precision (harga_bulanan / 30).
-- PRD Section 3.6: rounding rules applied before insert.
-- ============================================================

CREATE TABLE public.tagihan_item (
  id                        UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  tagihan_id                UUID           NOT NULL REFERENCES public.tagihan(id) ON DELETE CASCADE,
  alat_id                   UUID           NOT NULL REFERENCES public.alat(id),
  alat_nama                 TEXT           NOT NULL,
  periode_teks              TEXT           NOT NULL,
  satuan                    satuan_tagihan NOT NULL,
  qty                       INTEGER        NOT NULL CHECK (qty > 0),
  lama                      NUMERIC(8,2)   NOT NULL CHECK (lama > 0),
  harga_per_satuan_snapshot NUMERIC(15,4)  NOT NULL,
  total                     NUMERIC(15,2)  NOT NULL,
  ordering                  INTEGER        NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: app_setting
-- Key-value store for application configuration.
-- ============================================================

CREATE TABLE public.app_setting (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES public.users(id)
);

INSERT INTO public.app_setting (key, value) VALUES
  ('format_nomor_tagihan', '{PREFIX}/{NNN}/{ROMAN_MONTH}/{YEAR}'),
  ('prefix_nomor_tagihan', 'PPA'),
  ('counter_tagihan',      '0'),
  ('ppn_default_persen',   '11');

-- ============================================================
-- TABLE: audit_log
-- Append-only log of all state-changing operations.
-- UPDATE and DELETE are blocked via rules.
-- ============================================================

CREATE TABLE public.audit_log (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        REFERENCES public.users(id),
  entity_type  TEXT        NOT NULL,
  entity_id    UUID,
  action       TEXT        NOT NULL,
  before_value JSONB,
  after_value  JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE RULE no_update_audit_log AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_log AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_alat_is_active           ON public.alat(is_active);
CREATE INDEX idx_klien_is_active          ON public.klien(is_active);
CREATE INDEX idx_kontrak_klien            ON public.kontrak_sewa(klien_id);
CREATE INDEX idx_kontrak_status           ON public.kontrak_sewa(status);
CREATE INDEX idx_kontrak_dates            ON public.kontrak_sewa(tanggal_mulai, tanggal_selesai);
CREATE INDEX idx_harga_kontrak            ON public.harga_sewa(kontrak_id);
CREATE INDEX idx_harga_alat               ON public.harga_sewa(alat_id);
CREATE INDEX idx_stok_proyek_klien        ON public.stok_proyek(klien_id);
CREATE INDEX idx_stok_proyek_alat         ON public.stok_proyek(alat_id);
CREATE INDEX idx_transaksi_klien          ON public.transaksi(klien_id);
CREATE INDEX idx_transaksi_status         ON public.transaksi(status);
CREATE INDEX idx_transaksi_tanggal        ON public.transaksi(tanggal);
CREATE INDEX idx_transaksi_tipe           ON public.transaksi(tipe);
CREATE INDEX idx_transaksi_created_by     ON public.transaksi(created_by);
CREATE INDEX idx_trx_item_transaksi       ON public.transaksi_item(transaksi_id);
CREATE INDEX idx_trx_item_alat            ON public.transaksi_item(alat_id);
CREATE INDEX idx_tagihan_klien            ON public.tagihan(klien_id);
CREATE INDEX idx_tagihan_kontrak          ON public.tagihan(kontrak_id);
CREATE INDEX idx_tagihan_status           ON public.tagihan(status);
CREATE INDEX idx_tagihan_periode          ON public.tagihan(periode_mulai, periode_akhir);
CREATE INDEX idx_tagihan_item_tagihan     ON public.tagihan_item(tagihan_id);
CREATE INDEX idx_tagihan_item_alat        ON public.tagihan_item(alat_id);
CREATE INDEX idx_audit_entity             ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user               ON public.audit_log(user_id);
CREATE INDEX idx_audit_created            ON public.audit_log(created_at DESC);

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_alat_updated_at
  BEFORE UPDATE ON public.alat
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_klien_updated_at
  BEFORE UPDATE ON public.klien
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_harga_sewa_updated_at
  BEFORE UPDATE ON public.harga_sewa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_stok_gudang_updated_at
  BEFORE UPDATE ON public.stok_gudang
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_stok_proyek_updated_at
  BEFORE UPDATE ON public.stok_proyek
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transaksi_updated_at
  BEFORE UPDATE ON public.transaksi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tagihan_updated_at
  BEFORE UPDATE ON public.tagihan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lock harga_sewa rows when the first transaction for a contract is approved
CREATE OR REPLACE FUNCTION public.lock_harga_sewa_on_approve()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'APPROVED'
     AND OLD.status = 'PENDING_APPROVAL'
     AND NEW.kontrak_id IS NOT NULL
  THEN
    UPDATE public.harga_sewa
    SET locked = TRUE
    WHERE kontrak_id = NEW.kontrak_id AND locked = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_harga_sewa
  AFTER UPDATE ON public.transaksi
  FOR EACH ROW EXECUTE FUNCTION public.lock_harga_sewa_on_approve();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alat                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klien                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kontrak_sewa         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harga_sewa           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stok_gudang          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stok_proyek          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_item       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagihan              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagihan_item         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_setting          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

-- ── users ────────────────────────────────────────────────────

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "users_insert_admin" ON public.users
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE TO authenticated USING (public.is_admin());

-- Users may update their own nama (limited fields enforced at app level)
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- ── alat ─────────────────────────────────────────────────────

CREATE POLICY "alat_select" ON public.alat
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "alat_insert_admin" ON public.alat
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "alat_update_admin" ON public.alat
  FOR UPDATE TO authenticated USING (public.is_admin());

-- ── klien ────────────────────────────────────────────────────

CREATE POLICY "klien_select" ON public.klien
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "klien_insert_admin" ON public.klien
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "klien_update_admin" ON public.klien
  FOR UPDATE TO authenticated USING (public.is_admin());

-- ── kontrak_sewa ─────────────────────────────────────────────

CREATE POLICY "kontrak_select" ON public.kontrak_sewa
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "kontrak_insert_admin" ON public.kontrak_sewa
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "kontrak_update_admin" ON public.kontrak_sewa
  FOR UPDATE TO authenticated USING (public.is_admin());

-- ── harga_sewa ───────────────────────────────────────────────

CREATE POLICY "harga_select" ON public.harga_sewa
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "harga_insert_admin" ON public.harga_sewa
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Price update only allowed when NOT locked
CREATE POLICY "harga_update_admin_unlocked" ON public.harga_sewa
  FOR UPDATE TO authenticated
  USING (public.is_admin() AND locked = FALSE)
  WITH CHECK (public.is_admin() AND locked = FALSE);

-- ── stok_gudang ──────────────────────────────────────────────

CREATE POLICY "stok_gudang_select" ON public.stok_gudang
  FOR SELECT TO authenticated USING (TRUE);

-- Admin: insert (untuk migrasi data) & update
CREATE POLICY "stok_gudang_insert_admin" ON public.stok_gudang
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "stok_gudang_update_admin" ON public.stok_gudang
  FOR UPDATE TO authenticated USING (public.is_admin());

-- ── stok_proyek ──────────────────────────────────────────────

CREATE POLICY "stok_proyek_select" ON public.stok_proyek
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "stok_proyek_update_admin" ON public.stok_proyek
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "stok_proyek_insert_admin" ON public.stok_proyek
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ── transaksi ────────────────────────────────────────────────

CREATE POLICY "transaksi_select" ON public.transaksi
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "transaksi_insert_admin" ON public.transaksi
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Admin: edit only PENDING_APPROVAL transactions
CREATE POLICY "transaksi_update_admin_pending" ON public.transaksi
  FOR UPDATE TO authenticated
  USING (public.is_admin() AND status = 'PENDING_APPROVAL');

-- Checker: approve/reject PENDING_APPROVAL (business rule: no self-approval enforced in stored function)
CREATE POLICY "transaksi_update_checker_pending" ON public.transaksi
  FOR UPDATE TO authenticated
  USING (public.is_checker() AND status = 'PENDING_APPROVAL')
  WITH CHECK (public.is_checker());

-- ── transaksi_item ───────────────────────────────────────────

CREATE POLICY "trx_item_select" ON public.transaksi_item
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "trx_item_insert_admin" ON public.transaksi_item
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "trx_item_update_admin" ON public.transaksi_item
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "trx_item_delete_admin_pending" ON public.transaksi_item
  FOR DELETE TO authenticated
  USING (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.transaksi t
      WHERE t.id = transaksi_id AND t.status = 'PENDING_APPROVAL'
    )
  );

-- ── transaksi_attachment ─────────────────────────────────────

CREATE POLICY "attachment_select" ON public.transaksi_attachment
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "attachment_insert_admin" ON public.transaksi_attachment
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "attachment_delete_admin_pending" ON public.transaksi_attachment
  FOR DELETE TO authenticated
  USING (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.transaksi t
      WHERE t.id = transaksi_id AND t.status = 'PENDING_APPROVAL'
    )
  );

-- ── tagihan ──────────────────────────────────────────────────

CREATE POLICY "tagihan_select" ON public.tagihan
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "tagihan_insert_admin" ON public.tagihan
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "tagihan_update_admin" ON public.tagihan
  FOR UPDATE TO authenticated
  USING (public.is_admin() AND status IN ('DRAFT', 'FINAL'));

-- ── tagihan_item ─────────────────────────────────────────────

CREATE POLICY "tagihan_item_select" ON public.tagihan_item
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "tagihan_item_insert_admin" ON public.tagihan_item
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "tagihan_item_delete_admin_draft" ON public.tagihan_item
  FOR DELETE TO authenticated
  USING (
    public.is_admin() AND
    EXISTS (
      SELECT 1 FROM public.tagihan tg
      WHERE tg.id = tagihan_id AND tg.status = 'DRAFT'
    )
  );

-- ── app_setting ──────────────────────────────────────────────

CREATE POLICY "app_setting_select" ON public.app_setting
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "app_setting_all_admin" ON public.app_setting
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── audit_log ────────────────────────────────────────────────

CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ============================================================
-- STORED FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS to atomically update stock when approving.
-- ============================================================

-- ── approve_transaksi ────────────────────────────────────────
-- Atomically: validates → updates stock per transaction type
--             → sets status = APPROVED → writes audit log.
-- Called from the Next.js server action via RPC.

CREATE OR REPLACE FUNCTION public.approve_transaksi(
  p_transaksi_id  UUID,
  p_checker_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trx   transaksi%ROWTYPE;
  v_item  transaksi_item%ROWTYPE;
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
        -- Reduces project stock; does NOT return to warehouse
        UPDATE stok_proyek
          SET qty = qty - v_item.qty,
              updated_at = NOW()
          WHERE klien_id = v_trx.klien_id AND alat_id = v_item.alat_id;

      WHEN 'STOCK_ADJUSTMENT' THEN
        -- qty can be negative (reduction) or positive (addition)
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
    jsonb_build_object('status', 'APPROVED', 'approved_at', NOW()::text)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── reject_transaksi ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_transaksi(
  p_transaksi_id  UUID,
  p_checker_id    UUID,
  p_reason        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trx transaksi%ROWTYPE;
BEGIN
  SELECT * INTO v_trx
  FROM transaksi WHERE id = p_transaksi_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan');
  END IF;

  IF v_trx.status <> 'PENDING_APPROVAL' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi bukan PENDING_APPROVAL');
  END IF;

  IF TRIM(COALESCE(p_reason, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan penolakan wajib diisi');
  END IF;

  UPDATE transaksi
    SET status          = 'REJECTED',
        rejected_by     = p_checker_id,
        rejected_at     = NOW(),
        rejected_reason = p_reason
    WHERE id = p_transaksi_id;

  INSERT INTO audit_log (user_id, entity_type, entity_id, action, after_value)
  VALUES (
    p_checker_id, 'transaksi', p_transaksi_id, 'REJECTED',
    jsonb_build_object('status', 'REJECTED', 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── void_tagihan ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.void_tagihan(
  p_tagihan_id  UUID,
  p_user_id     UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tagihan tagihan%ROWTYPE;
BEGIN
  SELECT * INTO v_tagihan
  FROM tagihan WHERE id = p_tagihan_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tagihan tidak ditemukan');
  END IF;

  IF v_tagihan.status = 'VOID' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tagihan sudah di-void');
  END IF;

  IF TRIM(COALESCE(p_reason, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan void wajib diisi');
  END IF;

  UPDATE tagihan
    SET status      = 'VOID',
        void_reason = p_reason,
        void_by     = p_user_id,
        void_at     = NOW()
    WHERE id = p_tagihan_id;

  INSERT INTO audit_log (user_id, entity_type, entity_id, action, after_value)
  VALUES (
    p_user_id, 'tagihan', p_tagihan_id, 'VOID',
    jsonb_build_object('status', 'VOID', 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── get_next_nomor_tagihan ───────────────────────────────────
-- Atomically increments counter and returns formatted invoice number.
-- Supports tokens: {PREFIX} {NNN} {ROMAN_MONTH} {YEAR}

CREATE OR REPLACE FUNCTION public.get_next_nomor_tagihan(
  p_bulan  INTEGER,
  p_tahun  INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_counter   INTEGER;
  v_prefix    TEXT;
  v_format    TEXT;
  v_roman     TEXT;
  v_result    TEXT;
  v_roman_arr TEXT[] := ARRAY[
    'I','II','III','IV','V','VI',
    'VII','VIII','IX','X','XI','XII'
  ];
BEGIN
  SELECT value INTO v_prefix FROM app_setting WHERE key = 'prefix_nomor_tagihan';
  SELECT value INTO v_format FROM app_setting WHERE key = 'format_nomor_tagihan';

  UPDATE app_setting
    SET value = (value::INTEGER + 1)::TEXT, updated_at = NOW()
    WHERE key = 'counter_tagihan'
    RETURNING value::INTEGER INTO v_counter;

  v_roman  := v_roman_arr[p_bulan];
  v_result := v_format;
  v_result := REPLACE(v_result, '{PREFIX}',       v_prefix);
  v_result := REPLACE(v_result, '{NNN}',          LPAD(v_counter::TEXT, 3, '0'));
  v_result := REPLACE(v_result, '{ROMAN_MONTH}',  v_roman);
  v_result := REPLACE(v_result, '{YEAR}',         p_tahun::TEXT);

  RETURN v_result;
END;
$$;

-- ── get_active_kontrak ───────────────────────────────────────
-- Returns the AKTIF contract for a client on a given date.

CREATE OR REPLACE FUNCTION public.get_active_kontrak(
  p_klien_id  UUID,
  p_tanggal   DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id
  FROM kontrak_sewa
  WHERE klien_id = p_klien_id
    AND status = 'AKTIF'
    AND tanggal_mulai <= p_tanggal
    AND (tanggal_selesai IS NULL OR tanggal_selesai >= p_tanggal)
  ORDER BY tanggal_mulai DESC
  LIMIT 1;
$$;
