import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnvLike } from "../config";
import { isSupabaseStorageConfigured } from "../config";

export type ReadOnlyStorageClient = {
  configured: boolean;
  skippedReason?: string;
  client: SupabaseClient | null;
};

export function createReadOnlyStorageClient(env: EnvLike = process.env): ReadOnlyStorageClient {
  if (!isSupabaseStorageConfigured(env)) {
    return {
      configured: false,
      skippedReason: "SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing",
      client: null,
    };
  }

  const url = new URL(env.SUPABASE_URL!.trim()).origin;
  const client = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Soft guard: wrap storage.from to block write methods if accidentally called.
  const originalFrom = client.storage.from.bind(client.storage);
  client.storage.from = ((bucket: string) => {
    const api = originalFrom(bucket);
    const blocked = new Set(["upload", "uploadToSignedUrl", "remove", "move", "copy", "update"]);
    return new Proxy(api, {
      get(target, prop, receiver) {
        const key = String(prop);
        if (blocked.has(key)) {
          return () => {
            throw new Error(`Read-only storage client blocked write: storage.from(${bucket}).${key}`);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }) as typeof client.storage.from;

  return { configured: true, client };
}
