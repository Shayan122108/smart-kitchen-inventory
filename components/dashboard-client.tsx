"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Plus, LogOut } from "lucide-react"
import ItemList from "@/components/item-list"
import AddItemModal from "@/components/add-item-modal"
import RecipeSuggestions from "@/components/recipe-suggestions"
import { useRouter } from "next/navigation"

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

export default function DashboardClient({ userId }: { userId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const router = useRouter()

  const supabase = createClient()

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/items")
      const data = await response.json()
      setItems(data)
    } catch (error) {
      console.error("Error fetching items:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const handleAddItem = async (itemData: Omit<InventoryItem, "id" | "created_at">) => {
    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      })
      if (response.ok) {
        await fetchItems()
        setShowAddModal(false)
      }
    } catch (error) {
      console.error("Error adding item:", error)
    }
  }

  const handleUpdateItem = async (itemData: Omit<InventoryItem, "id" | "created_at">) => {
    if (!selectedItem) return
    try {
      const response = await fetch(`/api/items/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      })
      if (response.ok) {
        await fetchItems()
        setSelectedItem(null)
        setShowAddModal(false)
      }
    } catch (error) {
      console.error("Error updating item:", error)
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`/api/items/${id}`, { method: "DELETE" })
      if (response.ok) {
        await fetchItems()
      }
    } catch (error) {
      console.error("Error deleting item:", error)
    }
  }

  const expiringItems = items.filter((item) => {
    const expiryDate = new Date(item.expiry_date)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  })

  const expiredItems = items.filter((item) => {
    const expiryDate = new Date(item.expiry_date)
    const today = new Date()
    return expiryDate < today
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <header className="bg-white border-b border-green-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-green-700">Kitchen Inventory</h1>
            <p className="text-sm text-muted-foreground">Track your perishable items</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{items.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{expiringItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Within 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{expiredItems.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {expiredItems.length > 0 && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Expired Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-800">
                You have {expiredItems.length} expired item{expiredItems.length !== 1 ? "s" : ""}. Please remove them.
              </p>
            </CardContent>
          </Card>
        )}

        {expiringItems.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Items Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-800">
                {expiringItems.length} item{expiringItems.length !== 1 ? "s" : ""} will expire within 7 days.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Your Items</h2>
              <Button
                onClick={() => {
                  setSelectedItem(null)
                  setShowAddModal(true)
                }}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading items...</p>
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No items yet. Start by adding your first item!</p>
                  <Button
                    onClick={() => {
                      setSelectedItem(null)
                      setShowAddModal(true)
                    }}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ItemList
                items={items}
                onEdit={(item) => {
                  setSelectedItem(item)
                  setShowAddModal(true)
                }}
                onDelete={handleDeleteItem}
              />
            )}
          </div>

          {/* Recipe Suggestions Sidebar */}
          <div>
            <RecipeSuggestions items={items} />
          </div>
        </div>
      </main>

      {/* Add/Edit Item Modal */}
      {showAddModal && (
        <AddItemModal
          item={selectedItem}
          onClose={() => {
            setShowAddModal(false)
            setSelectedItem(null)
          }}
          onSave={selectedItem ? handleUpdateItem : handleAddItem}
        />
      )}
    </div>
  )
}
