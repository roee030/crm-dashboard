"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AuthState } from "./actions";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );
  const isSignup = mode === "signup";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mb-2 text-2xl font-semibold tracking-tight">SignalDesk</div>
        <p className="text-sm text-slate-400">
          {isSignup ? "Create your workspace" : "Sign in to your dashboard"}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {isSignup && (
          <div className="space-y-1.5">
            <label className="text-sm text-slate-300" htmlFor="full_name">
              Full name
            </label>
            <Input id="full_name" name="full_name" placeholder="Dana Levi" required />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm text-slate-300" htmlFor="email">
            Email
          </label>
          <Input id="email" name="email" type="email" placeholder="you@company.com" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-slate-300" htmlFor="password">
            Password
          </label>
          <Input id="password" name="password" type="password" placeholder="••••••••" minLength={6} required />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-400">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account?{" "}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
