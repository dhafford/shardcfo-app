"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { updateScenario } from "@/app/(dashboard)/companies/[companyId]/scenarios/actions";
import type {
  ScenarioAssumptions,
  HirePlan,
  FundraisingEvent,
} from "@/lib/calculations/scenario-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssumptionEditorProps {
  companyId: string;
  scenarioId: string;
  initialAssumptions: ScenarioAssumptions;
  onAssumptionsChange?: (assumptions: ScenarioAssumptions) => void;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
      <Separator />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function PercentField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  description,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          step="0.1"
          min={min}
          max={max}
          value={(value * 100).toFixed(1)}
          onChange={(e) => onChange(parseFloat(e.target.value) / 100)}
          className="h-8 text-sm font-mono"
        />
        <span className="text-sm text-muted-foreground shrink-0">%</span>
      </div>
      {description && (
        <p className="text-[10px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  step,
  description,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step ?? 1}
        min={min}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-8 text-sm font-mono"
      />
      {description && (
        <p className="text-[10px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hire plan editor
// ---------------------------------------------------------------------------

function HirePlanEditor({
  hirePlan,
  onChange,
}: {
  hirePlan: HirePlan[];
  onChange: (plan: HirePlan[]) => void;
}) {
  function addRow() {
    onChange([
      ...hirePlan,
      { monthOffset: 1, headcount: 1, monthlySalaryPerPerson: 8000 },
    ]);
  }

  function removeRow(index: number) {
    onChange(hirePlan.filter((_, i) => i !== index));
  }

  function updateRow(index: number, updates: Partial<HirePlan>) {
    onChange(
      hirePlan.map((row, i) => (i === index ? { ...row, ...updates } : row))
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <span>Month</span>
        <span>Headcount</span>
        <span>Salary/mo</span>
        <span />
      </div>

      {hirePlan.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
        >
          <Input
            type="number"
            min={0}
            max={24}
            value={row.monthOffset}
            onChange={(e) =>
              updateRow(i, { monthOffset: parseInt(e.target.value, 10) })
            }
            className="h-7 text-xs font-mono"
            placeholder="Month #"
          />
          <Input
            type="number"
            min={1}
            value={row.headcount}
            onChange={(e) =>
              updateRow(i, { headcount: parseInt(e.target.value, 10) })
            }
            className="h-7 text-xs font-mono"
          />
          <Input
            type="number"
            min={0}
            step={500}
            value={row.monthlySalaryPerPerson}
            onChange={(e) =>
              updateRow(i, {
                monthlySalaryPerPerson: parseFloat(e.target.value),
              })
            }
            className="h-7 text-xs font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => removeRow(i)}
            aria-label="Remove hire"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-full gap-1.5 h-7 text-xs"
      >
        <Plus className="w-3 h-3" />
        Add hire
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fundraising editor
// ---------------------------------------------------------------------------

function FundraisingEditor({
  events,
  onChange,
}: {
  events: FundraisingEvent[];
  onChange: (events: FundraisingEvent[]) => void;
}) {
  function addRow() {
    // Default to 6 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    const closeDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    onChange([...events, { closeDate, amount: 1_000_000 }]);
  }

  function removeRow(index: number) {
    onChange(events.filter((_, i) => i !== index));
  }

  function updateRow(index: number, updates: Partial<FundraisingEvent>) {
    onChange(
      events.map((row, i) => (i === index ? { ...row, ...updates } : row))
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <span>Close date</span>
        <span>Amount ($)</span>
        <span />
      </div>

      {events.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input
            type="month"
            value={row.closeDate}
            onChange={(e) => updateRow(i, { closeDate: e.target.value })}
            className="h-7 text-xs"
          />
          <Input
            type="number"
            min={0}
            step={100000}
            value={row.amount}
            onChange={(e) =>
              updateRow(i, { amount: parseFloat(e.target.value) })
            }
            className="h-7 text-xs font-mono"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => removeRow(i)}
            aria-label="Remove fundraise event"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="w-full gap-1.5 h-7 text-xs"
      >
        <Plus className="w-3 h-3" />
        Add fundraise event
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssumptionEditor({
  companyId,
  scenarioId,
  initialAssumptions,
  onAssumptionsChange,
}: AssumptionEditorProps) {
  const [assumptions, setAssumptions] =
    useState<ScenarioAssumptions>(initialAssumptions);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function update(patch: Partial<ScenarioAssumptions>) {
    const next = { ...assumptions, ...patch };
    setAssumptions(next);
    onAssumptionsChange?.(next);
    setSaved(false);
  }

  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("companyId", companyId);
      fd.set("scenarioId", scenarioId);
      fd.set("assumptions", JSON.stringify(assumptions));
      try {
        await updateScenario(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save assumptions"
        );
      }
    });
  }

  const projMonths = assumptions.projectionMonths ?? 12;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-10">
        <h2 className="text-sm font-semibold">Assumptions</h2>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="gap-1.5 h-7 text-xs"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Save className="w-3 h-3" />
          )}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {saveError && (
          <p className="text-xs text-destructive">{saveError}</p>
        )}

        {/* Projection window */}
        <Section title="Projection">
          <div className="space-y-1">
            <Label htmlFor="proj-months" className="text-xs">
              Months to project
            </Label>
            <Select
              value={String(projMonths)}
              onValueChange={(v) => {
                if (v) update({ projectionMonths: parseInt(v, 10) });
              }}
            >
              <SelectTrigger id="proj-months" className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 6, 12, 18, 24].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Revenue growth */}
        <Section title="Revenue Growth">
          <PercentField
            id="mrr-growth"
            label="MRR growth rate (MoM)"
            value={assumptions.mrrGrowthRate ?? 0.1}
            onChange={(v) => update({ mrrGrowthRate: v })}
            min={-50}
            max={200}
            description="Month-over-month compounding growth applied to MRR"
          />
        </Section>

        {/* Expense changes */}
        <Section title="Expense Changes">
          <PercentField
            id="cogs-pct"
            label="COGS as % of revenue"
            value={assumptions.cogsPercentage ?? 0.3}
            onChange={(v) => update({ cogsPercentage: v })}
            min={0}
            max={100}
            description="Overrides the base-period COGS ratio each projected month"
          />
          <PercentField
            id="opex-growth"
            label="Non-payroll opex growth (MoM)"
            value={assumptions.otherOpexGrowthRate ?? 0}
            onChange={(v) => update({ otherOpexGrowthRate: v })}
            min={-20}
            max={50}
            description="Compound monthly growth for non-payroll operating expenses"
          />
          <PercentField
            id="burden-rate"
            label="Employer burden rate"
            value={assumptions.employerBurdenRate ?? 0.15}
            onChange={(v) => update({ employerBurdenRate: v })}
            min={0}
            max={50}
            description="Payroll taxes and benefits added on top of gross salary"
          />
        </Section>

        {/* Hiring plan */}
        <Section title="Hiring Plan">
          <p className="text-[10px] text-muted-foreground">
            Specify new hires by month offset (0 = first projected month).
            Salaries are monthly gross per person.
          </p>
          <HirePlanEditor
            hirePlan={assumptions.hirePlan ?? []}
            onChange={(plan) => update({ hirePlan: plan })}
          />
        </Section>

        {/* Fundraising */}
        <Section title="Fundraising">
          <p className="text-[10px] text-muted-foreground">
            Add fundraising rounds to inject cash at a specific close month.
          </p>
          <FundraisingEditor
            events={assumptions.fundraisingEvents ?? []}
            onChange={(events) => update({ fundraisingEvents: events })}
          />
        </Section>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="text-[10px]">
            {(( assumptions.mrrGrowthRate ?? 0.1) * 100).toFixed(1)}% MoM growth
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {projMonths}mo projection
          </Badge>
          {(assumptions.hirePlan?.length ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {assumptions.hirePlan!.reduce((s, h) => s + h.headcount, 0)} planned hires
            </Badge>
          )}
          {(assumptions.fundraisingEvents?.length ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {assumptions.fundraisingEvents!.length} fundraise event
              {assumptions.fundraisingEvents!.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
