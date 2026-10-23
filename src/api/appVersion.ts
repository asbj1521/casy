import { callFunction } from "@/lib/supabaseFunctions";

/** The oldest app release Casy still works with, and its App Store page (#143). */
interface AppVersionInfo {
  minVersion: string | null;
  storeUrl: string | null;
}

export const appVersionQuery = {
  queryKey: ["app-version"] as const,
  queryFn: () => callFunction<AppVersionInfo>("app-version"),
};
