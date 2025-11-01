import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json()

    const prompt = `Based on these kitchen items: ${items}

Generate 3 creative recipe suggestions. For each recipe, provide:
1. Recipe name
2. Key ingredients from the list
3. Brief cooking instructions (1-2 sentences)

Format as JSON array with objects containing: name, ingredients (array), instructions (string)`

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
      return NextResponse.json({ recipes: [] })
    }

    const data = await res.json() as { response?: string }
    const text = data.response || ""

    // Parse the JSON array from the model output
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const recipes = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return NextResponse.json({ recipes })
  } catch (error) {
    console.error("Error generating recipes:", error)
    return NextResponse.json({ recipes: [] })
  }
}
