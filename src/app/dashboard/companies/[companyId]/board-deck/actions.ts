"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/supabase/require-auth"
import { DECK_TEMPLATES } from "@/lib/constants"
import type { Json } from "@/lib/supabase/types"
import type { DeckSection } from "@/components/board-deck/deck-editor"

export async function createDeck(formData: FormData) {
  const { supabase } = await requireAuth()

  const companyId = formData.get("companyId") as string
  const title = formData.get("title") as string
  const templateId = (formData.get("templateId") as string) || "standard"
  const description = formData.get("description") as string | null

  if (!companyId || !title) {
    throw new Error("Company ID and title are required")
  }

  const template = DECK_TEMPLATES.find((t) => t.id === templateId)
  const sections: DeckSection[] = template
    ? template.sections.map((sectionType, index) => ({
        id: crypto.randomUUID(),
        type: sectionType,
        config: {},
        order: index,
      }))
    : []

  const now = new Date().toISOString().split("T")[0]
  const deckInsert = {
    company_id: companyId,
    title,
    period_start: now,
    period_end: now,
    template_key: templateId,
    status: "draft",
    sections: sections as unknown as Json,
  }

  const { data, error } = await supabase
    .from("board_decks")
    .insert(deckInsert)
    .select("id")
    .single()

  if (error) {
    throw new Error(`Failed to create deck: ${error.message}`)
  }

  revalidatePath(`/dashboard/companies/${companyId}/board-deck`)
  redirect(`/dashboard/companies/${companyId}/board-deck/${data.id}`)
}
