// Deterministic test env. A fixed 32-byte base64 key for crypto round-trips.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64");
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role";
