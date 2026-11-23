import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireContext } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar workspaceName={ctx.workspaceName} email={ctx.email} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
