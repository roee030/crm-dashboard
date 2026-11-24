/**
 * Static-demo stub for src/app/(auth)/actions.ts.
 *
 * Swapped in by scripts/build-gh-pages.mjs during the GitHub Pages export build
 * (Server Actions are not supported by `output: 'export'`). These are plain
 * client-callable async functions — no "use server" — so no Server Action is
 * registered. Real sign-in is disabled on the static host; "Enter Live Demo"
 * (DemoCta) is the way in.
 */
export type AuthState = { error?: string } | undefined;

export async function login(_prev: AuthState, _formData: FormData): Promise<AuthState> {
  return { error: 'Live sign-in is disabled in the static demo — click "Enter Live Demo" to explore.' };
}

export async function signup(_prev: AuthState, _formData: FormData): Promise<AuthState> {
  return { error: 'Account creation is disabled in the static demo — click "Enter Live Demo" to explore.' };
}

export async function signout(): Promise<void> {
  if (typeof window !== "undefined") {
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? "/crm-dashboard"}/login`;
  }
}
