import { AskAiDrawer } from "@/components/ai/ask-ai-drawer";
import { SignOutButton } from "@/components/layout/sign-out-button";

export function Topbar({ workspaceName, email }: { workspaceName: string; email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <div className="text-sm font-medium text-slate-200">{workspaceName}</div>
      <div className="flex items-center gap-4">
        <AskAiDrawer />
        <span className="hidden text-sm text-slate-400 sm:inline">{email}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
