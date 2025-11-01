import { type NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ recipeName: string }> }
) {
  try {
    const { recipeName } = await context.params
    const decodedRecipeName = decodeURIComponent(recipeName)
    const { items, itemsWithQuantities, ingredients, servings } = await request.json()

    const servingsText = servings ? ` for ${servings} serving${servings !== 1 ? "s" : ""}` : ""

    const prompt = `Generate a detailed step-by-step recipe checklist for: ${decodedRecipeName}${servingsText}

Available ingredients in pantry: ${items}
Recipe ingredients needed: ${ingredients.join(", ")}

Create a comprehensive recipe with:
1. A list of all ingredients with quantities${servings ? ` (scaled for ${servings} servings)` : ""}
2. Step-by-step cooking instructions formatted as a checklist

Format the response as JSON with this structure:
{
  "ingredients": [
    {"item": "ingredient name", "quantity": "amount", "unit": "unit"}
  ],
  "steps": [
    {"step": 1, "instruction": "detailed instruction text"},
    {"step": 2, "instruction": "detailed instruction text"}
  ]
}

Make it detailed and easy to follow. Provide quantities scaled for ${servings || 4} servings.`

    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2:3b",
        prompt,
        stream: false,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to generate recipe" }, { status: 500 })
    }

    const data = await res.json() as { response?: string }
    const text = data.response || ""

    // Parse the JSON from the model output
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Invalid response format" }, { status: 500 })
    }

    const recipe = JSON.parse(jsonMatch[0])

    // Check ingredient availability against pantry
    if (itemsWithQuantities && Array.isArray(itemsWithQuantities)) {
      const availabilityCheck = {
        allSufficient: true,
        insufficientItems: [] as string[],
      }

      // Helper function to normalize ingredient names for matching
      const normalizeName = (name: string) =>
        name.toLowerCase().trim().replace(/s$/, "")

      // Helper function to convert quantity to number
      const parseQuantity = (qty: string): number => {
        const num = parseFloat(qty.replace(/[^\d.]/g, ""))
        return isNaN(num) ? 0 : num
      }

      // Helper function to categorize unit types
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

      // Helper function to check if units are compatible
      const areUnitsCompatible = (
        recipeUnit: string,
        availableUnit: string
      ): boolean => {
        const recipeType = getUnitType(recipeUnit)
        const availableType = getUnitType(availableUnit)

        // If both are count or both are weight, they're compatible
        if (recipeType === availableType && recipeType !== "unknown") {
          return true
        }

        // If one is count and the other is weight/volume, we assume compatibility
        // (e.g., "2 tomatoes" vs "1 kg tomatoes" - having weight usually means enough count)
        if (
          (recipeType === "count" && (availableType === "weight" || availableType === "volume")) ||
          (availableType === "count" && (recipeType === "weight" || recipeType === "volume"))
        ) {
          return true
        }

        // If units match exactly or are similar
        const recipeNorm = recipeUnit.toLowerCase().trim()
        const availableNorm = availableUnit.toLowerCase().trim()
        if (
          recipeNorm === availableNorm ||
          recipeNorm.includes(availableNorm) ||
          availableNorm.includes(recipeNorm)
        ) {
          return true
        }

        return false
      }

      // Helper function to convert weights to grams for comparison
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
        // Default: assume already in grams or return as-is
        return qty
      }

      // Check each ingredient in the recipe
      recipe.ingredients = recipe.ingredients.map((ingredient: any) => {
        const ingredientName = normalizeName(ingredient.item)
        const neededQty = parseQuantity(ingredient.quantity || "0")

        // Find matching item in pantry (fuzzy match)
        let matchedItem = itemsWithQuantities.find((item: any) => {
          const itemName = normalizeName(item.name)
          return (
            itemName === ingredientName ||
            itemName.includes(ingredientName) ||
            ingredientName.includes(itemName)
          )
        })

        // If no exact match, try partial matching
        if (!matchedItem) {
          matchedItem = itemsWithQuantities.find((item: any) => {
            const itemName = normalizeName(item.name)
            const itemWords = itemName.split(/\s+/)
            const ingredientWords = ingredientName.split(/\s+/)
            return itemWords.some((w: string) => ingredientWords.includes(w)) ||
              ingredientWords.some((w: string) => itemWords.includes(w))
          })
        }

        if (matchedItem) {
          const availableQty = matchedItem.quantity || 0
          const availableUnit = (matchedItem.unit || "").toLowerCase().trim()
          const recipeUnit = (ingredient.unit || "").toLowerCase().trim()

          // Check if units are compatible
          const unitsCompatible = areUnitsCompatible(recipeUnit, availableUnit)
          const recipeUnitType = getUnitType(recipeUnit)
          const availableUnitType = getUnitType(availableUnit)

          let sufficient = false

          if (neededQty === 0) {
            // For items without specific quantities (like "salt to taste")
            sufficient = availableQty > 0
          } else if (unitsCompatible) {
            if (recipeUnitType === availableUnitType && recipeUnitType === "count") {
              // Both are count units - direct comparison
              sufficient = availableQty >= neededQty
            } else if (recipeUnitType === availableUnitType && recipeUnitType === "weight") {
              // Both are weight units - direct comparison (assuming same base unit)
              // Normalize to grams for comparison
              const recipeInGrams = convertToGrams(neededQty, recipeUnit)
              const availableInGrams = convertToGrams(availableQty, availableUnit)
              sufficient = availableInGrams >= recipeInGrams
            } else if (
              recipeUnitType === "count" &&
              (availableUnitType === "weight" || availableUnitType === "volume")
            ) {
              // Recipe needs count, but pantry has weight/volume
              // Assume sufficient if reasonable weight (e.g., 1kg+ is usually enough for a few pieces)
              // Be generous - if someone has 0.5kg+ or any reasonable amount, assume sufficient
              sufficient = availableQty > 0
            } else if (
              (recipeUnitType === "weight" || recipeUnitType === "volume") &&
              availableUnitType === "count"
            ) {
              // Recipe needs weight/volume, but pantry has count
              // This is less common, but if they have a reasonable count, assume sufficient
              // (e.g., 5 tomatoes might be enough for 500g recipe)
              sufficient = availableQty >= neededQty || availableQty >= 2
            } else {
              // Same unit type or unknown - direct comparison
              sufficient = availableQty >= neededQty
            }
          } else {
            // Units not compatible, but item exists - assume sufficient if reasonable quantity
            // (better to be optimistic than to mark everything insufficient)
            sufficient = availableQty > 0
          }

          ingredient.available = availableQty
          ingredient.availableUnit = matchedItem.unit || ""
          ingredient.needed = neededQty
          ingredient.sufficient = sufficient

          if (!sufficient) {
            availabilityCheck.allSufficient = false
            availabilityCheck.insufficientItems.push(ingredient.item)
          }
        } else {
          // Item not found in pantry
          ingredient.available = 0
          ingredient.needed = neededQty
          ingredient.sufficient = false
          availabilityCheck.allSufficient = false
          availabilityCheck.insufficientItems.push(ingredient.item)
        }

        return ingredient
      })

      recipe.availabilityCheck = availabilityCheck
    }

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error("Error generating detailed recipe:", error)
    return NextResponse.json(
      { error: "Failed to generate recipe details" },
      { status: 500 }
    )
  }
}

