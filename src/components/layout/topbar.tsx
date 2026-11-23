import { LogOut } from "lucide-react";
import { signout } from "@/app/(auth)/actions";
import { AskAiDrawer } from "@/components/ai/ask-ai-drawer";

export function Topbar({ workspaceName, email }: { workspaceName: string; email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <div className="text-sm font-medium text-slate-200">{workspaceName}</div>
      <div className="flex items-center gap-4">
        <AskAiDrawer />
        <span className="hidden text-sm text-slate-400 sm:inline">{email}</span>
        <form action={signout}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
