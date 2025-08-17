"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
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
import { Plus, Search, FileText, Database, TagIcon, Calendar, User, Beaker, Microscope, FlaskConical, Edit, Trash2, MoreHorizontal, Download, Upload, Share2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Import components
import TagSelector from "@/components/tag-selector"
import LoginForm from "@/components/auth/login-form"
import UserProfile from "@/components/auth/user-profile"
import { FileUpload } from "@/components/file-upload"

import type { Experiment, Tag } from "@/lib/types"

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
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [shareExperiment, setShareExperiment] = useState<Experiment | null>(null)
  const [shareEmail, setShareEmail] = useState("")

  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({})

  // New experiment form state with file uploads
  const [newExperiment, setNewExperiment] = useState({
    title: "",
    description: "",
    researcher_name: "",
    protocol: "",
    status: "planning" as const,
    experiment_date: new Date().toISOString().split("T")[0],
    tag_ids: [] as string[],
    protocolFiles: [] as File[],
    dataFiles: [] as File[],
  })

  // Edit experiment form state
  const [editExperimentForm, setEditExperimentForm] = useState({
    title: "",
    description: "",
    researcher_name: "",
    protocol: "",
    status: "planning" as const,
    experiment_date: new Date().toISOString().split("T")[0],
    tag_ids: [] as string[],
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

  const fetchExperiments = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch experiments owned by the current user
      const { data: experimentsData, error: experimentsError } = await supabase
        .from("experiments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (experimentsError) {
        console.error("Error fetching experiments:", experimentsError)
        return
      }

      // Fetch experiments shared with the current user
      const { data: sharedData, error: sharedError } = await supabase
        .from("experiment_shares")
        .select("experiment:experiments(*)")
        .eq("user_id", user.id)

      if (sharedError) {
        console.error("Error fetching shared experiments:", sharedError)
        return
      }

      const ownedExperiments = (experimentsData || []).map((exp: any) => ({
        ...exp,
        shared: false,
      }))

      const sharedExperiments = (sharedData || []).map((item: any) => ({
        ...item.experiment,
        shared: true,
      }))

      const allExperiments = [...ownedExperiments, ...sharedExperiments]

      // Fetch related data for each experiment
      const experimentsWithRelations = await Promise.all(
        allExperiments.map(async (exp) => {
          // Fetch tags for this experiment
          const { data: tagData } = await supabase
            .from("experiment_tags")
            .select(`
              tags (*)
            `)
            .eq("experiment_id", exp.id)

          // Fetch protocols for this experiment
          const { data: protocolData } = await supabase
            .from("protocols")
            .select("*")
            .eq("experiment_id", exp.id)

          // Fetch files for this experiment
          const { data: fileData } = await supabase
            .from("files")
            .select("*")
            .eq("experiment_id", exp.id)

          // Fetch results for this experiment
          const { data: resultsData } = await supabase
            .from("results")
            .select("*")
            .eq("experiment_id", exp.id)

          const mapWithUrl = (items: any[] | null | undefined) =>
            (items || []).map((item) => ({
              ...item,
              file_url: item.file_path
                ? supabase.storage
                    .from("research-files")
                    .getPublicUrl(item.file_path).data.publicUrl
                : null,
            }))

          return {
            ...exp,
            tags: tagData?.map((item: any) => item.tags).filter(Boolean) || [],
            protocols: mapWithUrl(protocolData),
            files: mapWithUrl(fileData),
            results: mapWithUrl(resultsData),
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

  const uploadFileToStorage = async (file: File, experimentId: string, type: "protocol" | "data") => {
    if (!user) {
      console.error("User not authenticated")
      return null
    }
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}/${experimentId}/${type}s/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("research-files")
        .upload(fileName, file, { contentType: file.type, upsert: true })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        return null
      }

      const { data: urlData } = supabase.storage.from("research-files").getPublicUrl(fileName)
      return { fileName, publicUrl: urlData.publicUrl }
    } catch (err) {
      console.error("File upload error:", err)
      return null
    }
  }

  const addExperiment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExperiment.title.trim() || !user) return

    try {
      setUploadingFiles((prev) => ({ ...prev, new: true }))

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
            experiment_date: newExperiment.experiment_date,
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

      const protocolEntries: any[] = []
      for (const file of newExperiment.protocolFiles) {
        const uploadResult = await uploadFileToStorage(
          file,
          experimentData.id,
          "protocol",
        )
        if (uploadResult) {
          await supabase.from("protocols").insert([
            {
              experiment_id: experimentData.id,
              name: file.name,
              file_path: uploadResult.fileName,
              file_size: file.size,
              filename: file.name,
              mime_type: file.type,
            },
          ])
          protocolEntries.push({
            experiment_id: experimentData.id,
            name: file.name,
            file_path: uploadResult.fileName,
            file_size: file.size,
            filename: file.name,
            mime_type: file.type,
            file_url: uploadResult.publicUrl,
          })
        }
      }

      const fileEntries: any[] = []
      for (const file of newExperiment.dataFiles) {
        const uploadResult = await uploadFileToStorage(file, experimentData.id, "data")
        if (uploadResult) {
          await supabase.from("files").insert([
            {
              experiment_id: experimentData.id,
              name: file.name,
              file_path: uploadResult.fileName,
              file_type: "data",
              file_size: file.size,
              filename: file.name,
              mime_type: file.type,
            },
          ])
          fileEntries.push({
            experiment_id: experimentData.id,
            name: file.name,
            file_path: uploadResult.fileName,
            file_type: "data",
            file_size: file.size,
            filename: file.name,
            mime_type: file.type,
            file_url: uploadResult.publicUrl,
          })
        }
      }

      setExperiments((prev) => [
        {
          ...experimentData,
          tags: tags.filter((t) => newExperiment.tag_ids.includes(t.id)),
          protocols: protocolEntries,
          files: fileEntries,
          results: [],
          shared: false,
        },
        ...prev,
      ])

      setNewExperiment({
        title: "",
        description: "",
        researcher_name: "",
        protocol: "",
        status: "planning",
        experiment_date: new Date().toISOString().split("T")[0],
        tag_ids: [],
        protocolFiles: [],
        dataFiles: [],
      })
      setIsAddExperimentOpen(false)
    } catch (err) {
      console.error("Add experiment error:", err)
      alert("An unexpected error occurred. Please try again.")
    } finally {
      setUploadingFiles((prev) => ({ ...prev, new: false }))
    }
  }

  const updateExperiment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editExperimentForm.title.trim() || !editingExperiment || !user) return

    try {
      // Update experiment
      const { error: experimentError } = await supabase
        .from("experiments")
        .update({
          title: editExperimentForm.title,
          description: editExperimentForm.description,
          researcher_name: editExperimentForm.researcher_name,
          protocol: editExperimentForm.protocol,
          status: editExperimentForm.status,
          experiment_date: editExperimentForm.experiment_date,
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

      // Add new tags if any selected
      if (editExperimentForm.tag_ids.length > 0) {
        const tagInserts = editExperimentForm.tag_ids.map((tag_id) => ({
          experiment_id: editingExperiment.id,
          tag_id,
        }))

        const { error: tagError } = await supabase.from("experiment_tags").insert(tagInserts)

        if (tagError) {
          console.error("Error updating tags:", tagError)
          alert(`Experiment updated but failed to update tags: ${tagError.message}`)
        }
      }

      setEditingExperiment(null)
      setIsEditDialogOpen(false)
      fetchExperiments()
    } catch (err) {
      console.error("Update experiment error:", err)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const deleteExperiment = async (experimentId: string) => {
    if (!user) return

    try {
      // Delete related data first (experiment_tags will be deleted by CASCADE)
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
    } catch (err) {
      console.error("Delete experiment error:", err)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const deleteFile = async (file: any, table: "protocols" | "files") => {
    if (!user) return

    try {
      if (file.file_path) {
        await supabase.storage.from("research-files").remove([file.file_path])
      }
      await supabase.from(table).delete().eq("id", file.id)
      fetchExperiments()
    } catch (err) {
      console.error("Delete file error:", err)
      alert("Failed to delete file. Please try again.")
    }
  }

  const shareCurrentExperiment = async () => {
    if (!user || !shareExperiment || !shareEmail.trim()) return

    try {
      const { data: userId, error: lookupError } = await supabase.rpc(
        "get_user_id_by_email",
        { user_email: shareEmail.trim() },
      )

      if (lookupError || !userId) {
        console.error("Error finding user:", lookupError)
        alert("User not found")
        return
      }

      const { error } = await supabase.from("experiment_shares").insert({
        experiment_id: shareExperiment.id,
        user_id: userId,
      })

      if (error) {
        console.error("Error sharing experiment:", error)
        alert("Failed to share experiment. Please try again.")
        return
      }

      setIsShareDialogOpen(false)
      setShareEmail("")
      setShareExperiment(null)
      fetchExperiments()
    } catch (err) {
      console.error("Share experiment error:", err)
      alert("An unexpected error occurred. Please try again.")
    }
  }

  const handleEditExperiment = (experiment: Experiment) => {
    setEditingExperiment(experiment)
    setEditExperimentForm({
      title: experiment.title,
      description: experiment.description || "",
      researcher_name: experiment.researcher_name || "",
      protocol: experiment.protocol || "",
      status: experiment.status || "planning",
      experiment_date:
        experiment.experiment_date || experiment.created_at.split("T")[0],
      tag_ids: experiment.tags.map((tag) => tag.id),
    })
    setIsEditDialogOpen(true)
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

      // Refresh tags list
      await fetchTags()
      return data
    } catch (err) {
      console.error("Create tag error:", err)
      return null
    }
  }

  const uploadFileToExperiment = async (
    file: File,
    experimentId: string,
    type: "protocol" | "data",
  ) => {
    try {
      setUploadingFiles((prev) => ({ ...prev, [experimentId]: true }))

      const uploadResult = await uploadFileToStorage(file, experimentId, type)
      if (!uploadResult) return null

      // Save file info to database
      if (type === "protocol") {
        const { error: dbError } = await supabase.from("protocols").insert([
          {
            experiment_id: experimentId,
            name: file.name,
            file_path: uploadResult.fileName,
            file_size: file.size,
            filename: file.name,
            mime_type: file.type,
          },
        ])

        if (dbError) {
          console.error("Database error:", dbError)
          return null
        }
      } else {
        const { error: dbError } = await supabase.from("files").insert([
          {
            experiment_id: experimentId,
            name: file.name,
            file_path: uploadResult.fileName,
            file_type: "data",
            file_size: file.size,
            filename: file.name,
            mime_type: file.type,
          },
        ])

        if (dbError) {
          console.error("Database error:", dbError)
          return null
        }
      }

      fetchExperiments()
      return uploadResult.publicUrl
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
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Experiment</DialogTitle>
                        <DialogDescription>Create a new research experiment with tags, details, and files</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={addExperiment} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="experiment_date">Experiment Date</Label>
                          <Input
                            id="experiment_date"
                            type="date"
                            value={newExperiment.experiment_date}
                            onChange={(e) =>
                              setNewExperiment({
                                ...newExperiment,
                                experiment_date: e.target.value,
                              })
                            }
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

                        {/* File Upload Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Protocol Files</Label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                              <Input
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.txt,.md"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || [])
                                  setNewExperiment({ ...newExperiment, protocolFiles: files })
                                }}
                                className="mb-2"
                              />
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Upload className="h-4 w-4" />
                                <span>Upload protocol files (PDF, DOC, TXT, MD)</span>
                              </div>
                              {newExperiment.protocolFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {newExperiment.protocolFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 text-sm">
                                      <FileText className="h-3 w-3 text-blue-600" />
                                      <span>{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Data Files</Label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                              <Input
                                type="file"
                                multiple
                                accept=".csv,.xlsx,.json,.txt,.tsv"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || [])
                                  setNewExperiment({ ...newExperiment, dataFiles: files })
                                }}
                                className="mb-2"
                              />
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Upload className="h-4 w-4" />
                                <span>Upload data files (CSV, XLSX, JSON, TXT, TSV)</span>
                              </div>
                              {newExperiment.dataFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {newExperiment.dataFiles.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 text-sm">
                                      <Database className="h-3 w-3 text-green-600" />
                                      <span>{file.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={uploadingFiles.new}>
                          {uploadingFiles.new ? "Creating Experiment..." : "Create Experiment"}
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
                <form onSubmit={updateExperiment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      value={editExperimentForm.title}
                      onChange={(e) => setEditExperimentForm({ ...editExperimentForm, title: e.target.value })}
                      placeholder="Experiment title..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-researcher">Researcher Name</Label>
                    <Input
                      id="edit-researcher"
                      value={editExperimentForm.researcher_name}
                      onChange={(e) =>
                        setEditExperimentForm({ ...editExperimentForm, researcher_name: e.target.value })
                      }
                      placeholder="Principal investigator..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-experiment-date">Experiment Date</Label>
                    <Input
                      id="edit-experiment-date"
                      type="date"
                      value={editExperimentForm.experiment_date}
                      onChange={(e) =>
                        setEditExperimentForm({
                          ...editExperimentForm,
                          experiment_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editExperimentForm.description}
                      onChange={(e) => setEditExperimentForm({ ...editExperimentForm, description: e.target.value })}
                      placeholder="Experiment description and objectives..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-protocol">Protocol</Label>
                    <Textarea
                      id="edit-protocol"
                      value={editExperimentForm.protocol}
                      onChange={(e) => setEditExperimentForm({ ...editExperimentForm, protocol: e.target.value })}
                      placeholder="Experimental protocol and methods..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editExperimentForm.status}
                      onValueChange={(value: any) => setEditExperimentForm({ ...editExperimentForm, status: value })}
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
                    selectedTagIds={editExperimentForm.tag_ids}
                    onTagsChange={(tagIds) => setEditExperimentForm({ ...editExperimentForm, tag_ids: tagIds })}
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

            {/* Share Experiment Dialog */}
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Experiment</DialogTitle>
                  <DialogDescription>Enter the email of the person to share this experiment with.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={shareCurrentExperiment}>Share</Button>
                  </div>
                </div>
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
                          <CardTitle className="text-xl flex items-center gap-2">
                            {experiment.title}
                            {experiment.shared && (
                              <Badge variant="secondary">Shared</Badge>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {experiment.researcher_name && (
                              <>
                                <User className="h-4 w-4" />
                                {experiment.researcher_name}
                              </>
                            )}
                            <Calendar className="h-4 w-4 ml-2" />
                            {new Date(
                              experiment.experiment_date || experiment.created_at,
                            ).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(experiment.status || "planning")}>
                            {(experiment.status || "planning").replace("_", " ")}
                          </Badge>
                          {experiment.user_id === user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditExperiment(experiment)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setShareExperiment(experiment)
                                    setIsShareDialogOpen(true)
                                  }}
                                >
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
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
                                        onClick={() => deleteExperiment(experiment.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
                                  <FileUpload
                                    onFileUpload={(file) => uploadFileToExperiment(file, experiment.id, "protocol")}
                                    acceptedTypes=".pdf,.doc,.docx,.txt,.md"
                                    maxSize={10}
                                    label="Protocol File"
                                    disabled={uploadingFiles[experiment.id]}
                                  />
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
                                    {protocol.filename || protocol.name || `Protocol ${protocol.id.slice(0, 8)}`}
                                  </span>
                                  {protocol.file_url && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={protocol.file_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-3 w-3" />
                                      </a>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteFile(protocol, "protocols")}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
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
                                  <FileUpload
                                    onFileUpload={(file) => uploadFileToExperiment(file, experiment.id, "data")}
                                    acceptedTypes=".csv,.xlsx,.json,.txt,.tsv"
                                    maxSize={50}
                                    label="Data File"
                                    disabled={uploadingFiles[experiment.id]}
                                  />
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
                                  <span className="flex-1">{dataFile.filename || dataFile.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {dataFile.file_size
                                      ? (dataFile.file_size / 1024 / 1024).toFixed(2) + " MB"
                                      : ""}
                                  </span>
                                  <Button variant="ghost" size="sm" asChild>
                                    <a href={dataFile.file_url} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-3 w-3" />
                                    </a>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteFile(dataFile, "files")}
                                  >
                                    <Trash2 className="h-3 w-3" />
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
                                  <span className="flex-1">
                                    {result.title || `Result ${result.id.slice(0, 8)}`}
                                  </span>
                                  {result.file_url && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={result.file_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-3 w-3" />
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
