"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Edit2 } from "lucide-react"

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

interface ItemListProps {
  items: InventoryItem[]
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
}

export default function ItemList({ items, onEdit, onDelete }: ItemListProps) {
  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) return { status: "expired", color: "bg-red-50 border-red-200" }
    if (daysUntilExpiry <= 3) return { status: "critical", color: "bg-red-50 border-red-200" }
    if (daysUntilExpiry <= 7) return { status: "warning", color: "bg-amber-50 border-amber-200" }
    return { status: "good", color: "bg-green-50 border-green-200" }
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      vegetables: "bg-green-100 text-green-800",
      fruits: "bg-red-100 text-red-800",
      dairy: "bg-blue-100 text-blue-800",
      meat: "bg-orange-100 text-orange-800",
      pantry: "bg-yellow-100 text-yellow-800",
      frozen: "bg-cyan-100 text-cyan-800",
      other: "bg-gray-100 text-gray-800",
    }
    return colors[category.toLowerCase()] || colors.other
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const { color } = getExpiryStatus(item.expiry_date)
        const expiryDate = new Date(item.expiry_date)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        return (
          <Card key={item.id} className={`border ${color}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-2">
                    <div>
                      <span className="font-medium">Quantity:</span> {item.quantity} {item.unit}
                    </div>
                    <div>
                      <span className="font-medium">Expires:</span> {expiryDate.toLocaleDateString()} ({daysUntilExpiry}{" "}
                      days)
                    </div>
                  </div>
                  {item.notes && <p className="text-sm text-muted-foreground italic">Note: {item.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(item)} className="gap-2">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
