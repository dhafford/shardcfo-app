"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Presentation,
  File,
  Trash2,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { registerFile, deleteFile, getDownloadUrl } from "./actions";
import type { FileCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyFile {
  id: string;
  company_id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  category: string;
  storage_path: string;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FilesClientProps {
  companyId: string;
  companyName: string;
  initialFiles: CompanyFile[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORIES: { id: FileCategory; label: string; description: string }[] = [
  { id: "historicals", label: "Historicals", description: "Historical financial statements & reports" },
  { id: "projections", label: "Projections", description: "Financial models & forecasts" },
  { id: "board_materials", label: "Board Materials", description: "Board decks, minutes & resolutions" },
  { id: "investment_memorandum", label: "Investment Memorandum", description: "Investment memos & pitch materials" },
  { id: "other", label: "Other", description: "Miscellaneous documents" },
];

const ACCEPT =
  ".pdf,.csv,.xlsx,.xls,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFileIcon(mimeType: string | null, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("excel") ||
    ext === "csv" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  }
  if (mimeType?.includes("presentation") || mimeType?.includes("powerpoint") || ext === "pptx" || ext === "ppt") {
    return <Presentation className="h-5 w-5 text-orange-500" />;
  }
  if (mimeType === "application/pdf" || ext === "pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (mimeType?.startsWith("image/")) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  return <File className="h-5 w-5 text-slate-500" />;
}

function getCategoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilesClient({ companyId, companyName, initialFiles, error }: FilesClientProps) {
  const [files, setFiles] = React.useState<CompanyFile[]>(initialFiles);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Group files by category
  const grouped = React.useMemo(() => {
    const map: Record<string, CompanyFile[]> = {};
    for (const cat of CATEGORIES) map[cat.id] = [];
    for (const f of files) {
      (map[f.category] ??= []).push(f);
    }
    return map;
  }, [files]);

  const totalCount = files.length;

  function handleUploaded(newFiles: CompanyFile[]) {
    setFiles((prev) => [...newFiles, ...prev]);
    setDialogOpen(false);
  }

  function handleDeleted(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Error loading files: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Files</h2>
          <p className="text-sm text-muted-foreground">
            {totalCount} file{totalCount !== 1 ? "s" : ""} uploaded for {companyName}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Upload className="h-4 w-4" />
            Upload Files
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Files</DialogTitle>
            </DialogHeader>
            <UploadForm companyId={companyId} onUploaded={handleUploaded} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs by category */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {totalCount}
              </Badge>
            )}
          </TabsTrigger>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.label}
              {(grouped[cat.id]?.length ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {grouped[cat.id].length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          {totalCount === 0 ? (
            <EmptyState onUpload={() => setDialogOpen(true)} />
          ) : (
            <FileTable files={files} companyId={companyId} onDeleted={handleDeleted} />
          )}
        </TabsContent>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id}>
            {(grouped[cat.id]?.length ?? 0) === 0 ? (
              <EmptyState
                category={cat.label}
                description={cat.description}
                onUpload={() => setDialogOpen(true)}
              />
            ) : (
              <FileTable files={grouped[cat.id]} companyId={companyId} onDeleted={handleDeleted} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File table
// ---------------------------------------------------------------------------

function FileTable({
  files,
  companyId,
  onDeleted,
}: {
  files: CompanyFile[];
  companyId: string;
  onDeleted: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">File</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 hidden sm:table-cell">Category</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 hidden md:table-cell">Size</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 hidden md:table-cell">Uploaded</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-24" />
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow key={file.id} file={file} companyId={companyId} onDeleted={onDeleted} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({
  file,
  companyId,
  onDeleted,
}: {
  file: CompanyFile;
  companyId: string;
  onDeleted: (id: string) => void;
}) {
  const [downloading, setDownloading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { url, error } = await getDownloadUrl(file.storage_path);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.file_name;
        a.click();
      } else {
        alert(error ?? "Download failed");
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    setDeleting(true);
    const result = await deleteFile(file.id, companyId);
    if (result.success) {
      onDeleted(file.id);
    } else {
      alert(result.error);
      setDeleting(false);
    }
  }

  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {getFileIcon(file.mime_type, file.file_name)}
          <div className="min-w-0">
            <p className="font-medium truncate">{file.file_name}</p>
            {file.notes && (
              <p className="text-xs text-muted-foreground truncate">{file.notes}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 hidden sm:table-cell">
        <Badge variant="outline" className="text-xs">
          {getCategoryLabel(file.category)}
        </Badge>
      </td>
      <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground hidden md:table-cell">
        {formatFileSize(file.file_size)}
      </td>
      <td className="text-right px-4 py-2.5 text-muted-foreground hidden md:table-cell">
        {formatDate(file.created_at)}
      </td>
      <td className="text-right px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
            disabled={downloading}
            title="Download"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  category,
  description,
  onUpload,
}: {
  category?: string;
  description?: string;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 px-6">
      <div className="rounded-full bg-slate-100 p-3 mb-3">
        <Upload className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">
        {category ? `No ${category.toLowerCase()} files` : "No files uploaded yet"}
      </p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onUpload}>
        <Upload className="h-3.5 w-3.5" />
        Upload Files
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload form (inside dialog)
// ---------------------------------------------------------------------------

function UploadForm({
  companyId,
  onUploaded,
}: {
  companyId: string;
  onUploaded: (files: CompanyFile[]) => void;
}) {
  const [category, setCategory] = React.useState<FileCategory>("historicals");
  const [notes, setNotes] = React.useState("");
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);

    const supabase = createClient();
    const uploaded: CompanyFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setProgress(`Uploading ${i + 1} of ${selectedFiles.length}...`);

      const storagePath = `${companyId}/${crypto.randomUUID()}_${file.name}`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("company-files")
        .upload(storagePath, file);

      if (storageError) {
        alert(`Failed to upload ${file.name}: ${storageError.message}`);
        continue;
      }

      // Register metadata
      const result = await registerFile({
        companyId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        category,
        storagePath,
        notes: notes || undefined,
      });

      if (result.success) {
        uploaded.push({
          id: crypto.randomUUID(), // temp ID — page will revalidate
          company_id: companyId,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          category,
          storage_path: storagePath,
          uploaded_by: null,
          notes: notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        alert(`Failed to register ${file.name}: ${result.error}`);
      }
    }

    setUploading(false);
    setProgress("");

    if (uploaded.length > 0) {
      onUploaded(uploaded);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drag-and-drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 px-4 cursor-pointer transition-colors",
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
        )}
      >
        <Upload className="h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-600">
          Drag & drop files here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Excel, CSV, PowerPoint, Word, or images (max 50MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {selectedFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(file.type, file.name)}
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="ml-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Category</label>
        <Select value={category} onValueChange={(v) => setCategory(v as FileCategory)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes (optional)</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. FY2024 audited financials"
        />
      </div>

      {/* Upload button */}
      <Button
        className="w-full gap-2"
        disabled={selectedFiles.length === 0 || uploading}
        onClick={handleUpload}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress}
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length !== 1 ? "s" : ""}` : "Files"}
          </>
        )}
      </Button>
    </div>
  );
}
