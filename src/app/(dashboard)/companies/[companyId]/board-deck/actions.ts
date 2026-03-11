"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DECK_TEMPLATES } from "@/lib/constants"
import type { BoardDeckInsert, DeckStatus, Json } from "@/lib/supabase/types"
import type { DeckSection } from "@/components/board-deck/deck-editor"

export async function createDeck(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

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

  const deckInsert: BoardDeckInsert = {
    company_id: companyId,
    title,
    description: description || null,
    template_id: templateId,
    status: "draft" as DeckStatus,
    content: { sections } as unknown as Json,
    created_by: user.id,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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
