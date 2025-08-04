"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  TagIcon,
  MoreVertical,
  Edit,
  Trash2,
  Share2,
  ExternalLink,
  Users,
} from "lucide-react"

interface Experiment {
  id: string
  title: string
  description: string
  researcher_name: string
  status: "planning" | "in_progress" | "completed" | "on_hold"
  created_at: string
  updated_at: string
  user_id?: string
  is_shared?: boolean
  permission_level?: "view" | "edit"
  tags: Array<{
    id: string
    name: string
    category: string
    color: string
  }>
}

interface ExperimentListItemProps {
  experiment: Experiment
  onEdit: (experiment: Experiment) => void
  onDelete: (id: string) => void
  onShare: (experiment: Experiment) => void
}

const statusColors = {
  planning: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  on_hold: "bg-gray-100 text-gray-800",
}

const statusLabels = {
  planning: "Planning",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
}

export function ExperimentListItem({ experiment, onEdit, onDelete, onShare }: ExperimentListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const openInNewTab = () => {
    window.open(`/experiment/${experiment.id}`, "_blank")
  }

  const handleEdit = () => {
    onEdit(experiment)
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this experiment?")) {
      onDelete(experiment.id)
    }
  }

  const handleShare = () => {
    onShare(experiment)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardContent className="p-4">
          {/* Compact Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1 h-auto">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </CollapsibleTrigger>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900 truncate">{experiment.title}</h3>
                  <Badge className={statusColors[experiment.status]}>{statusLabels[experiment.status]}</Badge>
                  {experiment.is_shared && (
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      <Users className="h-3 w-3 mr-1" />
                      Shared
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {experiment.researcher_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(experiment.created_at).toLocaleDateString()}
                  </span>
                  {experiment.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <TagIcon className="h-3 w-3" />
                      {experiment.tags.length} tag{experiment.tags.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openInNewTab}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded Content */}
          <CollapsibleContent className="mt-4">
            <div className="space-y-3 pl-7">
              {/* Description */}
              {experiment.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                  <p className="text-sm text-gray-600">{experiment.description}</p>
                </div>
              )}

              {/* Tags */}
              {experiment.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {experiment.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        className="text-xs"
                      >
                        <TagIcon className="h-3 w-3 mr-1" />
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="ml-2 text-gray-600">{new Date(experiment.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Updated:</span>
                  <span className="ml-2 text-gray-600">{new Date(experiment.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  )
}
