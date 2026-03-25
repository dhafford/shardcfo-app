import { Download } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { catalogData } from "./catalog-data"

export default function TemplatesPage() {
  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Templates</h1>
      <div className="flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="min-w-[240px]">Analysis / Model Name</TableHead>
              <TableHead className="min-w-[180px]">Category</TableHead>
              <TableHead className="min-w-[300px]">Description</TableHead>
              <TableHead className="min-w-[240px]">Primary Use Case</TableHead>
              <TableHead className="min-w-[240px]">Key Output(s)</TableHead>
              <TableHead className="min-w-[200px]">Prompt</TableHead>
              <TableHead className="min-w-[200px]">Potential Output</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogData.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.id}</TableCell>
                <TableCell className="font-medium whitespace-normal">
                  {entry.xlsxFile ? (
                    <a
                      href={`/api/models?file=${encodeURIComponent(entry.xlsxFile)}`}
                      className="group inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      download
                    >
                      {entry.name}
                      <Download className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ) : (
                    entry.name
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">{entry.category}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground text-xs leading-relaxed">{entry.description}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground text-xs leading-relaxed">{entry.primaryUseCase}</TableCell>
                <TableCell className="whitespace-normal text-xs">{entry.keyOutputs}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
