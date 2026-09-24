// Next.js only inlines NEXT_PUBLIC_* env vars into client bundles when they
// are referenced statically as `process.env.NEXT_PUBLIC_...` (see
// node_modules/next/dist/docs/). Dynamic access via a bracketed variable
// name is never inlined, so it resolves to undefined in the browser even
// though the value exists at build time (this previously broke Google
// sign-in). `checkEnv` is the small checker that throws when a value is
// missing; each exported getter passes it a statically-referenced value.
function checkEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requiredEnv(name: string): string {
  switch (name) {
    case "NEXT_PUBLIC_SUPABASE_URL":
      return checkEnv(name, process.env.NEXT_PUBLIC_SUPABASE_URL);
    case "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":
      return checkEnv(name, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    case "NEXT_PUBLIC_SITE_URL":
      return checkEnv(name, process.env.NEXT_PUBLIC_SITE_URL);
    default:
      throw new Error(`Missing required environment variable: ${name}`);
  }
}

export function supabaseUrl(): string {
  return requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabasePublishableKey(): string {
  return requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function siteUrl(): string {
  return requiredEnv("NEXT_PUBLIC_SITE_URL");
}
