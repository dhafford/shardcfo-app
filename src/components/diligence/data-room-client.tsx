"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { upsertDataRoomDoc } from "@/lib/diligence/actions";
import type { DATA_ROOM_STRUCTURE } from "@/lib/constants";
import type { DataRoomDocumentRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Folders = typeof DATA_ROOM_STRUCTURE;

interface DataRoomClientProps {
  folders: Folders;
  documents: DataRoomDocumentRow[];
  companyId: string;
  companyStage: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSubfolderStatus(
  subfolderId: string,
  documents: DataRoomDocumentRow[]
): "empty" | "partial" | "complete" {
  const docs = documents.filter((d) => d.subfolder === subfolderId);
  if (docs.length === 0) return "empty";
  const allVerified = docs.every((d) => d.status === "verified");
  return allVerified ? "complete" : "partial";
}

function getSubfolderDocCount(
  subfolderId: string,
  documents: DataRoomDocumentRow[]
): number {
  return documents.filter((d) => d.subfolder === subfolderId).length;
}

function getFolderDocCount(
  folderId: string,
  documents: DataRoomDocumentRow[]
): number {
  return documents.filter((d) => d.folder === folderId).length;
}

function getFolderRequiredSubfolderCount(
  folder: Folders[number],
  companyStage: string
): number {
  return folder.subfolders.filter((sf) =>
    sf.requiredStages.includes(companyStage as import("@/lib/constants").FundingStage)
  ).length;
}

function getFolderCompleteSubfolderCount(
  folder: Folders[number],
  documents: DataRoomDocumentRow[]
): number {
  return folder.subfolders.filter(
    (sf) => getSubfolderStatus(sf.id, documents) === "complete"
  ).length;
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: "empty" | "partial" | "complete" }) {
  if (status === "complete") {
    return <Check className="w-4 h-4 text-green-600" />;
  }
  if (status === "partial") {
    return <Clock className="w-4 h-4 text-yellow-500" />;
  }
  return <AlertCircle className="w-4 h-4 text-slate-400" />;
}

// ---------------------------------------------------------------------------
// Add document inline form
// ---------------------------------------------------------------------------

function AddDocumentForm({
  companyId,
  folderId,
  subfolderId,
  onDone,
}: {
  companyId: string;
  folderId: string;
  subfolderId: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<string>("pdf");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!docName.trim()) {
      setError("Document name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await upsertDataRoomDoc(companyId, {
          folder: folderId,
          subfolder: subfolderId,
          document_name: docName.trim(),
          document_type: docType as DataRoomDocumentRow["document_type"],
          notes: notes.trim() || null,
          status: "pending",
        });
        setDocName("");
        setNotes("");
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add document.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-md border bg-slate-50 p-3 space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor={`doc-name-${subfolderId}`} className="text-xs">
          Document Name
        </Label>
        <Input
          id={`doc-name-${subfolderId}`}
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          placeholder="e.g. Certificate of Incorporation"
          className="h-8 text-sm"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`doc-type-${subfolderId}`} className="text-xs">
          Document Type
        </Label>
        <Select value={docType} onValueChange={(v) => { if (v) setDocType(v); }}>
          <SelectTrigger id={`doc-type-${subfolderId}`} className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="excel">Excel</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`doc-notes-${subfolderId}`} className="text-xs">
          Notes
        </Label>
        <Textarea
          id={`doc-notes-${subfolderId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this document"
          className="text-sm min-h-[60px] resize-none"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDone}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding…" : "Add Document"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Subfolder row
// ---------------------------------------------------------------------------

function SubfolderRow({
  subfolder,
  documents,
  companyId,
  folderId,
  companyStage,
}: {
  subfolder: Folders[number]["subfolders"][number];
  documents: DataRoomDocumentRow[];
  companyId: string;
  folderId: string;
  companyStage: string;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const status = getSubfolderStatus(subfolder.id, documents);
  const docCount = getSubfolderDocCount(subfolder.id, documents);
  const isRequired = subfolder.requiredStages.includes(companyStage as import("@/lib/constants").FundingStage);

  return (
    <div className="py-2 px-3 rounded-md hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={status} />
          <span className="text-sm text-foreground truncate">{subfolder.label}</span>
          {isRequired && (
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] px-1.5 py-0 border-blue-200 text-blue-700 bg-blue-50"
            >
              Required
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {docCount > 0 && (
            <span className="text-xs text-muted-foreground">{docCount} doc{docCount !== 1 ? "s" : ""}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setAddOpen((v) => !v)}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      </div>

      {addOpen && (
        <AddDocumentForm
          companyId={companyId}
          folderId={folderId}
          subfolderId={subfolder.id}
          onDone={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder card
// ---------------------------------------------------------------------------

function FolderCard({
  folder,
  documents,
  companyId,
  companyStage,
}: {
  folder: Folders[number];
  documents: DataRoomDocumentRow[];
  companyId: string;
  companyStage: string;
}) {
  const [open, setOpen] = useState(false);

  const docCount = getFolderDocCount(folder.id, documents);
  const requiredCount = getFolderRequiredSubfolderCount(folder, companyStage);
  const completeCount = getFolderCompleteSubfolderCount(folder, documents);
  const totalSubfolders = folder.subfolders.length;
  const progressPct =
    totalSubfolders > 0 ? Math.round((completeCount / totalSubfolders) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 text-slate-500">
            {open ? (
              <FolderOpen className="w-5 h-5" />
            ) : (
              <Folder className="w-5 h-5" />
            )}
          </div>

          <CardTitle className="flex-1 text-sm font-semibold">
            <span className="text-muted-foreground mr-1.5">{folder.id}</span>
            {folder.label}
          </CardTitle>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              {completeCount}/{totalSubfolders} subfolders complete
            </span>
            {docCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {docCount} doc{docCount !== 1 ? "s" : ""}
              </span>
            )}
            {requiredCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-700 bg-blue-50"
              >
                {requiredCount} required
              </Badge>
            )}
            {open ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </CardHeader>

      {open && (
        <CardContent className="p-0 divide-y">
          {folder.subfolders.map((sf) => (
            <SubfolderRow
              key={sf.id}
              subfolder={sf}
              documents={documents}
              companyId={companyId}
              folderId={folder.id}
              companyStage={companyStage}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DataRoomClient({
  folders,
  documents,
  companyId,
  companyStage,
}: DataRoomClientProps) {
  // Overall completion: subfolders with at least one doc vs total subfolders
  const totalSubfolders = folders.reduce((sum, f) => sum + f.subfolders.length, 0);
  const completeSubfolders = folders.reduce(
    (sum, f) =>
      sum +
      f.subfolders.filter(
        (sf) => getSubfolderStatus(sf.id, documents) === "complete"
      ).length,
    0
  );
  const populatedSubfolders = folders.reduce(
    (sum, f) =>
      sum +
      f.subfolders.filter(
        (sf) => getSubfolderDocCount(sf.id, documents) > 0
      ).length,
    0
  );
  const overallPct =
    totalSubfolders > 0 ? Math.round((populatedSubfolders / totalSubfolders) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="rounded-lg border bg-white p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">
            {populatedSubfolders} of {totalSubfolders} subfolders have documents
            &nbsp;·&nbsp;
            {completeSubfolders} verified complete
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{overallPct}% populated</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-green-600" />
              Complete
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-yellow-500" />
              In progress
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-slate-400" />
              Empty
            </span>
          </div>
        </div>
      </div>

      {/* Folder cards */}
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          documents={documents}
          companyId={companyId}
          companyStage={companyStage}
        />
      ))}

      {documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No documents added yet.</p>
          <p className="text-xs mt-1">
            Expand a folder and click &quot;Add&quot; to start tracking documents.
          </p>
        </div>
      )}
    </div>
  );
}
