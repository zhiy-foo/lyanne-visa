export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
