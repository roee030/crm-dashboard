"use client";

import { LogOut } from "lucide-react";
import { isStaticDemo } from "@/lib/demo/static";
import { signout } from "@/app/(auth)/actions";

const BTN =
  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200";

/**
 * Sign-out control. In production this submits to the `signout` Server Action
 * (unchanged behavior). On the static GitHub Pages demo there is no server, so it
 * just navigates back to /login client-side.
 */
export function SignOutButton() {
  if (isStaticDemo()) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/crm-dashboard";
    return (
      <button type="button" className={BTN} onClick={() => (window.location.href = `${base}/login`)}>
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    );
  }

  return (
    <form action={signout}>
      <button type="submit" className={BTN}>
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}
