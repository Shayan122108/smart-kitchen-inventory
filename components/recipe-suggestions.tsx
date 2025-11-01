"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Loader2, AlertCircle, CheckCircle2, ChefHat, ChevronDown } from "lucide-react"

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  expiry_date: string
  purchase_date: string
  notes: string
  created_at: string
}

interface Recipe {
  name: string
  ingredients: string[]
  instructions: string
}

interface DetailedRecipe {
  ingredients: Array<{
    item: string
    quantity: string
    unit: string
    available?: number
    needed?: number
    sufficient?: boolean
  }>
  steps: Array<{
    step: number
    instruction: string
  }>
  availabilityCheck?: {
    allSufficient: boolean
    insufficientItems: string[]
  }
}

interface CheckedState {
  [key: number]: boolean
}

export default function RecipeSuggestions({
  items,
  onItemsUpdated,
}: {
  items: InventoryItem[]
  onItemsUpdated?: () => void
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [detailedRecipe, setDetailedRecipe] = useState<DetailedRecipe | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState<CheckedState>({})
  const [servings, setServings] = useState<string>("4")
  const [showServingsForm, setShowServingsForm] = useState(true)
  const [consuming, setConsuming] = useState(false)
  const [consumed, setConsumed] = useState(false)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<string>>(
    new Set(items.map((item) => item.id))
  )
  const [isSelectingIngredients, setIsSelectingIngredients] = useState(false)

  useEffect(() => {
    // Initialize selected ingredients to all items when items change
    if (items.length > 0) {
      setSelectedIngredientIds(new Set(items.map((item) => item.id)))
      generateRecipes()
    }
  }, [items])

  // Generate recipes when selected ingredients change
  useEffect(() => {
    if (selectedIngredientIds.size > 0) {
      generateRecipes()
    }
  }, [selectedIngredientIds])

  const generateRecipes = async () => {
    if (selectedIngredientIds.size === 0) {
      setRecipes([])
      return
    }

    setLoading(true)
    try {
      const selectedItems = items.filter((item) => selectedIngredientIds.has(item.id))
      const itemNames = selectedItems.map((item) => item.name).join(", ")
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemNames }),
      })
      const data = await response.json()
      setRecipes(data.recipes || [])
    } catch (error) {
      console.error("Error generating recipes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleIngredientToggle = (itemId: string) => {
    setSelectedIngredientIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedIngredientIds(new Set(items.map((item) => item.id)))
  }

  const handleClearAll = () => {
    setSelectedIngredientIds(new Set())
  }

  const handleRecipeClick = async (recipe: Recipe) => {
    setSelectedRecipe(recipe)
    setShowServingsForm(true)
    setCheckedSteps({})
    setDetailedRecipe(null)
    setServings("4")
  }

  const handleServingsSubmit = async () => {
    if (!selectedRecipe || !servings || parseInt(servings) < 1) return

    setLoadingDetail(true)
    setShowServingsForm(false)
    setCheckedSteps({})
    setDetailedRecipe(null)

    try {
      const selectedItems = items.filter((item) => selectedIngredientIds.has(item.id))
      const itemNames = selectedItems.map((item) => item.name).join(", ")
      const itemsWithQuantities = items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }))
      const encodedName = encodeURIComponent(selectedRecipe.name)
      const response = await fetch(`/api/recipes/${encodedName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemNames,
          itemsWithQuantities,
          ingredients: selectedRecipe.ingredients,
          servings: parseInt(servings),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch recipe details")
      }

      const data = await response.json()
      setDetailedRecipe(data.recipe)
    } catch (error) {
      console.error("Error fetching recipe details:", error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleStepToggle = (stepNumber: number) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }))
  }

  const handleCloseModal = () => {
    setSelectedRecipe(null)
    setDetailedRecipe(null)
    setCheckedSteps({})
    setShowServingsForm(true)
    setServings("4")
    setConsumed(false)
  }

  const handleConsumeRecipe = async () => {
    if (!detailedRecipe || consuming) return

    setConsuming(true)
    try {
      const response = await fetch("/api/recipes/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: detailedRecipe.ingredients,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to consume ingredients")
      }

      const data = await response.json()
      setConsumed(true)

      // Refresh items in parent component
      if (onItemsUpdated) {
        onItemsUpdated()
      }

      // Also refresh recipes to reflect updated inventory
      if (items.length > 0) {
        generateRecipes()
      }
    } catch (error) {
      console.error("Error consuming recipe:", error)
      alert("Failed to update pantry. Please try again.")
    } finally {
      setConsuming(false)
    }
  }

  const selectedItems = items.filter((item) => selectedIngredientIds.has(item.id))

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg">Recipe Ideas</CardTitle>
        <CardDescription>
          {selectedIngredientIds.size === items.length
            ? "Based on all your items"
            : `Based on ${selectedIngredientIds.size} selected item${selectedIngredientIds.size !== 1 ? "s" : ""}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ingredient Selection Section */}
        <Collapsible open={isSelectingIngredients} onOpenChange={setIsSelectingIngredients}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setIsSelectingIngredients(!isSelectingIngredients)}
            >
              <span className="flex items-center gap-2">
                <ChefHat className="w-4 h-4" />
                Select Ingredients for Today
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${isSelectingIngredients ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex-1"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="flex-1"
              >
                Clear All
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items available
                </p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedIngredientIds.has(item.id)}
                      onCheckedChange={() => handleIngredientToggle(item.id)}
                    />
                    <label
                      className="flex-1 cursor-pointer text-sm flex items-center gap-2"
                      onClick={() => handleIngredientToggle(item.id)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.quantity} {item.unit}
                      </span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedIngredientIds.size} of {items.length} ingredients selected
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Recipe Suggestions */}
        <div className="pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          </div>
        ) : selectedIngredientIds.size === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">No ingredients selected</p>
            <p className="text-xs text-muted-foreground">
              Select ingredients above to get recipe suggestions
            </p>
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              No recipe suggestions available
            </p>
            <p className="text-xs text-muted-foreground">
              Try selecting different ingredients
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recipes.map((recipe, idx) => (
              <div
                key={idx}
                className="border-l-4 border-green-500 pl-3 py-2 cursor-pointer hover:bg-muted/50 rounded-r transition-colors"
                onClick={() => handleRecipeClick(recipe)}
              >
                <h4 className="font-semibold text-sm mb-1">{recipe.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{recipe.instructions}</p>
              </div>
            ))}
          </div>
        )}
        </div>
      </CardContent>

      <Dialog open={!!selectedRecipe} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 rounded-none p-6 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedRecipe?.name}</DialogTitle>
            <DialogDescription className="text-base">
              Detailed recipe with step-by-step instructions
            </DialogDescription>
          </DialogHeader>

          {showServingsForm ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">How many servings?</h3>
                <p className="text-muted-foreground">
                  We'll check if you have enough ingredients in your pantry
                </p>
              </div>
              <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                <Input
                  type="number"
                  min="1"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="Number of servings"
                  className="text-center text-lg h-12"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleServingsSubmit()
                    }
                  }}
                />
                <Button
                  onClick={handleServingsSubmit}
                  disabled={!servings || parseInt(servings) < 1}
                  className="w-full"
                  size="lg"
                >
                  Generate Recipe
                </Button>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating detailed recipe...
              </span>
            </div>
          ) : detailedRecipe ? (
            <div className="space-y-6 py-4">
              {/* Availability Alert */}
              {detailedRecipe.availabilityCheck && (
                <Alert
                  variant={
                    detailedRecipe.availabilityCheck.allSufficient
                      ? "default"
                      : "destructive"
                  }
                >
                  {detailedRecipe.availabilityCheck.allSufficient ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>All ingredients available</AlertTitle>
                      <AlertDescription>
                        You have enough ingredients in your pantry for {servings} serving
                        {parseInt(servings) !== 1 ? "s" : ""}!
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Insufficient ingredients</AlertTitle>
                      <AlertDescription>
                        You may not have enough:{" "}
                        {detailedRecipe.availabilityCheck.insufficientItems.join(", ")}
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}

              {/* Ingredients Section */}
              <div>
                <h3 className="font-semibold text-xl mb-4">Ingredients (for {servings} servings)</h3>
                <ul className="space-y-3">
                  {detailedRecipe.ingredients.map((ingredient, idx) => (
                    <li
                      key={idx}
                      className={`text-base flex items-center gap-3 p-2 rounded-lg ${
                        ingredient.sufficient === false
                          ? "bg-destructive/10 border border-destructive/20"
                          : ""
                      }`}
                    >
                      {ingredient.sufficient === false ? (
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                      ) : ingredient.sufficient === true ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                      )}
                      <span className="flex-1">
                        <span className="font-medium">{ingredient.item}</span>
                        {ingredient.quantity && (
                          <span className="text-muted-foreground">
                            {" "}
                            - {ingredient.quantity}
                            {ingredient.unit ? ` ${ingredient.unit}` : ""}
                          </span>
                        )}
                        {ingredient.available !== undefined && (
                          <span
                            className={`ml-2 text-sm ${
                              ingredient.sufficient === false
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            (You have: {ingredient.available}
                            {ingredient.unit ? ` ${ingredient.unit}` : ""}
                            {ingredient.needed !== undefined &&
                              `, Need: ${ingredient.needed}${ingredient.unit ? ` ${ingredient.unit}` : ""}`}
                            )
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps Section */}
              <div>
                <h3 className="font-semibold text-xl mb-4">Instructions</h3>
                <div className="space-y-3">
                  {detailedRecipe.steps.map((step) => (
                    <div
                      key={step.step}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={checkedSteps[step.step] || false}
                        onCheckedChange={() => handleStepToggle(step.step)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <label
                          className="text-base cursor-pointer flex items-start gap-2"
                          onClick={() => handleStepToggle(step.step)}
                        >
                          <span className="font-medium text-green-600 min-w-[3rem]">
                            Step {step.step}:
                          </span>
                          <span
                            className={
                              checkedSteps[step.step]
                                ? "line-through text-muted-foreground"
                                : ""
                            }
                          >
                            {step.instruction}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consume Recipe Button */}
              <div className="pt-6 border-t">
                {consumed ? (
                  <Alert variant="default">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Recipe ingredients consumed!</AlertTitle>
                    <AlertDescription>
                      Quantities have been subtracted from your pantry.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Button
                    onClick={handleConsumeRecipe}
                    disabled={consuming || !detailedRecipe}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    {consuming ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Updating pantry...
                      </>
                    ) : (
                      <>
                        <ChefHat className="w-5 h-5 mr-2" />
                        I'm making this recipe
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load recipe details. Please try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
