"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SectionLibrary } from "@/components/board-deck/section-library"
import { SlidePreview } from "@/components/board-deck/slide-preview"
import { SectionConfig } from "@/components/board-deck/section-config"
import { updateDeck, addSection, removeSection, reorderSections } from "@/app/dashboard/companies/[companyId]/board-deck/[deckId]/actions"
import { SECTION_TYPE_DEFINITIONS } from "@/lib/constants"
import type { BoardDeckRow, CompanyRow } from "@/lib/supabase/types"

export interface DeckSection {
  id: string
  type: string
  config: Record<string, unknown>
  order: number
}

interface DeckEditorProps {
  deck: BoardDeckRow
  company: CompanyRow
  initialSections: DeckSection[]
}

export function DeckEditor({ deck, company, initialSections }: DeckEditorProps) {
  const [sections, setSections] = useState<DeckSection[]>(
    [...initialSections].sort((a, b) => a.order - b.order)
  )
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    initialSections[0]?.id ?? null
  )
  const [showLibrary, setShowLibrary] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null

  const handleMoveUp = useCallback(
    async (id: string) => {
      const idx = sections.findIndex((s) => s.id === id)
      if (idx <= 0) return
      const next = [...sections]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      const reordered = next.map((s, i) => ({ ...s, order: i }))
      setSections(reordered)
      const formData = new FormData()
      formData.append("deckId", deck.id)
      formData.append("companyId", deck.company_id)
      formData.append("orderedIds", JSON.stringify(reordered.map((s) => s.id)))
      await reorderSections(formData)
    },
    [sections, deck.id, deck.company_id]
  )

  const handleMoveDown = useCallback(
    async (id: string) => {
      const idx = sections.findIndex((s) => s.id === id)
      if (idx >= sections.length - 1) return
      const next = [...sections]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      const reordered = next.map((s, i) => ({ ...s, order: i }))
      setSections(reordered)
      const formData = new FormData()
      formData.append("deckId", deck.id)
      formData.append("companyId", deck.company_id)
      formData.append("orderedIds", JSON.stringify(reordered.map((s) => s.id)))
      await reorderSections(formData)
    },
    [sections, deck.id, deck.company_id]
  )

  const handleRemove = useCallback(
    async (id: string) => {
      const next = sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }))
      setSections(next)
      if (selectedSectionId === id) {
        setSelectedSectionId(next[0]?.id ?? null)
      }
      const formData = new FormData()
      formData.append("deckId", deck.id)
      formData.append("companyId", deck.company_id)
      formData.append("sectionId", id)
      const result = await removeSection(formData)
      if (!result.success) {
        toast.error("Failed to remove section")
        setSections(sections)
      }
    },
    [sections, selectedSectionId, deck.id, deck.company_id]
  )

  const handleAddSection = useCallback(
    async (type: string) => {
      const newSection: DeckSection = {
        id: crypto.randomUUID(),
        type,
        config: {},
        order: sections.length,
      }
      setSections((prev) => [...prev, newSection])
      setSelectedSectionId(newSection.id)
      setShowLibrary(false)

      const formData = new FormData()
      formData.append("deckId", deck.id)
      formData.append("companyId", deck.company_id)
      formData.append("sectionType", type)
      formData.append("sectionId", newSection.id)
      const result = await addSection(formData)
      if (!result.success) {
        toast.error("Failed to add section")
        setSections((prev) => prev.filter((s) => s.id !== newSection.id))
      } else {
        toast.success("Section added")
      }
    },
    [sections, deck.id, deck.company_id]
  )

  const handleConfigChange = useCallback(
    (id: string, config: Record<string, unknown>) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, config } : s))
      )
    },
    []
  )

  const handleSave = async () => {
    setIsSaving(true)
    const formData = new FormData()
    formData.append("deckId", deck.id)
    formData.append("companyId", deck.company_id)
    formData.append("sections", JSON.stringify(sections))
    const result = await updateDeck(formData)
    setIsSaving(false)
    if (result.success) {
      toast.success("Deck saved")
    } else {
      toast.error("Failed to save deck")
    }
  }

  const sectionDef = (type: string) =>
    SECTION_TYPE_DEFINITIONS.find((d) => d.type === type)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: section list */}
      <div className="w-64 shrink-0 flex flex-col border-r bg-white overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sections
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setShowLibrary(!showLibrary)}
            title="Add section"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showLibrary && (
          <div className="border-b bg-slate-50">
            <SectionLibrary onAdd={handleAddSection} />
          </div>
        )}

        <div className="flex-1 p-2 space-y-1">
          {sections.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              No sections yet. Add sections from the library above.
            </p>
          )}
          {sections.map((section, idx) => {
            const def = sectionDef(section.type)
            const isSelected = section.id === selectedSectionId
            return (
              <div
                key={section.id}
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-slate-50 text-foreground"
                }`}
                onClick={() => setSelectedSectionId(section.id)}
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0 tabular-nums">
                  {idx + 1}
                </span>
                <span className="flex-1 text-xs font-medium truncate">
                  {def?.label ?? section.type}
                </span>
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveUp(section.id)
                    }}
                    disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMoveDown(section.id)
                    }}
                    disabled={idx === sections.length - 1}
                    className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(section.id)
                    }}
                    className="p-0.5 rounded hover:bg-red-100 text-red-500"
                    title="Remove section"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t">
          <Button
            className="w-full"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Deck"}
          </Button>
        </div>
      </div>

      {/* Center panel: preview */}
      <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
        {sections.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="max-w-sm w-full">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Add sections from the panel on the left to start building your deck.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {sections.map((section, idx) => (
              <div
                key={section.id}
                className={`cursor-pointer rounded-lg transition-all ${
                  section.id === selectedSectionId
                    ? "ring-2 ring-blue-500"
                    : "ring-1 ring-slate-200 hover:ring-slate-300"
                }`}
                onClick={() => setSelectedSectionId(section.id)}
              >
                <SlidePreview
                  section={section}
                  slideNumber={idx + 1}
                  totalSlides={sections.length}
                  company={company}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: config */}
      <div className="w-72 shrink-0 border-l bg-white overflow-y-auto">
        {selectedSection ? (
          <SectionConfig
            section={selectedSection}
            onChange={(config) => handleConfigChange(selectedSection.id, config)}
          />
        ) : (
          <div className="flex items-center justify-center h-full p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Select a section to configure it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
