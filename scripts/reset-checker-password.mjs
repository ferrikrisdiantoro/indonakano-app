import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const USER_ID = "0b573543-03d3-4513-9b2e-75c6aca7d480";
const NEW_PASSWORD = "checker123";

const { data, error } = await supabase.auth.admin.updateUserById(USER_ID, {
  password: NEW_PASSWORD,
});

if (error) {
  console.error("❌ Reset gagal:", error.message);
  process.exit(1);
}

console.log("✅ Password berhasil direset");
console.log("   Email :", data.user.email);
console.log("   Password baru:", NEW_PASSWORD);
