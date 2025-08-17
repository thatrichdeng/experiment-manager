"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, X } from "lucide-react"
import type { Tag } from "@/lib/types"

interface TagSelectorProps {
  availableTags: Tag[]
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  onCreateTag: (tag: { name: string; category: string; color: string }) => Promise<Tag | null>
  getCategoryIcon: (category: string) => React.ReactNode
}

export default function TagSelector({
  availableTags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  getCategoryIcon,
}: TagSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [newTagForm, setNewTagForm] = useState({
    name: "",
    category: "other" as const,
    color: "#3B82F6",
  })

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter tags based on search term
  const filteredTags = availableTags.filter((tag) => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))

  // Check if search term matches any existing tag exactly
  const exactMatch = availableTags.find((tag) => tag.name.toLowerCase() === searchTerm.toLowerCase().trim())

  // Show create option if there's a search term and no exact match
  const showCreateOption = searchTerm.trim() && !exactMatch

  const handleTagToggle = (tagId: string) => {
    const newSelectedIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]
    onTagsChange(newSelectedIds)
  }

  const handleCreateTag = async () => {
    if (!newTagForm.name.trim()) return

    setCreatingTag(true)
    try {
      const createdTag = await onCreateTag({
        name: newTagForm.name.trim(),
        category: newTagForm.category,
        color: newTagForm.color,
      })

      if (createdTag) {
        // Add the new tag to selection
        onTagsChange([...selectedTagIds, createdTag.id])

        // Reset form
        setNewTagForm({
          name: "",
          category: "other",
          color: "#3B82F6",
        })
        setSearchTerm("")
        setShowCreateForm(false)
      }
    } catch (error) {
      console.error("Error creating tag:", error)
    } finally {
      setCreatingTag(false)
    }
  }

  const handleQuickCreate = async () => {
    if (!searchTerm.trim()) return

    setCreatingTag(true)
    try {
      const createdTag = await onCreateTag({
        name: searchTerm.trim(),
        category: "other",
        color: "#3B82F6",
      })

      if (createdTag) {
        onTagsChange([...selectedTagIds, createdTag.id])
        setSearchTerm("")
      }
    } catch (error) {
      console.error("Error creating tag:", error)
    } finally {
      setCreatingTag(false)
    }
  }

  const selectedTags = availableTags.filter((tag) => selectedTagIds.includes(tag.id))

  return (
    <div className="space-y-3">
      <Label>Tags ({selectedTagIds.length} selected)</Label>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={searchInputRef}
          placeholder="Search tags or type to create new..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-gray-600">Selected:</Label>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color }} className="text-white pr-1">
                {getCategoryIcon(tag.category)}
                <span className="ml-1">{tag.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-white/20"
                  onClick={() => handleTagToggle(tag.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Available Tags */}
      <div className="space-y-2">
        <Label className="text-sm text-gray-600">Available tags:</Label>
        <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50">
          {filteredTags.length === 0 && !showCreateOption ? (
            <p className="text-sm text-gray-500 p-2">
              {searchTerm ? "No tags found matching your search" : "No tags available"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer hover:opacity-80 transition-all"
                    style={{
                      backgroundColor: isSelected ? tag.color : "transparent",
                      color: isSelected ? "white" : tag.color,
                      borderColor: tag.color,
                      borderWidth: "1px",
                    }}
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {getCategoryIcon(tag.category)}
                    <span className="ml-1">{tag.name}</span>
                    {isSelected && <span className="ml-1">✓</span>}
                  </Badge>
                )
              })}

              {/* Quick Create Option */}
              {showCreateOption && (
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-green-50 border-green-500 text-green-700 border-dashed"
                  onClick={handleQuickCreate}
                >
                  <Plus className="h-3 w-3" />
                  <span className="ml-1">{creatingTag ? "Creating..." : `Create "${searchTerm}"`}</span>
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Create Form */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {showCreateForm ? "Cancel" : "Create New Tag (Advanced)"}
        </Button>

        {showCreateForm && (
          <div className="border rounded-md p-3 bg-gray-50 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name" className="text-sm">
                Tag Name
              </Label>
              <Input
                id="new-tag-name"
                placeholder="Enter tag name..."
                value={newTagForm.name}
                onChange={(e) => setNewTagForm({ ...newTagForm, name: e.target.value })}
                disabled={creatingTag}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="new-tag-category" className="text-sm">
                  Category
                </Label>
                <Select
                  value={newTagForm.category}
                  onValueChange={(value: any) => setNewTagForm({ ...newTagForm, category: value })}
                  disabled={creatingTag}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organism">Organism</SelectItem>
                    <SelectItem value="reagent">Reagent</SelectItem>
                    <SelectItem value="technique">Technique</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-tag-color" className="text-sm">
                  Color
                </Label>
                <Input
                  id="new-tag-color"
                  type="color"
                  value={newTagForm.color}
                  onChange={(e) => setNewTagForm({ ...newTagForm, color: e.target.value })}
                  className="w-16 h-10"
                  disabled={creatingTag}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCreateTag}
              disabled={!newTagForm.name.trim() || creatingTag}
              className="w-full"
              size="sm"
            >
              {creatingTag ? "Creating..." : "Create Tag"}
            </Button>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500">
        {searchTerm ? (
          showCreateOption ? (
            <>
              Search results for "{searchTerm}". Click the dashed badge to create it quickly, or use advanced form
              below.
            </>
          ) : (
            <>Showing tags matching "{searchTerm}"</>
          )
        ) : (
          <>Search for existing tags or type a new name to create one</>
        )}
      </div>
    </div>
  )
}
