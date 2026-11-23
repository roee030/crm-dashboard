"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Phone, Upload, Plug, Target, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/settings/playbooks", label: "Playbooks", icon: Target },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 px-3 py-5 md:flex">
      <div className="mb-8 px-3 text-lg font-semibold tracking-tight text-white">
        Signal<span className="text-indigo-400">Desk</span>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600/15 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
