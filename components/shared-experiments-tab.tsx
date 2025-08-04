"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { ExperimentListItem } from "./experiment-list-item"

const supabase = createClient(
  "https://vnrbidtckiaxljjzmxul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface SharedExperiment {
  id: number
  title: string
  description: string
  researcher_name: string
  status: "planning" | "in_progress" | "completed" | "on_hold"
  created_at: string
  updated_at: string
  user_id: string
  permission_level: "view" | "edit"
  shared_by_email: string
  tags: Array<{
    id: number
    name: string
    category: string
    color: string
  }>
}

export function SharedExperimentsTab() {
  const [sharedExperiments, setSharedExperiments] = useState<SharedExperiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<SharedExperiment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [permissionFilter, setPermissionFilter] = useState<string>("all")

  useEffect(() => {
    loadSharedExperiments()
  }, [])

  useEffect(() => {
    filterExperiments()
  }, [sharedExperiments, searchTerm, statusFilter, permissionFilter])

  const loadSharedExperiments = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) return

      // Get experiments shared with the current user
      const { data: shares, error } = await supabase
        .from("experiment_shares")
        .select(`
          permission_level,
          experiments!inner(
            id,
            title,
            description,
            researcher_name,
            status,
            created_at,
            updated_at,
            user_id,
            profiles!inner(email)
          )
        `)
        .eq("user_id", currentUser.user.id)

      if (error) throw error

      // Get tags for each experiment
      const experimentsWithTags = await Promise.all(
        (shares || []).map(async (share: any) => {
          const { data: expTags } = await supabase
            .from("experiment_tags")
            .select(`
              tags (
                id,
                name,
                category,
                color
              )
            `)
            .eq("experiment_id", share.experiments.id)

          return {
            ...share.experiments,
            permission_level: share.permission_level,
            shared_by_email: share.experiments.profiles.email,
            tags: expTags?.map((t) => t.tags).filter(Boolean) || [],
          }
        }),
      )

      setSharedExperiments(experimentsWithTags)
    } catch (error) {
      console.error("Error loading shared experiments:", error)
      toast.error("Failed to load shared experiments")
    } finally {
      setLoading(false)
    }
  }

  const filterExperiments = () => {
    let filtered = sharedExperiments

    if (searchTerm) {
      filtered = filtered.filter(
        (exp) =>
          exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exp.researcher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exp.shared_by_email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((exp) => exp.status === statusFilter)
    }

    if (permissionFilter !== "all") {
      filtered = filtered.filter((exp) => exp.permission_level === permissionFilter)
    }

    setFilteredExperiments(filtered)
  }

  const handleEdit = (experiment: SharedExperiment) => {
    if (experiment.permission_level !== "edit") {
      toast.error("You don't have permission to edit this experiment")
      return
    }
    // Handle edit logic here
    toast.info("Edit functionality would be implemented here")
  }

  const handleDelete = (id: number) => {
    toast.error("You cannot delete shared experiments")
  }

  const handleShare = (experiment: SharedExperiment) => {
    toast.info("Only the owner can manage sharing")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shared experiments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search shared experiments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>

        <Select value={permissionFilter} onValueChange={setPermissionFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by permission" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Permissions</SelectItem>
            <SelectItem value="view">View Only</SelectItem>
            <SelectItem value="edit">Can Edit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Experiments List */}
      {filteredExperiments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium mb-2">No shared experiments</h3>
            <p className="text-gray-600 text-center">
              {sharedExperiments.length === 0
                ? "No experiments have been shared with you yet."
                : "Try adjusting your search or filter criteria."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredExperiments.map((experiment) => (
            <div key={experiment.id} className="relative">
              <ExperimentListItem
                experiment={{
                  ...experiment,
                  is_shared: true,
                }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShare={handleShare}
              />
              {/* Permission Badge */}
              <div className="absolute top-4 right-16">
                <Badge variant={experiment.permission_level === "edit" ? "default" : "secondary"} className="text-xs">
                  {experiment.permission_level === "edit" ? "Can Edit" : "View Only"}
                </Badge>
              </div>
              {/* Shared By Info */}
              <div className="absolute bottom-4 right-4 text-xs text-gray-500">
                Shared by {experiment.shared_by_email}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
