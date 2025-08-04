"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { TagSelector } from "@/components/tag-selector"
import { ShareExperimentDialog } from "@/components/share-experiment-dialog"
import { SharedExperimentsTab } from "@/components/shared-experiments-tab"
import { ExperimentListItem } from "@/components/experiment-list-item"
import LoginForm from "@/components/auth/login-form"
import { UserProfile } from "@/components/auth/user-profile"

const supabase = createClient(
  "https://vnrbidtckiaxljjzmxul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface Experiment {
  id: number
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
    id: number
    name: string
    category: string
    color: string
  }>
}

interface Tag {
  id: number
  name: string
  category: string
  color: string
}

export default function ExperimentManager() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null)
  const [shareDialog, setShareDialog] = useState<{ open: boolean; experimentId: number; title: string }>({
    open: false,
    experimentId: 0,
    title: "",
  })
  const [activeTab, setActiveTab] = useState("my-experiments")

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    researcher_name: "",
    status: "planning" as const,
    selectedTags: [] as number[],
  })

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadExperiments()
      loadTags()
    }
  }, [user])

  useEffect(() => {
    filterExperiments()
  }, [experiments, searchTerm, statusFilter, tagFilter])

  const checkUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    } catch (error) {
      console.error("Error checking user:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadExperiments = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) return

      // Load user's own experiments
      const { data: ownExperiments, error: ownError } = await supabase
        .from("experiments")
        .select("*")
        .eq("user_id", currentUser.user.id)
        .order("updated_at", { ascending: false })

      if (ownError) throw ownError

      // Get tags for each experiment
      const experimentsWithTags = await Promise.all(
        (ownExperiments || []).map(async (exp) => {
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
            .eq("experiment_id", exp.id)

          return {
            ...exp,
            tags: expTags?.map((t) => t.tags).filter(Boolean) || [],
          }
        }),
      )

      setExperiments(experimentsWithTags)
    } catch (error) {
      console.error("Error loading experiments:", error)
      toast.error("Failed to load experiments")
    }
  }

  const loadTags = async () => {
    try {
      const { data, error } = await supabase.from("tags").select("*").order("name")

      if (error) throw error
      setTags(data || [])
    } catch (error) {
      console.error("Error loading tags:", error)
    }
  }

  const filterExperiments = () => {
    let filtered = experiments

    if (searchTerm) {
      filtered = filtered.filter(
        (exp) =>
          exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exp.researcher_name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((exp) => exp.status === statusFilter)
    }

    if (tagFilter !== "all") {
      filtered = filtered.filter((exp) => exp.tags.some((tag) => tag.id.toString() === tagFilter))
    }

    setFilteredExperiments(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) {
        toast.error("You must be logged in to create experiments")
        return
      }

      if (editingExperiment) {
        // Update existing experiment
        const { error } = await supabase
          .from("experiments")
          .update({
            title: formData.title,
            description: formData.description,
            researcher_name: formData.researcher_name,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingExperiment.id)

        if (error) throw error

        // Update tags
        await updateExperimentTags(editingExperiment.id, formData.selectedTags)

        toast.success("Experiment updated successfully")
      } else {
        // Create new experiment
        const { data, error } = await supabase
          .from("experiments")
          .insert({
            title: formData.title,
            description: formData.description,
            researcher_name: formData.researcher_name,
            status: formData.status,
            user_id: currentUser.user.id,
          })
          .select()
          .single()

        if (error) throw error

        // Add tags
        if (data && formData.selectedTags.length > 0) {
          await updateExperimentTags(data.id, formData.selectedTags)
        }

        toast.success("Experiment created successfully")
      }

      resetForm()
      loadExperiments()
    } catch (error) {
      console.error("Error saving experiment:", error)
      toast.error("Failed to save experiment")
    }
  }

  const updateExperimentTags = async (experimentId: number, tagIds: number[]) => {
    // Remove existing tags
    await supabase.from("experiment_tags").delete().eq("experiment_id", experimentId)

    // Add new tags
    if (tagIds.length > 0) {
      const tagInserts = tagIds.map((tagId) => ({
        experiment_id: experimentId,
        tag_id: tagId,
      }))

      await supabase.from("experiment_tags").insert(tagInserts)
    }
  }

  const handleEdit = (experiment: Experiment) => {
    setEditingExperiment(experiment)
    setFormData({
      title: experiment.title,
      description: experiment.description || "",
      researcher_name: experiment.researcher_name,
      status: experiment.status,
      selectedTags: experiment.tags.map((tag) => tag.id),
    })
    setShowAddDialog(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this experiment?")) return

    try {
      const { error } = await supabase.from("experiments").delete().eq("id", id)

      if (error) throw error

      toast.success("Experiment deleted successfully")
      loadExperiments()
    } catch (error) {
      console.error("Error deleting experiment:", error)
      toast.error("Failed to delete experiment")
    }
  }

  const handleShare = (experiment: Experiment) => {
    setShareDialog({
      open: true,
      experimentId: experiment.id,
      title: experiment.title,
    })
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      researcher_name: "",
      status: "planning",
      selectedTags: [],
    })
    setEditingExperiment(null)
    setShowAddDialog(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setExperiments([])
    setTags([])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm onLogin={checkUser} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center">Experiment Manager</h1>
            <p className="text-gray-600 mt-2">Easily find your experiments and research data
</p>
          </div>
          <UserProfile user={user} onSignOut={handleSignOut} />
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="my-experiments">My Experiments</TabsTrigger>
            <TabsTrigger value="shared-with-me">
              <Users className="h-4 w-4 mr-2" />
              Shared with Me
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-experiments">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search experiments..."
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

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Experiment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingExperiment ? "Edit Experiment" : "Add New Experiment"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="researcher">Researcher Name</Label>
                      <Input
                        id="researcher"
                        value={formData.researcher_name}
                        onChange={(e) => setFormData({ ...formData, researcher_name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Tags</Label>
                      <TagSelector
                        tags={tags}
                        selectedTags={formData.selectedTags}
                        onTagsChange={(selectedTags) => setFormData({ ...formData, selectedTags })}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button type="submit">{editingExperiment ? "Update" : "Create"} Experiment</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Experiments List */}
            {filteredExperiments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-6xl mb-4">🧪</div>
                  <h3 className="text-lg font-medium mb-2">No experiments found</h3>
                  <p className="text-gray-600 text-center mb-4">
                    {experiments.length === 0
                      ? "Get started by creating your first experiment."
                      : "Try adjusting your search or filter criteria."}
                  </p>
                  {experiments.length === 0 && (
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Experiment
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredExperiments.map((experiment) => (
                  <ExperimentListItem
                    key={experiment.id}
                    experiment={experiment}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onShare={handleShare}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shared-with-me">
            <SharedExperimentsTab />
          </TabsContent>
        </Tabs>

        {/* Share Dialog */}
        <ShareExperimentDialog
          open={shareDialog.open}
          onOpenChange={(open) => setShareDialog({ ...shareDialog, open })}
          experimentId={shareDialog.experimentId}
          experimentTitle={shareDialog.title}
          onShareUpdate={loadExperiments}
        />
      </div>
    </div>
  )
}
