"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

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

export default function RecipeSuggestions({ items }: { items: InventoryItem[] }) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (items.length > 0) {
      generateRecipes()
    }
  }, [items])

  const generateRecipes = async () => {
    setLoading(true)
    try {
      const itemNames = items.map((item) => item.name).join(", ")
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

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg">Recipe Ideas</CardTitle>
        <CardDescription>Based on your items</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-green-600" />
          </div>
        ) : recipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add items to get recipe suggestions</p>
        ) : (
          <div className="space-y-4">
            {recipes.map((recipe, idx) => (
              <div key={idx} className="border-l-4 border-green-500 pl-3 py-2">
                <h4 className="font-semibold text-sm mb-1">{recipe.name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{recipe.instructions}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
