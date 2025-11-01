import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handle cookie setting errors
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { ingredients } = await request.json()

    if (!ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json(
        { error: "Invalid ingredients data" },
        { status: 400 }
      )
    }

    // Get all user's inventory items
    const { data: allItems, error: fetchError } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", user.id)

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      )
    }

    // Helper function to normalize ingredient names
    const normalizeName = (name: string) =>
      name.toLowerCase().trim().replace(/s$/, "")

    // Helper function to parse quantity
    const parseQuantity = (qty: string): number => {
      const num = parseFloat(qty.replace(/[^\d.]/g, ""))
      return isNaN(num) ? 0 : num
    }

    // Helper function to get unit type
    const getUnitType = (unit: string): "count" | "weight" | "volume" | "unknown" => {
      const normalized = unit.toLowerCase().trim()
      if (
        normalized === "" ||
        normalized === "piece" ||
        normalized === "pieces" ||
        normalized === "pcs" ||
        normalized === "pc" ||
        normalized === "unit" ||
        normalized === "units" ||
        /^(item|items|whole|wholes)$/.test(normalized)
      ) {
        return "count"
      }
      if (
        normalized.includes("kg") ||
        normalized.includes("kilogram") ||
        normalized.includes("g") ||
        normalized.includes("gram") ||
        normalized.includes("lb") ||
        normalized.includes("pound") ||
        normalized.includes("oz") ||
        normalized.includes("ounce")
      ) {
        return "weight"
      }
      if (
        normalized.includes("l") ||
        normalized.includes("liter") ||
        normalized.includes("ml") ||
        normalized.includes("milliliter") ||
        normalized.includes("cup") ||
        normalized.includes("tbsp") ||
        normalized.includes("tsp")
      ) {
        return "volume"
      }
      return "unknown"
    }

    // Helper function to convert to grams
    const convertToGrams = (qty: number, unit: string): number => {
      const normalized = unit.toLowerCase().trim()
      if (normalized.includes("kg") || normalized.includes("kilogram")) {
        return qty * 1000
      }
      if (normalized.includes("g") || normalized.includes("gram")) {
        return qty
      }
      if (normalized.includes("lb") || normalized.includes("pound")) {
        return qty * 453.592
      }
      if (normalized.includes("oz") || normalized.includes("ounce")) {
        return qty * 28.3495
      }
      return qty
    }

    // Helper function to convert from grams
    const convertFromGrams = (grams: number, targetUnit: string): number => {
      const normalized = targetUnit.toLowerCase().trim()
      if (normalized.includes("kg") || normalized.includes("kilogram")) {
        return grams / 1000
      }
      if (normalized.includes("g") || normalized.includes("gram")) {
        return grams
      }
      if (normalized.includes("lb") || normalized.includes("pound")) {
        return grams / 453.592
      }
      if (normalized.includes("oz") || normalized.includes("ounce")) {
        return grams / 28.3495
      }
      return grams
    }

    const updatedItems: any[] = []
    const deletedItems: string[] = []

    // Process each ingredient from the recipe
    for (const ingredient of ingredients) {
      const ingredientName = normalizeName(ingredient.item)
      const neededQty = parseQuantity(ingredient.quantity || "0")
      const recipeUnit = (ingredient.unit || "").toLowerCase().trim()

      // Find matching item in pantry
      let matchedItem = allItems?.find((item: any) => {
        const itemName = normalizeName(item.name)
        return (
          itemName === ingredientName ||
          itemName.includes(ingredientName) ||
          ingredientName.includes(itemName)
        )
      })

      // Try partial matching if no exact match
      if (!matchedItem) {
        matchedItem = allItems?.find((item: any) => {
          const itemName = normalizeName(item.name)
          const itemWords = itemName.split(/\s+/)
          const ingredientWords = ingredientName.split(/\s+/)
          return (
            itemWords.some((w: string) => ingredientWords.includes(w)) ||
            ingredientWords.some((w: string) => itemWords.includes(w))
          )
        })
      }

      if (matchedItem && neededQty > 0) {
        const availableQty = matchedItem.quantity || 0
        const availableUnit = (matchedItem.unit || "").toLowerCase().trim()
        const recipeUnitType = getUnitType(recipeUnit)
        const availableUnitType = getUnitType(availableUnit)

        let quantityToSubtract = 0
        let newQuantity = availableQty

        if (recipeUnitType === availableUnitType && recipeUnitType === "count") {
          // Both count - simple subtraction
          quantityToSubtract = Math.min(neededQty, availableQty)
          newQuantity = availableQty - quantityToSubtract
        } else if (recipeUnitType === availableUnitType && recipeUnitType === "weight") {
          // Both weight - convert to grams, subtract, convert back
          const neededInGrams = convertToGrams(neededQty, recipeUnit)
          const availableInGrams = convertToGrams(availableQty, availableUnit)
          const subtractInGrams = Math.min(neededInGrams, availableInGrams)
          newQuantity = convertFromGrams(availableInGrams - subtractInGrams, availableUnit)
        } else if (recipeUnitType === "count" && availableUnitType === "weight") {
          // Recipe needs count, pantry has weight - estimate and subtract a reasonable amount
          // Assume average weight per piece (e.g., 1 tomato ≈ 150g)
          const avgWeightPerPiece = 150 // grams
          const neededInGrams = neededQty * avgWeightPerPiece
          const availableInGrams = convertToGrams(availableQty, availableUnit)
          const subtractInGrams = Math.min(neededInGrams, availableInGrams)
          newQuantity = convertFromGrams(availableInGrams - subtractInGrams, availableUnit)
        } else {
          // Other cases - subtract needed quantity if units match approximately
          if (recipeUnit === availableUnit || !recipeUnit || !availableUnit) {
            quantityToSubtract = Math.min(neededQty, availableQty)
            newQuantity = availableQty - quantityToSubtract
          } else {
            // Can't match units, subtract a small amount as estimate
            newQuantity = Math.max(0, availableQty - neededQty * 0.1)
          }
        }

        // Update or delete the item
        if (newQuantity <= 0.001) {
          // Delete item if quantity is effectively zero
          const { error: deleteError } = await supabase
            .from("inventory_items")
            .delete()
            .eq("id", matchedItem.id)
            .eq("user_id", user.id)

          if (!deleteError) {
            deletedItems.push(matchedItem.id)
          }
        } else {
          // Update item with new quantity
          const { error: updateError } = await supabase
            .from("inventory_items")
            .update({
              quantity: Math.round(newQuantity * 1000) / 1000, // Round to 3 decimal places
            })
            .eq("id", matchedItem.id)
            .eq("user_id", user.id)

          if (!updateError) {
            updatedItems.push({
              id: matchedItem.id,
              name: matchedItem.name,
              newQuantity: Math.round(newQuantity * 1000) / 1000,
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedItems.length,
      deleted: deletedItems.length,
      updatedItems,
      deletedItems,
    })
  } catch (error) {
    console.error("Error consuming ingredients:", error)
    return NextResponse.json(
      { error: "Failed to consume ingredients" },
      { status: 500 }
    )
  }
}

