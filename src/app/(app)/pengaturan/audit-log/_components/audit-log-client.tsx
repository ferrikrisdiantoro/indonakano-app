"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type AuditLogRow = {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  after_value: Record<string, unknown> | null;
  created_at: string;
  user: { nama: string; role: string } | null;
};

const ENTITY_LABEL: Record<string, string> = {
  transaksi: "Transaksi",
  alat: "Alat",
  klien: "Klien",
  kontrak_sewa: "Kontrak",
  harga_sewa: "Harga Sewa",
  tagihan: "Tagihan",
  user: "Pengguna",
  setting: "Pengaturan",
};

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-blue-50 text-blue-700",
  EDIT: "bg-amber-50 text-amber-700",
  UPDATE: "bg-amber-50 text-amber-700",
  DELETE: "bg-red-50 text-red-700",
  APPROVE: "bg-green-50 text-green-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECT: "bg-red-50 text-red-700",
  REJECTED: "bg-red-50 text-red-700",
  VOID: "bg-slate-100 text-slate-700",
  FINALIZE: "bg-purple-50 text-purple-700",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = formatDate(d);
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function describeAfterValue(after: Record<string, unknown> | null): string {
  if (!after || Object.keys(after).length === 0) return "—";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(after)) {
    if (v === null || v === undefined) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}: ${val.length > 40 ? val.slice(0, 40) + "…" : val}`);
  }
  return parts.join(" · ") || "—";
}

export function AuditLogClient({ rows }: { rows: AuditLogRow[] }) {
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");

  const entityOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.entity_type))).sort();
  }, [rows]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.action))).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterEntity && r.entity_type !== filterEntity) return false;
      if (filterAction && r.action !== filterAction) return false;
      if (filterUser) {
        const nama = r.user?.nama?.toLowerCase() ?? "";
        if (!nama.includes(filterUser.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filterEntity, filterAction, filterUser]);

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="Audit Log"
        description={`${rows.length} riwayat aksi terbaru (maks 500). Filter untuk lihat aksi tertentu.`}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tipe Data Diubah</label>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className={selectCls}
            >
              <option value="">— Semua Tipe —</option>
              {entityOptions.map((e) => (
                <option key={e} value={e}>
                  {ENTITY_LABEL[e] ?? e}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Aksi</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className={selectCls}
            >
              <option value="">— Semua Aksi —</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-xs font-medium text-slate-500">Pelaku (Nama User)</label>
            <input
              type="text"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="Mis. Adnub, ketik sebagian nama…"
              className={selectCls}
            />
          </div>
          {(filterEntity || filterAction || filterUser) && (
            <button
              onClick={() => {
                setFilterEntity("");
                setFilterAction("");
                setFilterUser("");
              }}
              className="self-end h-9 px-3 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Tip: <span className="text-slate-600">Tipe Data</span> = data apa yang berubah (transaksi, klien, dll). <span className="text-slate-600">Pelaku</span> = siapa yang melakukan aksi. Kosongkan filter untuk lihat semuanya.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Waktu</TableHead>
              <TableHead className="w-40">User</TableHead>
              <TableHead className="w-32">Entitas</TableHead>
              <TableHead className="w-28">Aksi</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                  Tidak ada catatan yang cocok
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTime(r.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="text-slate-700">{r.user?.nama ?? "—"}</div>
                    {r.user?.role && (
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        {r.user.role}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {ENTITY_LABEL[r.entity_type] ?? r.entity_type}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ACTION_COLOR[r.action] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 break-all">
                    {describeAfterValue(r.after_value)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
