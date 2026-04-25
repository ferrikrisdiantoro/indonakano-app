import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatting ──────────────────────────────────────

export function formatRupiah(amount: number, withDecimals = false): string {
  if (withDecimals) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRupiahShort(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(amount))}`;
}

// ── Date formatting ──────────────────────────────────────────

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  const startFmt = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(start));
  const endFmt = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(end));
  return `${startFmt} – ${endFmt}`;
}

// ── Billing rounding helpers (PRD Section 3.6) ───────────────

/** Round half-up (≥ 0.5 rounds up) to specified decimal places */
export function roundHalfUp(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor + Number.EPSILON) / factor;
}

/** HR (harian) price: harga_bulanan / 30, max 2 decimal places */
export function calcHargaHarian(hargaBulanan: number): number {
  const raw = hargaBulanan / 30;
  return Math.round(raw * 100) / 100;
}

/** Row total: qty × harga × lama, rounded half-up to integer */
export function calcRowTotal(qty: number, hargaPerSatuan: number, lama: number): number {
  const raw = qty * hargaPerSatuan * lama;
  return roundHalfUp(raw, 0);
}

// ── String helpers ───────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}
