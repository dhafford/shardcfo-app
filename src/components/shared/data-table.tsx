"use client"

import { useState, useMemo } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnFormat = "string" | "number" | "currency" | "percentage"

export interface DataTableColumn<T extends Record<string, unknown>> {
  key: keyof T & string
  label: string
  format?: ColumnFormat
  /** Currency code for "currency" format. Defaults to "USD". */
  currency?: string
  /** Number of decimal places for "number" and "percentage" formats. */
  decimalPlaces?: number
  /** Whether this column is sortable. Defaults to true. */
  sortable?: boolean
  /** Optional custom cell renderer. Overrides format if provided. */
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[]
  data: T[]
  /** Row key — must be unique per row. Defaults to row index. */
  rowKey?: (row: T, index: number) => string
  emptyMessage?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Value formatters
// ---------------------------------------------------------------------------

function formatValue(
  value: unknown,
  format: ColumnFormat = "string",
  currency = "USD",
  decimalPlaces = 2
): string {
  if (value === null || value === undefined) return "—"

  switch (format) {
    case "currency": {
      const n = Number(value)
      if (isNaN(n)) return String(value)
      if (Math.abs(n) >= 1_000_000)
        return `$${(n / 1_000_000).toFixed(decimalPlaces)}M`
      if (Math.abs(n) >= 1_000)
        return `$${(n / 1_000).toFixed(decimalPlaces === 2 ? 0 : decimalPlaces)}K`
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(n)
    }
    case "percentage": {
      const n = Number(value)
      if (isNaN(n)) return String(value)
      return `${n.toFixed(decimalPlaces)}%`
    }
    case "number": {
      const n = Number(value)
      if (isNaN(n)) return String(value)
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(n)
    }
    default:
      return String(value)
  }
}

// ---------------------------------------------------------------------------
// Sort direction icon
// ---------------------------------------------------------------------------

function SortIcon({
  direction,
}: {
  direction: "asc" | "desc" | null
}) {
  if (direction === "asc") return <ChevronUp className="w-3.5 h-3.5 shrink-0" />
  if (direction === "desc") return <ChevronDown className="w-3.5 h-3.5 shrink-0" />
  return <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
}

// ---------------------------------------------------------------------------
// DataTable component
// ---------------------------------------------------------------------------

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  emptyMessage = "No data available.",
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const valA = a[sortKey]
      const valB = b[sortKey]

      // Numeric comparison
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA
      }

      // String comparison
      const strA = String(valA ?? "").toLowerCase()
      const strB = String(valB ?? "").toLowerCase()
      const cmp = strA.localeCompare(strB)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const isSortable = col.sortable !== false
              const isActive = sortKey === col.key
              return (
                <TableHead
                  key={col.key}
                  className={isSortable ? "cursor-pointer select-none" : undefined}
                  onClick={isSortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {isSortable && (
                      <SortIcon direction={isActive ? sortDir : null} />
                    )}
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-muted-foreground py-8"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, idx) => {
              const key = rowKey ? rowKey(row, idx) : String(idx)
              return (
                <TableRow key={key}>
                  {columns.map((col) => {
                    const value = row[col.key]
                    const content = col.render
                      ? col.render(value, row)
                      : formatValue(
                          value,
                          col.format,
                          col.currency,
                          col.decimalPlaces
                        )
                    return (
                      <TableCell
                        key={col.key}
                        className={
                          col.format === "number" ||
                          col.format === "currency" ||
                          col.format === "percentage"
                            ? "font-mono tabular-nums text-right"
                            : undefined
                        }
                      >
                        {content}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
