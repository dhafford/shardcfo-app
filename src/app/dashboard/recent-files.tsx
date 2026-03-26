"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  File,
  Download,
  Loader2,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { getDownloadUrl } from "./companies/[companyId]/files/actions";
import type { DashboardFile } from "./actions";

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

// ---------------------------------------------------------------------------
// File row with download
// ---------------------------------------------------------------------------

function RecentFileRow({ file }: { file: DashboardFile }) {
  const [downloading, setDownloading] = React.useState(false);

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
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PREVIEW_LIMIT = 10;

interface RecentFilesProps {
  files: DashboardFile[];
}

export function RecentFiles({ files }: RecentFilesProps) {
  const hasMore = files.length > PREVIEW_LIMIT;
  const displayed = hasMore ? files.slice(0, PREVIEW_LIMIT) : files;

  if (files.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">All Files</h2>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 px-6">
          <div className="rounded-full bg-slate-100 p-3 mb-3">
            <FolderOpen className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No files uploaded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload files from any company&apos;s Files tab to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          All Files
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} across all
            companies
          </span>
        </h2>
        {hasMore && (
          <Link
            href="/dashboard/files"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

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
              <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-16" />
            </tr>
          </thead>
          <tbody>
            {displayed.map((file) => (
              <RecentFileRow key={file.id} file={file} />
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <Link
            href="/dashboard/files"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            View all {files.length} files
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
