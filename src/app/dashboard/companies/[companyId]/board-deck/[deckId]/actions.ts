"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { DeckStatus, Json } from "@/lib/supabase/types"
import type { DeckSection } from "@/components/board-deck/deck-editor"

const VALID_DECK_STATUSES: DeckStatus[] = ["draft", "review", "final", "presented"]

// ---------------------------------------------------------------------------
// updateDeck
// Updates top-level deck fields and/or the full sections array.
// ---------------------------------------------------------------------------

export async function updateDeck(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const deckId = formData.get("deckId") as string
  const companyId = formData.get("companyId") as string

  if (!deckId || !companyId) {
    return { success: false, error: "deckId and companyId are required" }
  }

  const updates: Record<string, unknown> = {}

  const title = formData.get("title") as string | null
  if (title) updates.title = title

  const status = formData.get("status") as string | null
  if (status && VALID_DECK_STATUSES.includes(status as DeckStatus)) {
    updates.status = status
  }

  const sectionsJson = formData.get("sections") as string | null
  if (sectionsJson) {
    try {
      const sections = JSON.parse(sectionsJson) as DeckSection[]
      updates.sections = sections as unknown as Json
    } catch {
      return { success: false, error: "Invalid sections JSON" }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("board_decks")
    .update(updates)
    .eq("id", deckId)
    .eq("company_id", companyId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/companies/${companyId}/board-deck`)
  revalidatePath(`/dashboard/companies/${companyId}/board-deck/${deckId}`)

  return { success: true }
}

// ---------------------------------------------------------------------------
// addSection
// Appends a new section to the deck's sections array.
// ---------------------------------------------------------------------------

export async function addSection(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const deckId = formData.get("deckId") as string
  const companyId = formData.get("companyId") as string
  const sectionType = formData.get("sectionType") as string
  const sectionId = (formData.get("sectionId") as string) || crypto.randomUUID()

  if (!deckId || !companyId || !sectionType) {
    return { success: false, error: "deckId, companyId, and sectionType are required" }
  }

  // Fetch current deck sections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deck, error: fetchError } = await (supabase as any)
    .from("board_decks")
    .select("sections")
    .eq("id", deckId)
    .eq("company_id", companyId)
    .single()

  if (fetchError || !deck) {
    return { success: false, error: fetchError?.message ?? "Deck not found" }
  }

  const sections = Array.isArray(deck.sections)
    ? (deck.sections as DeckSection[])
    : []

  const newSection: DeckSection = {
    id: sectionId,
    type: sectionType,
    config: {},
    order: sections.length,
  }

  const updated = [...sections, newSection]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("board_decks")
    .update({ sections: updated as unknown as Json })
    .eq("id", deckId)
    .eq("company_id", companyId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath(`/dashboard/companies/${companyId}/board-deck/${deckId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// removeSection
// Removes a section by id and re-indexes order.
// ---------------------------------------------------------------------------

export async function removeSection(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const deckId = formData.get("deckId") as string
  const companyId = formData.get("companyId") as string
  const sectionId = formData.get("sectionId") as string

  if (!deckId || !companyId || !sectionId) {
    return { success: false, error: "deckId, companyId, and sectionId are required" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deck, error: fetchError } = await (supabase as any)
    .from("board_decks")
    .select("sections")
    .eq("id", deckId)
    .eq("company_id", companyId)
    .single()

  if (fetchError || !deck) {
    return { success: false, error: fetchError?.message ?? "Deck not found" }
  }

  const sections = Array.isArray(deck.sections)
    ? (deck.sections as DeckSection[])
    : []

  const filtered = sections
    .filter((s) => s.id !== sectionId)
    .map((s, i) => ({ ...s, order: i }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("board_decks")
    .update({ sections: filtered as unknown as Json })
    .eq("id", deckId)
    .eq("company_id", companyId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath(`/dashboard/companies/${companyId}/board-deck/${deckId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// reorderSections
// Accepts an array of section ids in the desired order and persists new order.
// ---------------------------------------------------------------------------

export async function reorderSections(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const deckId = formData.get("deckId") as string
  const companyId = formData.get("companyId") as string
  const orderedIdsJson = formData.get("orderedIds") as string

  if (!deckId || !companyId || !orderedIdsJson) {
    return { success: false, error: "deckId, companyId, and orderedIds are required" }
  }

  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(orderedIdsJson) as string[]
  } catch {
    return { success: false, error: "Invalid orderedIds JSON" }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deck, error: fetchError } = await (supabase as any)
    .from("board_decks")
    .select("sections")
    .eq("id", deckId)
    .eq("company_id", companyId)
    .single()

  if (fetchError || !deck) {
    return { success: false, error: fetchError?.message ?? "Deck not found" }
  }

  const sections = Array.isArray(deck.sections)
    ? (deck.sections as DeckSection[])
    : []

  // Map sections by id for fast lookup
  const sectionMap = new Map(sections.map((s) => [s.id, s]))

  const reordered = orderedIds
    .map((id, index) => {
      const section = sectionMap.get(id)
      if (!section) return null
      return { ...section, order: index }
    })
    .filter((s): s is DeckSection => s !== null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("board_decks")
    .update({ sections: reordered as unknown as Json })
    .eq("id", deckId)
    .eq("company_id", companyId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath(`/dashboard/companies/${companyId}/board-deck/${deckId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// generatePdf
// Returns the preview URL for the client to open/print as PDF.
// ---------------------------------------------------------------------------

export async function generatePdf(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const deckId = formData.get("deckId") as string
  const companyId = formData.get("companyId") as string

  if (!deckId || !companyId) {
    return { success: false, error: "deckId and companyId are required" }
  }

  const previewUrl = `/dashboard/companies/${companyId}/board-deck/${deckId}/preview`
  return { success: true, url: previewUrl }
}

// ---------------------------------------------------------------------------
// generatePptx
// Returns the API endpoint URL for the client to trigger a PPTX download.
// ---------------------------------------------------------------------------

export async function generatePptx(
  formData: FormData
): Promise<{ success: boolean; apiUrl?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const deckId = formData.get("deckId") as string
  const companyId = formData.get("companyId") as string

  if (!deckId || !companyId) {
    return { success: false, error: "deckId and companyId are required" }
  }

  const apiUrl = `/api/generate-pptx?deckId=${deckId}&companyId=${companyId}`
  return { success: true, apiUrl }
}
