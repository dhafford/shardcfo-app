"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  File,
  Download,
  Trash2,
  Loader2,
  Search,
  FolderOpen,
} from "lucide-react";
import {
  getDownloadUrl,
  deleteFile,
} from "../companies/[companyId]/files/actions";
import type { DashboardFile } from "../actions";

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
  if (
    mimeType?.includes("presentation") ||
    mimeType?.includes("powerpoint") ||
    ext === "pptx" ||
    ext === "ppt"
  ) {
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

const CATEGORY_LABELS: Record<string, string> = {
  historicals: "Historicals",
  projections: "Projections",
  board_materials: "Board Materials",
  investment_memorandum: "Investment Memo",
  other: "Other",
};

const CATEGORY_OPTIONS = [
  { id: "all", label: "All categories" },
  { id: "historicals", label: "Historicals" },
  { id: "projections", label: "Projections" },
  { id: "board_materials", label: "Board Materials" },
  { id: "investment_memorandum", label: "Investment Memo" },
  { id: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// File row
// ---------------------------------------------------------------------------

function FileRow({
  file,
  onDeleted,
}: {
  file: DashboardFile;
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
    const result = await deleteFile(file.id, file.company_id);
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
            <p className="font-medium truncate text-sm">{file.file_name}</p>
            {file.notes && (
              <p className="text-xs text-muted-foreground truncate">
                {file.notes}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 hidden sm:table-cell">
        <Link
          href={`/dashboard/companies/${file.company_id}`}
          className="text-sm text-blue-600 hover:underline truncate block"
        >
          {file.company_name}
        </Link>
      </td>
      <td className="px-4 py-2.5 hidden md:table-cell">
        <Badge variant="outline" className="text-xs">
          {CATEGORY_LABELS[file.category] ?? "Other"}
        </Badge>
      </td>
      <td className="text-right px-4 py-2.5 tabular-nums text-muted-foreground text-sm hidden lg:table-cell">
        {formatFileSize(file.file_size)}
      </td>
      <td className="text-right px-4 py-2.5 text-muted-foreground text-sm hidden md:table-cell">
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
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AllFilesClientProps {
  files: DashboardFile[];
  companies: { id: string; name: string }[];
  error: string | null;
}

export function AllFilesClient({
  files: initialFiles,
  companies,
  error,
}: AllFilesClientProps) {
  const [files, setFiles] = React.useState(initialFiles);
  const [search, setSearch] = React.useState("");
  const [companyFilter, setCompanyFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    let result = files;

    if (companyFilter !== "all") {
      result = result.filter((f) => f.company_id === companyFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((f) => f.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.file_name.toLowerCase().includes(q) ||
          f.company_name.toLowerCase().includes(q) ||
          (f.notes?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [files, search, companyFilter, categoryFilter]);

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">All Files</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {files.length} file{files.length !== 1 ? "s" : ""} across all
          companies
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger
              className="w-[180px] h-9 text-sm"
              aria-label="Filter by company"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-[170px] h-9 text-sm"
              aria-label="Filter by category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table or empty state */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-6">
          <div className="rounded-full bg-slate-100 p-3 mb-3">
            <FolderOpen className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            No files uploaded yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload files from any company&apos;s Files tab to see them here
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No files match your filters.
          </p>
        </div>
      ) : (
        <>
          {(search || companyFilter !== "all" || categoryFilter !== "all") && (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {files.length} files
            </p>
          )}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">
                    File
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 hidden sm:table-cell">
                    Company
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 hidden md:table-cell">
                    Category
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600 hidden lg:table-cell">
                    Size
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600 hidden md:table-cell">
                    Uploaded
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onDeleted={handleDeleted}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
