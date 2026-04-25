// Auto-generated types matching supabase/migrations/00001_initial_schema.sql
// Update this file if the schema changes.

export type UserRole = "ADMIN" | "CHECKER";
export type KontrakStatus = "AKTIF" | "SELESAI" | "DIBATALKAN";
export type TipeTransaksi =
  | "PENGIRIMAN"
  | "RETUR"
  | "TRANSFER"
  | "CLAIM"
  | "STOCK_ADJUSTMENT";
export type TransaksiStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "VOID";
export type TagihanStatus = "DRAFT" | "FINAL" | "VOID";
export type SatuanTagihan = "BL" | "HR";

// ── Row types ────────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  nama: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AlatRow = {
  id: string;
  kode: string;
  nama: string;
  satuan_default: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type KlienRow = {
  id: string;
  kode: string;
  nama: string;
  pic_nama: string | null;
  pic_kontak: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type KontrakSewaRow = {
  id: string;
  klien_id: string;
  nomor_kontrak: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  tgl_tutup_periode_default: number | null;
  apply_ppn: boolean;
  status: KontrakStatus;
  created_at: string;
  created_by: string;
};

export type HargaSewaRow = {
  id: string;
  kontrak_id: string;
  alat_id: string;
  harga_bulanan: number;
  locked: boolean;
  created_at: string;
  updated_at: string;
};

export type StokGudangRow = {
  id: string;
  alat_id: string;
  qty_tersedia: number;
  updated_at: string;
};

export type StokProyekRow = {
  id: string;
  klien_id: string;
  alat_id: string;
  qty: number;
  updated_at: string;
};

export type TransaksiRow = {
  id: string;
  tipe: TipeTransaksi;
  tanggal: string;
  klien_id: string | null;
  klien_tujuan_id: string | null;
  kontrak_id: string | null;
  no_sj: string | null;
  no_sj_operan: string | null;
  catatan: string | null;
  status: TransaksiStatus;
  override_stok_minus: boolean;
  override_alasan: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  void_by: string | null;
  void_at: string | null;
  void_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TransaksiItemRow = {
  id: string;
  transaksi_id: string;
  alat_id: string;
  qty: number;
  created_at: string;
};

export type TransaksiAttachmentRow = {
  id: string;
  transaksi_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
};

export type TagihanRow = {
  id: string;
  nomor: string;
  kontrak_id: string;
  klien_id: string;
  periode_mulai: string;
  periode_akhir: string;
  override_periode: boolean;
  override_alasan: string | null;
  subtotal: number;
  ppn_persen: number;
  ppn_amount: number;
  total: number;
  status: TagihanStatus;
  void_reason: string | null;
  void_by: string | null;
  void_at: string | null;
  pdf_url: string | null;
  generated_by: string;
  generated_at: string;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TagihanItemRow = {
  id: string;
  tagihan_id: string;
  alat_id: string;
  alat_nama: string;
  periode_teks: string;
  satuan: SatuanTagihan;
  qty: number;
  lama: number;
  harga_per_satuan_snapshot: number;
  total: number;
  ordering: number;
  created_at: string;
};

export type AppSettingRow = {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
};

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

// ── Supabase Database type for typed client ──────────────────

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserRow, "id">>;
        Relationships: [];
      };
      alat: {
        Row: AlatRow;
        Insert: Omit<AlatRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<AlatRow, "id" | "created_at">>;
        Relationships: [];
      };
      klien: {
        Row: KlienRow;
        Insert: Omit<KlienRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<KlienRow, "id" | "created_at">>;
        Relationships: [];
      };
      kontrak_sewa: {
        Row: KontrakSewaRow;
        Insert: Omit<KontrakSewaRow, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<KontrakSewaRow, "id" | "created_at">>;
        Relationships: [];
      };
      harga_sewa: {
        Row: HargaSewaRow;
        Insert: Omit<HargaSewaRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<HargaSewaRow, "id" | "created_at">>;
        Relationships: [];
      };
      stok_gudang: {
        Row: StokGudangRow;
        Insert: Omit<StokGudangRow, "id" | "updated_at"> & { id?: string };
        Update: Partial<Omit<StokGudangRow, "id">>;
        Relationships: [];
      };
      stok_proyek: {
        Row: StokProyekRow;
        Insert: Omit<StokProyekRow, "id" | "updated_at"> & { id?: string };
        Update: Partial<Omit<StokProyekRow, "id">>;
        Relationships: [];
      };
      transaksi: {
        Row: TransaksiRow;
        Insert: Omit<
          TransaksiRow,
          | "id" | "created_at" | "updated_at"
          | "status" | "override_stok_minus"
          | "approved_by" | "approved_at"
          | "rejected_by" | "rejected_at" | "rejected_reason"
          | "void_by" | "void_at" | "void_reason"
        > & {
          id?: string;
          status?: TransaksiStatus;
          override_stok_minus?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejected_reason?: string | null;
          void_by?: string | null;
          void_at?: string | null;
          void_reason?: string | null;
        };
        Update: Partial<Omit<TransaksiRow, "id" | "created_at">>;
        Relationships: [];
      };
      transaksi_item: {
        Row: TransaksiItemRow;
        Insert: Omit<TransaksiItemRow, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<TransaksiItemRow, "id" | "created_at">>;
        Relationships: [];
      };
      transaksi_attachment: {
        Row: TransaksiAttachmentRow;
        Insert: Omit<TransaksiAttachmentRow, "id" | "uploaded_at"> & {
          id?: string;
        };
        Update: Partial<Omit<TransaksiAttachmentRow, "id">>;
        Relationships: [];
      };
      tagihan: {
        Row: TagihanRow;
        Insert: Omit<
          TagihanRow,
          | "id" | "created_at" | "updated_at"
          | "status" | "override_periode"
          | "override_alasan" | "void_reason" | "void_by" | "void_at"
          | "pdf_url" | "finalized_at" | "generated_at"
        > & {
          id?: string;
          status?: TagihanStatus;
          override_periode?: boolean;
          override_alasan?: string | null;
          void_reason?: string | null;
          void_by?: string | null;
          void_at?: string | null;
          pdf_url?: string | null;
          finalized_at?: string | null;
          generated_at?: string;
        };
        Update: Partial<Omit<TagihanRow, "id" | "created_at">>;
        Relationships: [];
      };
      tagihan_item: {
        Row: TagihanItemRow;
        Insert: Omit<TagihanItemRow, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<TagihanItemRow, "id" | "created_at">>;
        Relationships: [];
      };
      app_setting: {
        Row: AppSettingRow;
        Insert: { key: string; value: string; updated_at?: string; updated_by?: string | null };
        Update: Partial<Omit<AppSettingRow, "key">>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<AuditLogRow, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      approve_transaksi: {
        Args: { p_transaksi_id: string; p_checker_id: string };
        Returns: { success: boolean; error?: string };
      };
      reject_transaksi: {
        Args: {
          p_transaksi_id: string;
          p_checker_id: string;
          p_reason: string;
        };
        Returns: { success: boolean; error?: string };
      };
      void_tagihan: {
        Args: { p_tagihan_id: string; p_user_id: string; p_reason: string };
        Returns: { success: boolean; error?: string };
      };
      get_next_nomor_tagihan: {
        Args: { p_bulan: number; p_tahun: number };
        Returns: string;
      };
      get_active_kontrak: {
        Args: { p_klien_id: string; p_tanggal?: string };
        Returns: string | null;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_checker: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      kontrak_status: KontrakStatus;
      tipe_transaksi: TipeTransaksi;
      transaksi_status: TransaksiStatus;
      tagihan_status: TagihanStatus;
      satuan_tagihan: SatuanTagihan;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ── Joined / enriched types used in the UI ───────────────────

export interface TransaksiWithRelations extends TransaksiRow {
  klien: Pick<KlienRow, "id" | "kode" | "nama"> | null;
  klien_tujuan: Pick<KlienRow, "id" | "kode" | "nama"> | null;
  created_by_user: Pick<UserRow, "id" | "nama"> | null;
  approved_by_user: Pick<UserRow, "id" | "nama"> | null;
  rejected_by_user: Pick<UserRow, "id" | "nama"> | null;
  items: (TransaksiItemRow & { alat: Pick<AlatRow, "id" | "kode" | "nama"> })[];
  attachments: TransaksiAttachmentRow[];
}

export interface TagihanWithRelations extends TagihanRow {
  klien: Pick<KlienRow, "id" | "kode" | "nama">;
  kontrak: Pick<
    KontrakSewaRow,
    "id" | "nomor_kontrak" | "apply_ppn" | "tgl_tutup_periode_default"
  >;
  items: TagihanItemRow[];
}

export interface StokGudangWithAlat extends StokGudangRow {
  alat: AlatRow;
}

export interface StokProyekWithAlat extends StokProyekRow {
  alat: AlatRow;
  klien: Pick<KlienRow, "id" | "kode" | "nama">;
}

export interface HargaSewaWithAlat extends HargaSewaRow {
  alat: Pick<AlatRow, "id" | "kode" | "nama">;
}
