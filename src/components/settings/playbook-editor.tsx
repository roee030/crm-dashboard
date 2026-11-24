"use client";

import { useState, useTransition } from "react";
import { Star, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PlaybookRow } from "@/types/db";
import type { Criterion } from "@/lib/playbooks/scoring";
import { updatePlaybook, setDefaultPlaybook } from "@/app/(app)/settings/playbooks/actions";

export function PlaybookEditor({ playbook }: { playbook: PlaybookRow }) {
  const [name, setName] = useState(playbook.name);
  const [description, setDescription] = useState(playbook.description ?? "");
  const [criteria, setCriteria] = useState<Criterion[]>(playbook.criteria);
  const [isDefault, setIsDefault] = useState(playbook.is_default);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const totalWeight = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);

  function updateCriterion(key: string, field: keyof Criterion, value: string | number) {
    setCriteria((cs) => cs.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updatePlaybook(playbook.id, { name, description, criteria });
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
    });
  }

  function makeDefault() {
    setMsg(null);
    startTransition(async () => {
      const res = await setDefaultPlaybook(playbook.id);
      if (res.ok) {
        setIsDefault(true);
        setMsg({ ok: true, text: "Set as active default." });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-slate-200">
          <span dir="auto">{name}</span>
          <Badge tone="neutral">{playbook.language.toUpperCase()}</Badge>
          {isDefault && <Badge tone="info">Active default</Badge>}
        </CardTitle>
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={makeDefault} disabled={pending}>
            <Star className="h-3.5 w-3.5" /> Make default
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder="Playbook name" />
          <Input dir="auto" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Criteria &amp; weights</span>
            <span className={totalWeight === 100 ? "text-emerald-400" : "text-amber-400"}>
              total weight: {totalWeight}
            </span>
          </div>
          {criteria.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_1fr_80px] items-center gap-2 rounded-lg border border-slate-800 p-2.5">
              <Input dir="auto" value={c.label} onChange={(e) => updateCriterion(c.key, "label", e.target.value)} />
              <Input dir="auto" value={c.description} onChange={(e) => updateCriterion(c.key, "description", e.target.value)} placeholder="Description" />
              <Input
                type="number"
                min={0}
                value={c.weight}
                onChange={(e) => updateCriterion(c.key, "weight", Number(e.target.value))}
                className="text-center"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          {msg && (
            <span className={msg.ok ? "flex items-center gap-1.5 text-sm text-emerald-400" : "text-sm text-rose-400"}>
              {msg.ok && <CheckCircle2 className="h-4 w-4" />}
              {msg.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
