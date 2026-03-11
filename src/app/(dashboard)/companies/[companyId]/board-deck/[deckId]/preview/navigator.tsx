"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SlidePreview } from "@/components/board-deck/slide-preview"
import type { DeckSection } from "@/components/board-deck/deck-editor"
import type { CompanyRow } from "@/lib/supabase/types"

interface DeckPreviewNavigatorProps {
  sections: DeckSection[]
  company: CompanyRow
}

export function DeckPreviewNavigator({
  sections,
  company,
}: DeckPreviewNavigatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">
          This deck has no sections. Add sections in the editor.
        </p>
      </div>
    )
  }

  const currentSection = sections[currentIndex]
  const total = sections.length

  function goToPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }

  function goToNext() {
    setCurrentIndex((i) => Math.min(total - 1, i + 1))
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      {/* Slide at full scale — 960×540 */}
      <div className="shadow-2xl rounded-lg overflow-hidden">
        <SlidePreview
          section={currentSection}
          slideNumber={currentIndex + 1}
          totalSlides={total}
          company={company}
          scale={1}
        />
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <span className="text-sm text-slate-400 tabular-nums">
          {currentIndex + 1} / {total}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNext}
          disabled={currentIndex === total - 1}
          className="bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Slide strip thumbnails */}
      <div className="flex gap-2 overflow-x-auto max-w-full pb-1">
        {sections.map((section, idx) => (
          <button
            key={section.id}
            onClick={() => setCurrentIndex(idx)}
            className={`shrink-0 rounded overflow-hidden transition-all ${
              idx === currentIndex
                ? "ring-2 ring-blue-400"
                : "ring-1 ring-slate-600 opacity-60 hover:opacity-90"
            }`}
            title={section.type}
          >
            <SlidePreview
              section={section}
              slideNumber={idx + 1}
              totalSlides={total}
              company={company}
              scale={0.15}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
