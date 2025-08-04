"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Plus, LucideTag } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"

const supabase = createClient(
  "https://vnrbidtckiaxljjzmxul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface Tag {
  id: string
  name: string
  category: string
  color: string
}

interface TagSelectorProps {
  tags: Tag[]
  selectedTags: string[]
  onTagsChange: (tagIds: string[]) => void
}

const categoryColors = {
  methodology: "#3B82F6",
  field: "#10B981",
  type: "#F59E0B",
  design: "#EF4444",
  general: "#6B7280",
}

const categories = [
  { value: "methodology", label: "Methodology" },
  { value: "field", label: "Field" },
  { value: "type", label: "Type" },
  { value: "design", label: "Design" },
  { value: "general", label: "General" },
]

export function TagSelector({ tags, selectedTags, onTagsChange }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagCategory, setNewTagCategory] = useState("general")
  const [isCreating, setIsCreating] = useState(false)

  const selectedTagObjects = tags.filter((tag) => selectedTags.includes(tag.id))
  const availableTags = tags.filter((tag) => !selectedTags.includes(tag.id))

  const handleTagSelect = (tagId: string) => {
    onTagsChange([...selectedTags, tagId])
  }

  const handleTagRemove = (tagId: string) => {
    onTagsChange(selectedTags.filter((id) => id !== tagId))
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    setIsCreating(true)
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) {
        toast.error("You must be logged in to create tags")
        return
      }

      const { data, error } = await supabase
        .from("tags")
        .insert({
          name: newTagName.trim(),
          category: newTagCategory,
          color: categoryColors[newTagCategory as keyof typeof categoryColors],
          user_id: currentUser.user.id,
        })
        .select()
        .single()

      if (error) throw error

      toast.success("Tag created successfully")
      setNewTagName("")
      setNewTagCategory("general")
      setIsOpen(false)

      // Add the new tag to selection
      if (data) {
        onTagsChange([...selectedTags, data.id])
      }

      // Refresh tags list (in a real app, you'd update the parent component)
      window.location.reload()
    } catch (error: any) {
      console.error("Error creating tag:", error)
      toast.error("Failed to create tag")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Selected Tags */}
      {selectedTagObjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTagObjects.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              className="flex items-center gap-1"
            >
              <LucideTag className="h-3 w-3" />
              {tag.name}
              <button onClick={() => handleTagRemove(tag.id)} className="ml-1 hover:bg-black/10 rounded-full p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Selector */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
            <Plus className="h-4 w-4 mr-2" />
            Add Tags
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Available Tags</Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagSelect(tag.id)}
                      className="w-full text-left p-2 hover:bg-gray-50 rounded flex items-center gap-2"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm">{tag.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {tag.category}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 p-2">No available tags</p>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Create New Tag</Label>
              <div className="mt-2 space-y-2">
                <Input placeholder="Tag name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                <Select value={newTagCategory} onValueChange={setNewTagCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: categoryColors[category.value as keyof typeof categoryColors] }}
                          />
                          {category.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreating}
                  size="sm"
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create Tag"}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
