"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type ProjectionAssumptions, type HistoricalYear, PROJECTION_YEARS } from "@/lib/projections/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssumptionsPanelProps {
  assumptions: ProjectionAssumptions;
  onChange: (a: ProjectionAssumptions) => void;
  historicals: HistoricalYear[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssumptionsPanel({ assumptions, onChange, historicals }: AssumptionsPanelProps) {
  const lastYear = historicals[historicals.length - 1];
  const startYear = lastYear ? lastYear.year + 1 : new Date().getFullYear() + 1;
  const yearLabels = Array.from({ length: PROJECTION_YEARS }, (_, i) => `FY ${startYear + i}E`);

  // Helper: update a single value in an array assumption
  function updateArray(
    key: keyof ProjectionAssumptions,
    index: number,
    value: number,
  ) {
    const arr = [...(assumptions[key] as number[])];
    arr[index] = value;
    onChange({ ...assumptions, [key]: arr });
  }

  // Helper: update revenue stream growth rate
  function updateStreamGrowth(streamIndex: number, yearIndex: number, value: number) {
    const streams = assumptions.revenueStreams.map((s, i) => {
      if (i !== streamIndex) return s;
      const growthRates = [...s.growthRates];
      growthRates[yearIndex] = value;
      return { ...s, growthRates };
    });
    onChange({ ...assumptions, revenueStreams: streams });
  }

  return (
    <div className="space-y-6">
      {/* Revenue Growth Assumptions */}
      <AssumptionSection title="Revenue Growth Assumptions (YoY %)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[240px] sticky left-0 bg-white" />
              {yearLabels.map((l) => (
                <th key={l} className="text-center px-2 py-2 font-medium text-slate-600 min-w-[90px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assumptions.revenueStreams.map((stream, si) => (
              <tr key={stream.name} className="border-b last:border-b-0">
                <td className="px-3 py-1.5 text-sm sticky left-0 bg-white">{stream.name}</td>
                {stream.growthRates.slice(0, PROJECTION_YEARS).map((rate, yi) => (
                  <td key={yi} className="px-1 py-1">
                    <PctInput
                      value={rate}
                      onChange={(v) => updateStreamGrowth(si, yi, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </AssumptionSection>

      {/* Margin & Cost Assumptions */}
      <AssumptionSection title="Margin & Cost Assumptions (% of Revenue)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[240px] sticky left-0 bg-white" />
              {yearLabels.map((l) => (
                <th key={l} className="text-center px-2 py-2 font-medium text-slate-600 min-w-[90px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <PctRow label="Cost of Revenue" values={assumptions.cogsPercent} onChange={(i, v) => updateArray("cogsPercent", i, v)} />
            <PctRow label="R&D" values={assumptions.rdPercent} onChange={(i, v) => updateArray("rdPercent", i, v)} />
            <PctRow label="Sales & Marketing" values={assumptions.smPercent} onChange={(i, v) => updateArray("smPercent", i, v)} />
            <PctRow label="G&A" values={assumptions.gaPercent} onChange={(i, v) => updateArray("gaPercent", i, v)} />
          </tbody>
        </table>
      </AssumptionSection>

      {/* Other P&L Assumptions */}
      <AssumptionSection title="Other P&L Assumptions">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[240px] sticky left-0 bg-white" />
              {yearLabels.map((l) => (
                <th key={l} className="text-center px-2 py-2 font-medium text-slate-600 min-w-[90px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <PctRow label="Stock-Based Comp (% Rev)" values={assumptions.sbcPercent} onChange={(i, v) => updateArray("sbcPercent", i, v)} />
            <PctRow label="D&A (% Rev)" values={assumptions.daPercent} onChange={(i, v) => updateArray("daPercent", i, v)} />
            <PctRow label="Effective Tax Rate" values={assumptions.taxRate} onChange={(i, v) => updateArray("taxRate", i, v)} />
          </tbody>
        </table>
      </AssumptionSection>

      {/* Balance Sheet Assumptions */}
      <AssumptionSection title="Balance Sheet Assumptions">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[240px] sticky left-0 bg-white" />
              {yearLabels.map((l) => (
                <th key={l} className="text-center px-2 py-2 font-medium text-slate-600 min-w-[90px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <DaysRow label="DSO (Days)" values={assumptions.dso} onChange={(i, v) => updateArray("dso", i, v)} />
            <DaysRow label="DPO (Days)" values={assumptions.dpo} onChange={(i, v) => updateArray("dpo", i, v)} />
            <PctRow label="Prepaid & Other (% Rev)" values={assumptions.prepaidPercent} onChange={(i, v) => updateArray("prepaidPercent", i, v)} />
            <PctRow label="Accrued Liabilities (% Rev)" values={assumptions.accruedLiabPercent} onChange={(i, v) => updateArray("accruedLiabPercent", i, v)} />
            <PctRow label="Deferred Rev Current (% Rev)" values={assumptions.deferredRevCurrentPercent} onChange={(i, v) => updateArray("deferredRevCurrentPercent", i, v)} />
          </tbody>
        </table>
      </AssumptionSection>

      {/* CapEx Assumptions */}
      <AssumptionSection title="CapEx & Investing (% of Revenue)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[240px] sticky left-0 bg-white" />
              {yearLabels.map((l) => (
                <th key={l} className="text-center px-2 py-2 font-medium text-slate-600 min-w-[90px]">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <PctRow label="CapEx (PP&E)" values={assumptions.capexPercent} onChange={(i, v) => updateArray("capexPercent", i, v)} />
            <PctRow label="Capitalized Software" values={assumptions.capSoftwarePercent} onChange={(i, v) => updateArray("capSoftwarePercent", i, v)} />
          </tbody>
        </table>
      </AssumptionSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AssumptionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <div className="px-4 py-2 bg-slate-50 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const display = (value * 100).toFixed(1);
  return (
    <Input
      type="number"
      step="0.1"
      className="h-7 text-xs text-center tabular-nums w-full bg-blue-50 border-blue-200 focus:bg-white"
      value={display}
      onChange={(e) => onChange(parseFloat(e.target.value) / 100 || 0)}
    />
  );
}

function DaysInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      step="1"
      className="h-7 text-xs text-center tabular-nums w-full bg-blue-50 border-blue-200 focus:bg-white"
      value={Math.round(value)}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    />
  );
}

function PctRow({
  label,
  values,
  onChange,
}: {
  label: string;
  values: number[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-1.5 text-sm sticky left-0 bg-white">{label}</td>
      {values.slice(0, PROJECTION_YEARS).map((v, i) => (
        <td key={i} className="px-1 py-1">
          <PctInput value={v} onChange={(val) => onChange(i, val)} />
        </td>
      ))}
    </tr>
  );
}

function DaysRow({
  label,
  values,
  onChange,
}: {
  label: string;
  values: number[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-1.5 text-sm sticky left-0 bg-white">{label}</td>
      {values.slice(0, PROJECTION_YEARS).map((v, i) => (
        <td key={i} className="px-1 py-1">
          <DaysInput value={v} onChange={(val) => onChange(i, val)} />
        </td>
      ))}
    </tr>
  );
}
