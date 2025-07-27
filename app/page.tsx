"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus,
  Search,
  FileText,
  Database,
  TagIcon,
  Calendar,
  User,
  Beaker,
  Microscope,
  FlaskConical,
} from "lucide-react"

// Import components
import TagSelector from "@/components/tag-selector"
import LoginForm from "@/components/auth/login-form"
import UserProfile from "@/components/auth/user-profile"

// Create Supabase client (singleton pattern)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vnrbidtckiaxljjzmxul.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface Experiment {
  id: string
  user_id: string
  title: string
  description?: string
  researcher_name?: string
  protocol?: string
  status?: "planning" | "in_progress" | "completed" | "on_hold"
  visibility?: string
  created_at: string
  updated_at?: string
  tags: any[]
  protocols: any[]
  files: any[]
  results: any[]
}

interface Tag {
  id: string
  user_id: string
  name: string
  category: "organism" | "reagent" | "technique" | "equipment" | "other"
  color: string
  created_at: string
}

export default function ResearchPlatform() {
  // Authentication state
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isAddExperimentOpen, setIsAddExperimentOpen] = useState(false)

  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({})

  // New experiment form state
  const [newExperiment, setNewExperiment] = useState({
    title: "",
    description: "",
    researcher_name: "",
    protocol: "",
    status: "planning" as const,
    tag_ids: [] as string[],
  })

  // New tag form state
  const [newTag, setNewTag] = useState({
    name: "",
    category: "other",
    color: "#3B82F6",
  })

  // Add these new state variables after the existing ones
  const [addingTag, setAddingTag] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)
  const [tagSuccess, setTagSuccess] = useState<string | null>(null)

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

  const fetchTags = async () => {
    if (!user) return

    try {
      // Fetch tags for the current user
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

  const addExperiment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExperiment.title.trim() || !user) return

    try {
      // Insert experiment with user_id
      const { data: experimentData, error: experimentError } = await supabase
        .from("experiments")
        .insert([
          {
            title: newExperiment.title,
            description: newExperiment.description,
            researcher_name: newExperiment.researcher_name,
            protocol: newExperiment.protocol,
            status: newExperiment.status,
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (experimentError) {
        console.error("Error adding experiment:", experimentError)
        alert("Failed to create experiment. Please try again.")
        return
      }

      // Add tags if any selected
      if (newExperiment.tag_ids.length > 0) {
        const tagInserts = newExperiment.tag_ids.map((tag_id) => ({
          experiment_id: experimentData.id,
          tag_id,
        }))

        const { error: tagError } = await supabase.from("experiment_tags").insert(tagInserts)

        if (tagError) {
          console.error("Error adding tags:", tagError)
          alert(`Experiment created but failed to add tags: ${tagError.message}`)
        }
      }

      setNewExperiment({
        title: "",
        description: "",
        researcher_name: "",
        protocol: "",
        status: "planning",
        tag_ids: [],
      })
      setIsAddExperimentOpen(false)
      fetchExperiments()
    } catch (err) {
      console.error("Add experiment error:", err)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const addTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTag.name.trim()) {
      setTagError("Tag name is required")
      return
    }

    try {
      setAddingTag(true)
      setTagError(null)
      setTagSuccess(null)

      // Check if tag already exists
      const { data: existingTags, error: checkError } = await supabase
        .from("tags")
        .select("name")
        .eq("name", newTag.name.trim())

      if (checkError) {
        console.error("Error checking existing tags:", checkError)
        setTagError("Failed to check existing tags")
        return
      }

      if (existingTags && existingTags.length > 0) {
        setTagError("A tag with this name already exists")
        return
      }

      // First, try to get the table structure to see what columns exist
      const { data: tableInfo, error: tableError } = await supabase.from("tags").select("*").limit(1)

      let insertData: any = {
        name: newTag.name.trim(),
      }

      // Only add category and color if they exist in the table structure
      if (tableInfo && tableInfo.length > 0) {
        const sampleRow = tableInfo[0]
        if ("category" in sampleRow) {
          insertData.category = newTag.category
        }
        if ("color" in sampleRow) {
          insertData.color = newTag.color
        }
      } else {
        // If no existing data, try with all fields and handle errors
        insertData = {
          name: newTag.name.trim(),
          category: newTag.category,
          color: newTag.color,
        }
      }

      // Insert the new tag
      const { data, error } = await supabase.from("tags").insert([insertData]).select()

      if (error) {
        console.error("Error adding tag:", error)

        // If error mentions missing column, try with just the name
        if (error.message.includes("category") || error.message.includes("color")) {
          const { data: retryData, error: retryError } = await supabase
            .from("tags")
            .insert([{ name: newTag.name.trim() }])
            .select()

          if (retryError) {
            setTagError(`Failed to add tag: ${retryError.message}`)
            return
          }

          setTagSuccess(
            `Tag "${newTag.name}" added successfully! (Note: category and color not supported by current database schema)`,
          )
        } else {
          setTagError(`Failed to add tag: ${error.message}`)
          return
        }
      } else {
        setTagSuccess(`Tag "${newTag.name}" added successfully!`)
      }

      setNewTag({
        name: "",
        category: "other",
        color: "#3B82F6",
      })
      await fetchTags()

      // Clear success message after 3 seconds
      setTimeout(() => setTagSuccess(null), 3000)
    } catch (err) {
      console.error("Add tag error:", err)
      setTagError("An unexpected error occurred")
    } finally {
      setAddingTag(false)
    }
  }

  // New function to handle tag creation from the TagSelector
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
        console.log("Tag already exists:", existingTags[0])
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

      await fetchTags()
      return data
    } catch (err) {
      console.error("Create tag error:", err)
      return null
    }
  }

  const uploadFileToExperiment = async (file: File, experimentId: string, type: "protocol" | "data") => {
    try {
      setUploadingFiles((prev) => ({ ...prev, [experimentId]: true }))

      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}/${experimentId}/${type}s/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("research-files")
        .upload(fileName, file)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        return null
      }

      const { data: urlData } = supabase.storage.from("research-files").getPublicUrl(fileName)

      // Save file info to database
      if (type === "protocol") {
        // For protocols, we'll store in the protocols table with steps as JSON
        const { error: dbError } = await supabase.from("protocols").insert([
          {
            experiment_id: experimentId,
            steps: {
              file_name: file.name,
              file_url: urlData.publicUrl,
              description: `Uploaded protocol: ${file.name}`,
            },
          },
        ])

        if (dbError) {
          console.error("Database error:", dbError)
          return null
        }
      } else {
        // For data files, use the files table
        const { error: dbError } = await supabase.from("files").insert([
          {
            experiment_id: experimentId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            description: `Uploaded data file: ${file.name}`,
          },
        ])

        if (dbError) {
          console.error("Database error:", dbError)
          return null
        }
      }

      fetchExperiments()
      return urlData.publicUrl
    } catch (err) {
      console.error("File upload error:", err)
      return null
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [experimentId]: false }))
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

  const filteredExperiments = experiments.filter((exp) => {
    const matchesSearch =
      exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.researcher_name && exp.researcher_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === "all" || exp.status === statusFilter

    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tagId) => exp.tags.some((tag) => tag.id === tagId))

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
                {experiments.reduce((acc, exp) => acc + exp.protocols.length, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Files</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{experiments.reduce((acc, exp) => acc + exp.files.length, 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Results</CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{experiments.reduce((acc, exp) => acc + exp.results.length, 0)}</div>
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
                  <Dialog open={isAddExperimentOpen} onOpenChange={setIsAddExperimentOpen}>
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
                      <form onSubmit={addExperiment} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            value={newExperiment.title}
                            onChange={(e) => setNewExperiment({ ...newExperiment, title: e.target.value })}
                            placeholder="Experiment title..."
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="researcher">Researcher Name</Label>
                          <Input
                            id="researcher"
                            value={newExperiment.researcher_name}
                            onChange={(e) => setNewExperiment({ ...newExperiment, researcher_name: e.target.value })}
                            placeholder="Principal investigator..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={newExperiment.description}
                            onChange={(e) => setNewExperiment({ ...newExperiment, description: e.target.value })}
                            placeholder="Experiment description and objectives..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="protocol">Protocol</Label>
                          <Textarea
                            id="protocol"
                            value={newExperiment.protocol}
                            onChange={(e) => setNewExperiment({ ...newExperiment, protocol: e.target.value })}
                            placeholder="Experimental protocol and methods..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select
                            value={newExperiment.status}
                            onValueChange={(value: any) => setNewExperiment({ ...newExperiment, status: value })}
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
                          selectedTagIds={newExperiment.tag_ids}
                          onTagsChange={(tagIds) => setNewExperiment({ ...newExperiment, tag_ids: tagIds })}
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
                        <div className="space-y-1">
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
                        <Badge className={getStatusColor(experiment.status || "planning")}>
                          {(experiment.status || "planning").replace("_", " ")}
                        </Badge>
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
                      {experiment.tags.length > 0 && (
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

                      {/* Files and Upload Section */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Protocols Section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                Protocol Files ({experiment.protocols.length})
                              </Label>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Upload Protocol File</DialogTitle>
                                    <DialogDescription>Upload a protocol file for this experiment</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <Input
                                      type="file"
                                      accept=".pdf,.doc,.docx,.txt,.md"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          await uploadFileToExperiment(file, experiment.id, "protocol")
                                        }
                                      }}
                                      disabled={uploadingFiles[experiment.id]}
                                    />
                                    {uploadingFiles[experiment.id] && (
                                      <p className="text-sm text-gray-600">Uploading...</p>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <div className="space-y-1">
                              {experiment.protocols.map((protocol) => (
                                <div
                                  key={protocol.id}
                                  className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded"
                                >
                                  <FileText className="h-3 w-3 text-blue-600" />
                                  <span className="flex-1">
                                    {protocol.steps?.file_name || `Protocol ${protocol.id.slice(0, 8)}`}
                                  </span>
                                  {protocol.steps?.file_url && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={protocol.steps.file_url} target="_blank" rel="noopener noreferrer">
                                        View
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {experiment.protocols.length === 0 && (
                                <p className="text-xs text-gray-500">No protocol files uploaded</p>
                              )}
                            </div>
                          </div>

                          {/* Data Files Section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <Database className="h-4 w-4 text-green-600" />
                                Data Files ({experiment.files.length})
                              </Label>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Upload Data File</DialogTitle>
                                    <DialogDescription>Upload a data file for this experiment</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <Input
                                      type="file"
                                      accept=".csv,.xlsx,.json,.txt,.tsv"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          await uploadFileToExperiment(file, experiment.id, "data")
                                        }
                                      }}
                                      disabled={uploadingFiles[experiment.id]}
                                    />
                                    {uploadingFiles[experiment.id] && (
                                      <p className="text-sm text-gray-600">Uploading...</p>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            <div className="space-y-1">
                              {experiment.files.map((dataFile) => (
                                <div
                                  key={dataFile.id}
                                  className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded"
                                >
                                  <Database className="h-3 w-3 text-green-600" />
                                  <span className="flex-1">{dataFile.file_name}</span>
                                  <span className="text-xs text-gray-500">
                                    {dataFile.file_size ? (dataFile.file_size / 1024 / 1024).toFixed(2) + " MB" : ""}
                                  </span>
                                  <Button variant="ghost" size="sm" asChild>
                                    <a href={dataFile.file_url} target="_blank" rel="noopener noreferrer">
                                      View
                                    </a>
                                  </Button>
                                </div>
                              ))}
                              {experiment.files.length === 0 && (
                                <p className="text-xs text-gray-500">No data files uploaded</p>
                              )}
                            </div>
                          </div>

                          {/* Results Section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-purple-600" />
                                Results ({experiment.results.length})
                              </Label>
                            </div>
                            <div className="space-y-1">
                              {experiment.results.map((result) => (
                                <div
                                  key={result.id}
                                  className="flex items-center gap-2 text-sm p-2 bg-purple-50 rounded"
                                >
                                  <FlaskConical className="h-3 w-3 text-purple-600" />
                                  <span className="flex-1">Result {result.id.slice(0, 8)}</span>
                                  {result.file_url && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={result.file_url} target="_blank" rel="noopener noreferrer">
                                        View
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {experiment.results.length === 0 && (
                                <p className="text-xs text-gray-500">No results recorded</p>
                              )}
                            </div>
                          </div>
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
