import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Masuk" };

const POLE_X = [60, 160, 260, 360];
const RAIL_Y = [44, 134, 224, 314];

function ScaffoldingIllustration() {
  return (
    <svg viewBox="0 0 420 360" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm">
      {/* Decorative background circles */}
      <circle cx="380" cy="20" r="90" fill="white" fillOpacity="0.04" />
      <circle cx="40" cy="340" r="110" fill="white" fillOpacity="0.04" />

      {/* Building silhouette */}
      <rect x="68" y="55" width="284" height="275" rx="6" fill="white" fillOpacity="0.07" />

      {/* Building windows — 3 col × 4 row */}
      {[95, 153, 211, 269].map((wy) =>
        [88, 178, 268].map((wx) => (
          <rect key={`w-${wx}-${wy}`} x={wx} y={wy} width="52" height="38" rx="4" fill="white" fillOpacity="0.12" />
        ))
      )}

      {/* Horizontal scaffold rails */}
      {RAIL_Y.map((y) => (
        <rect key={`rail-${y}`} x="52" y={y - 4} width="316" height="8" rx="4" fill="white" fillOpacity="0.65" />
      ))}

      {/* Vertical scaffold poles */}
      {POLE_X.map((x) => (
        <rect key={`pole-${x}`} x={x - 5} y="38" width="10" height="284" rx="5" fill="white" fillOpacity="0.75" />
      ))}

      {/* Cross braces — rows 0 and 1 only (top half) */}
      {[0, 1].flatMap((row) =>
        [0, 1, 2].map((bay) => (
          <g key={`brace-${row}-${bay}`} opacity="0.28">
            <line x1={POLE_X[bay]} y1={RAIL_Y[row]} x2={POLE_X[bay + 1]} y2={RAIL_Y[row + 1]} stroke="white" strokeWidth="2.5" />
            <line x1={POLE_X[bay + 1]} y1={RAIL_Y[row]} x2={POLE_X[bay]} y2={RAIL_Y[row + 1]} stroke="white" strokeWidth="2.5" />
          </g>
        ))
      )}

      {/* Scaffold joints at all pole-rail intersections */}
      {POLE_X.flatMap((x) =>
        RAIL_Y.map((y) => (
          <circle key={`joint-${x}-${y}`} cx={x} cy={y} r="7" fill="white" fillOpacity="0.9" />
        ))
      )}

      {/* Top platform board */}
      <rect x="48" y="32" width="324" height="13" rx="3" fill="white" fillOpacity="0.4" />

      {/* Worker platform plank — level 2 */}
      <rect x="55" y="130" width="310" height="10" rx="2" fill="white" fillOpacity="0.22" />

      {/* Hard hat icon — floating top right */}
      <g transform="translate(370, 18)" opacity="0.7">
        <ellipse cx="18" cy="22" rx="18" ry="5" fill="white" fillOpacity="0.3" />
        <path d="M4 22 Q4 8 18 8 Q32 8 32 22" fill="white" fillOpacity="0.6" />
        <rect x="2" y="20" width="32" height="5" rx="2.5" fill="white" fillOpacity="0.8" />
      </g>

      {/* Clipboard icon — bottom left */}
      <g transform="translate(8, 290)" opacity="0.55">
        <rect x="4" y="0" width="32" height="40" rx="4" fill="white" fillOpacity="0.5" />
        <rect x="10" y="4" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.8" />
        <rect x="10" y="10" width="20" height="2" rx="1" fill="white" fillOpacity="0.6" />
        <rect x="10" y="15" width="14" height="2" rx="1" fill="white" fillOpacity="0.6" />
        <rect x="10" y="20" width="17" height="2" rx="1" fill="white" fillOpacity="0.6" />
        <rect x="14" y="-4" width="12" height="8" rx="2" fill="white" fillOpacity="0.7" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ───────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[45%] bg-white px-8 sm:px-14 py-10">
        {/* Logo — top left */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">PT Perancah Pro Alat</p>
            <p className="text-xs text-slate-400">PT INDONAKANO</p>
          </div>
        </div>

        {/* Form — vertically centered */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Selamat datang</h1>
            <p className="text-sm text-slate-500 mb-8">Masuk ke akun Anda untuk melanjutkan</p>
            <LoginForm />
          </div>
        </div>
      </div>

      {/* ── Right panel — branded ───────────────────────────── */}
      <div className="hidden lg:flex flex-col items-center justify-center w-[55%] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 relative overflow-hidden p-12">
        {/* Background glows */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] rounded-full bg-white/5" />

        {/* SVG Illustration */}
        <ScaffoldingIllustration />

        {/* Tagline */}
        <div className="text-center mt-8 relative z-10">
          <h2 className="text-2xl font-bold text-white">Kelola Sewa Perancah</h2>
          <p className="text-blue-200 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            Stok real-time, approval workflow, dan tagihan otomatis dalam satu platform
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-8 mt-10 relative z-10">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">35+</p>
            <p className="text-xs text-blue-200 mt-0.5">Jenis Alat</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">5</p>
            <p className="text-xs text-blue-200 mt-0.5">Proyek Aktif</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">100%</p>
            <p className="text-xs text-blue-200 mt-0.5">Digital</p>
          </div>
        </div>
      </div>
    </div>
  );
}
