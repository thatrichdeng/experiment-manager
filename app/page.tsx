"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import TagSelector from "@/components/tag-selector"
import LoginForm from "@/components/auth/login-form"
import UserProfile from "@/components/auth/user-profile"
import {
  Plus,
  Search,
  Calendar,
  User,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  Beaker,
  Database,
  TagIcon,
  Microscope,
  FlaskConical,
} from "lucide-react"

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vnrbidtckiaxljjzmxul.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface Tag {
  id: string
  name: string
  category: "organism" | "reagent" | "technique" | "equipment" | "other"
  color: string
  user_id: string
}

interface Experiment {
  id: string
  title: string
  description: string
  researcher_name: string
  protocol: string
  status: "planning" | "in_progress" | "completed" | "on_hold"
  created_at: string
  updated_at: string
  user_id: string
  tags?: Tag[]
  protocols?: any[]
  files?: any[]
  results?: any[]
}

interface ExperimentFormData {
  title: string
  description: string
  researcher_name: string
  protocol: string
  status: "planning" | "in_progress" | "completed" | "on_hold"
  tag_ids: string[]
}

export default function ExperimentManager() {
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null)
  const [formData, setFormData] = useState<ExperimentFormData>({
    title: "",
    description: "",
    researcher_name: "",
    protocol: "",
    status: "planning",
    tag_ids: [],
  })

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error("Error checking auth:", error)
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        fetchExperiments()
        fetchTags()
      } else {
        setExperiments([])
        setTags([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch data when user is authenticated
  useEffect(() => {
    if (user) {
      fetchExperiments()
      fetchTags()
    }
  }, [user])

  const fetchTags = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true })

      if (error) {
        console.error("Error fetching tags:", error)
        return
      }

      setTags(data || [])
    } catch (err) {
      console.error("Fetch tags error:", err)
      setTags([])
    }
  }

  const fetchExperiments = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch experiments for the current user
      const { data: experimentsData, error: experimentsError } = await supabase
        .from("experiments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (experimentsError) {
        console.error("Error fetching experiments:", experimentsError)
        return
      }

      // Fetch related data for each experiment
      const experimentsWithRelations = await Promise.all(
        (experimentsData || []).map(async (exp) => {
          // Fetch tags for this experiment
          const { data: tagData } = await supabase
            .from("experiment_tags")
            .select(`
              tags (*)
            `)
            .eq("experiment_id", exp.id)

          // Fetch protocols for this experiment
          const { data: protocolData } = await supabase.from("protocols").select("*").eq("experiment_id", exp.id)

          // Fetch files for this experiment
          const { data: fileData } = await supabase.from("files").select("*").eq("experiment_id", exp.id)

          // Fetch results for this experiment
          const { data: resultsData } = await supabase.from("results").select("*").eq("experiment_id", exp.id)

          return {
            ...exp,
            tags: tagData?.map((item: any) => item.tags).filter(Boolean) || [],
            protocols: protocolData || [],
            files: fileData || [],
            results: resultsData || [],
          }
        }),
      )

      setExperiments(experimentsWithRelations)
    } catch (err) {
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const { data: experiment, error: experimentError } = await supabase
        .from("experiments")
        .insert([
          {
            title: formData.title,
            description: formData.description,
            researcher_name: formData.researcher_name,
            protocol: formData.protocol,
            status: formData.status,
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (experimentError) {
        console.error("Error creating experiment:", experimentError)
        alert("Failed to create experiment. Please try again.")
        return
      }

      // Add tags to experiment
      if (formData.tag_ids.length > 0) {
        const tagRelations = formData.tag_ids.map((tagId) => ({
          experiment_id: experiment.id,
          tag_id: tagId,
        }))

        const { error: tagsError } = await supabase.from("experiment_tags").insert(tagRelations)

        if (tagsError) {
          console.error("Error adding tags:", tagsError)
          alert(`Experiment created but failed to add tags: ${tagsError.message}`)
        }
      }

      setIsCreateDialogOpen(false)
      setFormData({
        title: "",
        description: "",
        researcher_name: "",
        protocol: "",
        status: "planning",
        tag_ids: [],
      })
      fetchExperiments()
    } catch (error) {
      console.error("Error creating experiment:", error)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const handleEditExperiment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !editingExperiment) return

    try {
      const { error: experimentError } = await supabase
        .from("experiments")
        .update({
          title: formData.title,
          description: formData.description,
          researcher_name: formData.researcher_name,
          protocol: formData.protocol,
          status: formData.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingExperiment.id)
        .eq("user_id", user.id)

      if (experimentError) {
        console.error("Error updating experiment:", experimentError)
        alert("Failed to update experiment. Please try again.")
        return
      }

      // Remove existing tags
      await supabase.from("experiment_tags").delete().eq("experiment_id", editingExperiment.id)

      // Add new tags
      if (formData.tag_ids.length > 0) {
        const tagRelations = formData.tag_ids.map((tagId) => ({
          experiment_id: editingExperiment.id,
          tag_id: tagId,
        }))

        const { error: tagsError } = await supabase.from("experiment_tags").insert(tagRelations)

        if (tagsError) {
          console.error("Error updating tags:", tagsError)
          alert(`Experiment updated but failed to update tags: ${tagsError.message}`)
        }
      }

      setIsEditDialogOpen(false)
      setEditingExperiment(null)
      setFormData({
        title: "",
        description: "",
        researcher_name: "",
        protocol: "",
        status: "planning",
        tag_ids: [],
      })
      fetchExperiments()
    } catch (error) {
      console.error("Error updating experiment:", error)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const handleDeleteExperiment = async (experimentId: string) => {
    if (!user) return

    try {
      // Delete related data first
      await supabase.from("experiment_tags").delete().eq("experiment_id", experimentId)
      await supabase.from("protocols").delete().eq("experiment_id", experimentId)
      await supabase.from("results").delete().eq("experiment_id", experimentId)
      await supabase.from("files").delete().eq("experiment_id", experimentId)

      // Delete the experiment
      const { error } = await supabase.from("experiments").delete().eq("id", experimentId).eq("user_id", user.id)

      if (error) {
        console.error("Error deleting experiment:", error)
        alert("Failed to delete experiment. Please try again.")
        return
      }

      fetchExperiments()
    } catch (error) {
      console.error("Error deleting experiment:", error)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const openEditDialog = (experiment: Experiment) => {
    setEditingExperiment(experiment)
    setFormData({
      title: experiment.title,
      description: experiment.description || "",
      researcher_name: experiment.researcher_name || "",
      protocol: experiment.protocol || "",
      status: experiment.status,
      tag_ids: experiment.tags?.map((tag) => tag.id) || [],
    })
    setIsEditDialogOpen(true)
  }

  const handleCreateTagFromSelector = async (tagData: {
    name: string
    category: string
    color: string
  }): Promise<Tag | null> => {
    if (!user) return null

    try {
      // Check if tag already exists for this user
      const { data: existingTags, error: checkError } = await supabase
        .from("tags")
        .select("*")
        .eq("name", tagData.name.trim())
        .eq("user_id", user.id)

      if (checkError) {
        console.error("Error checking existing tags:", checkError)
        return null
      }

      if (existingTags && existingTags.length > 0) {
        return existingTags[0]
      }

      // Insert the new tag with user_id
      const { data, error } = await supabase
        .from("tags")
        .insert([
          {
            name: tagData.name.trim(),
            category: tagData.category,
            color: tagData.color,
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error("Error creating tag:", error)
        return null
      }

      // Refresh tags list
      await fetchTags()
      return data
    } catch (error) {
      console.error("Create tag error:", error)
      return null
    }
  }

  const handleAuthSuccess = () => {
    // Auth state will be updated by the listener
  }

  const handleSignOut = () => {
    setUser(null)
    setExperiments([])
    setTags([])
  }

  const filteredExperiments = experiments.filter((experiment) => {
    const matchesSearch =
      experiment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (experiment.description && experiment.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (experiment.researcher_name && experiment.researcher_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === "all" || experiment.status === statusFilter

    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tagId) => experiment.tags?.some((tag) => tag.id === tagId))

    return matchesSearch && matchesStatus && matchesTags
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning":
        return "bg-blue-100 text-blue-800"
      case "in_progress":
        return "bg-yellow-100 text-yellow-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "on_hold":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "organism":
        return <Microscope className="h-3 w-3" />
      case "reagent":
        return <Beaker className="h-3 w-3" />
      case "technique":
        return <FileText className="h-3 w-3" />
      case "equipment":
        return <Database className="h-3 w-3" />
      default:
        return <TagIcon className="h-3 w-3" />
    }
  }

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-blue-600 p-3 rounded-full inline-block mb-4">
            <Beaker className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login form if user is not authenticated
  if (!user) {
    return <LoginForm onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with User Profile */}
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-900">Experiment Manager</h1>
            <p className="text-gray-600">Easily find your experiments and research data</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Welcome back,</p>
              <p className="font-medium">{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}</p>
            </div>
            <UserProfile user={user} onSignOut={handleSignOut} />
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Experiments</CardTitle>
              <Beaker className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{experiments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Protocols</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {experiments.reduce((acc, exp) => acc + (exp.protocols?.length || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Files</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {experiments.reduce((acc, exp) => acc + (exp.files?.length || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Results</CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {experiments.reduce((acc, exp) => acc + (exp.results?.length || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Tags</CardTitle>
              <TagIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tags.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="experiments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="experiments">Experiments</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="experiments" className="space-y-4">
            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search & Filter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search experiments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Experiment
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Experiment</DialogTitle>
                        <DialogDescription>Create a new research experiment with tags and details</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateExperiment} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Experiment title..."
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="researcher">Researcher Name</Label>
                          <Input
                            id="researcher"
                            value={formData.researcher_name}
                            onChange={(e) => setFormData({ ...formData, researcher_name: e.target.value })}
                            placeholder="Principal investigator..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Experiment description and objectives..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="protocol">Protocol</Label>
                          <Textarea
                            id="protocol"
                            value={formData.protocol}
                            onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                            placeholder="Experimental protocol and methods..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
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

                        <TagSelector
                          availableTags={tags}
                          selectedTagIds={formData.tag_ids}
                          onTagsChange={(tagIds) => setFormData({ ...formData, tag_ids: tagIds })}
                          onCreateTag={handleCreateTagFromSelector}
                          getCategoryIcon={getCategoryIcon}
                        />

                        <Button type="submit" className="w-full">
                          Create Experiment
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Tag Filter */}
                <div className="space-y-2">
                  <Label>Filter by Tags:</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        style={{ backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined }}
                        onClick={() => {
                          const newSelectedTags = selectedTags.includes(tag.id)
                            ? selectedTags.filter((id) => id !== tag.id)
                            : [...selectedTags, tag.id]
                          setSelectedTags(newSelectedTags)
                        }}
                      >
                        {getCategoryIcon(tag.category)}
                        <span className="ml-1">{tag.name}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Experiment Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Experiment</DialogTitle>
                  <DialogDescription>Update your experiment details and tags</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditExperiment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Experiment title..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-researcher">Researcher Name</Label>
                    <Input
                      id="edit-researcher"
                      value={formData.researcher_name}
                      onChange={(e) => setFormData({ ...formData, researcher_name: e.target.value })}
                      placeholder="Principal investigator..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Experiment description and objectives..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-protocol">Protocol</Label>
                    <Textarea
                      id="edit-protocol"
                      value={formData.protocol}
                      onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                      placeholder="Experimental protocol and methods..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
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

                  <TagSelector
                    availableTags={tags}
                    selectedTagIds={formData.tag_ids}
                    onTagsChange={(tagIds) => setFormData({ ...formData, tag_ids: tagIds })}
                    onCreateTag={handleCreateTagFromSelector}
                    getCategoryIcon={getCategoryIcon}
                  />

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      Update Experiment
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Experiments List */}
            <div className="space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="text-gray-500">Loading experiments...</div>
                  </CardContent>
                </Card>
              ) : filteredExperiments.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="text-gray-500">No experiments found. Create your first experiment!</div>
                  </CardContent>
                </Card>
              ) : (
                filteredExperiments.map((experiment) => (
                  <Card key={experiment.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-xl">{experiment.title}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {experiment.researcher_name && (
                              <>
                                <User className="h-4 w-4" />
                                {experiment.researcher_name}
                              </>
                            )}
                            <Calendar className="h-4 w-4 ml-2" />
                            {new Date(experiment.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(experiment.status || "planning")}>
                            {(experiment.status || "planning").replace("_", " ")}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(experiment)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the experiment "
                                      {experiment.title}" and all associated data including protocols, files, and
                                      results.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteExperiment(experiment.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {experiment.description && <p className="text-gray-700">{experiment.description}</p>}

                      {experiment.protocol && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Protocol:</Label>
                          <div className="bg-blue-50 p-3 rounded-md">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{experiment.protocol}</p>
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {experiment.tags && experiment.tags.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Tags:</Label>
                          <div className="flex flex-wrap gap-2">
                            {experiment.tags.map((tag) => (
                              <Badge key={tag.id} style={{ backgroundColor: tag.color }} className="text-white">
                                {getCategoryIcon(tag.category)}
                                <span className="ml-1">{tag.name}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* File counts */}
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>{experiment.protocols?.length || 0} Protocols</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-green-600" />
                          <span>{experiment.files?.length || 0} Files</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-purple-600" />
                          <span>{experiment.results?.length || 0} Results</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="tags" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TagIcon className="h-5 w-5" />
                  My Tags
                </CardTitle>
                <CardDescription>View all tags you've created for organizing experiments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tags.length === 0 ? (
                  <div className="text-center py-8">
                    <TagIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No tags created yet</p>
                    <p className="text-sm text-gray-400">
                      Tags will appear here when you create them while adding experiments
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {tags.length} tag{tags.length !== 1 ? "s" : ""} available
                      </p>
                    </div>

                    <div className="space-y-4">
                      {["organism", "reagent", "technique", "equipment", "other"].map((category) => {
                        const categoryTags = tags.filter((tag) => tag.category === category)
                        if (categoryTags.length === 0) return null

                        return (
                          <div key={category} className="space-y-2">
                            <h3 className="font-medium capitalize flex items-center gap-2 text-gray-700">
                              {getCategoryIcon(category)}
                              {category}s ({categoryTags.length})
                            </h3>
                            <div className="flex flex-wrap gap-2 pl-6">
                              {categoryTags.map((tag) => (
                                <Badge key={tag.id} style={{ backgroundColor: tag.color }} className="text-white">
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
