"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar, User, TagIcon, Share2, Edit, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient(
  "https://vnrbidtckiaxljjzmxul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface Experiment {
  id: string
  title: string
  description: string
  researcher_name: string
  status: "planning" | "in_progress" | "completed" | "on_hold"
  created_at: string
  updated_at: string
  user_id: string
  tags: Array<{
    id: string
    name: string
    category: string
    color: string
  }>
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

export default function ExperimentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [permission, setPermission] = useState<"view" | "edit" | null>(null)

  useEffect(() => {
    checkUser()
    loadExperiment()
  }, [params.id])

  const checkUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUser(user)
    } catch (error) {
      console.error("Error checking user:", error)
    }
  }

  const loadExperiment = async () => {
    try {
      const { data: experimentData, error: experimentError } = await supabase
        .from("experiments")
        .select("*")
        .eq("id", params.id)
        .single()

      if (experimentError) throw experimentError

      // Get tags for the experiment
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
        .eq("experiment_id", params.id)

      const experimentWithTags = {
        ...experimentData,
        tags: expTags?.map((t) => t.tags).filter(Boolean) || [],
      }

      setExperiment(experimentWithTags)

      // Check if current user is owner or has shared access
      const { data: currentUser } = await supabase.auth.getUser()
      if (currentUser.user) {
        if (experimentData.user_id === currentUser.user.id) {
          setIsOwner(true)
          setPermission("edit")
        } else {
          // Check if experiment is shared with user
          const { data: shareData } = await supabase
            .from("experiment_shares")
            .select("permission_level")
            .eq("experiment_id", params.id)
            .eq("user_id", currentUser.user.id)
            .single()

          if (shareData) {
            setPermission(shareData.permission_level)
          } else {
            // User doesn't have access
            toast.error("You don't have permission to view this experiment")
            router.push("/")
            return
          }
        }
      }
    } catch (error) {
      console.error("Error loading experiment:", error)
      toast.error("Failed to load experiment")
      router.push("/")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (permission !== "edit") {
      toast.error("You don't have permission to edit this experiment")
      return
    }
    // In a real app, this would open an edit dialog or navigate to edit page
    toast.info("Edit functionality would be implemented here")
  }

  const handleDelete = async () => {
    if (!isOwner) {
      toast.error("Only the owner can delete this experiment")
      return
    }

    if (!confirm("Are you sure you want to delete this experiment?")) return

    try {
      const { error } = await supabase.from("experiments").delete().eq("id", params.id)

      if (error) throw error

      toast.success("Experiment deleted successfully")
      router.push("/")
    } catch (error) {
      console.error("Error deleting experiment:", error)
      toast.error("Failed to delete experiment")
    }
  }

  const handleShare = () => {
    if (!isOwner) {
      toast.error("Only the owner can share this experiment")
      return
    }
    // In a real app, this would open the share dialog
    toast.info("Share functionality would be implemented here")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading experiment...</p>
        </div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Experiment not found</h1>
          <p className="text-gray-600 mb-4">
            The experiment you're looking for doesn't exist or you don't have access.
          </p>
          <Button onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Experiments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{experiment.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={statusColors[experiment.status]}>{statusLabels[experiment.status]}</Badge>
                {!isOwner && (
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    <Users className="h-3 w-3 mr-1" />
                    Shared ({permission})
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {permission === "edit" && (
              <Button onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {isOwner && (
              <>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {experiment.description || "No description provided for this experiment."}
                </p>
              </CardContent>
            </Card>

            {/* Additional sections would go here (protocols, files, results, etc.) */}
            <Card>
              <CardHeader>
                <CardTitle>Protocols</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 italic">No protocols have been added yet.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Files & Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 italic">No files have been uploaded yet.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 italic">No results have been recorded yet.</p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Experiment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <User className="h-4 w-4" />
                    Researcher
                  </div>
                  <p className="font-medium">{experiment.researcher_name}</p>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Calendar className="h-4 w-4" />
                    Created
                  </div>
                  <p className="font-medium">{new Date(experiment.created_at).toLocaleDateString()}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Calendar className="h-4 w-4" />
                    Last Updated
                  </div>
                  <p className="font-medium">{new Date(experiment.updated_at).toLocaleDateString()}</p>
                </div>

                {experiment.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <TagIcon className="h-4 w-4" />
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {experiment.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            className="text-xs"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sharing Info (if not owner) */}
            {!isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle>Sharing Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Your Permission:</span>
                      <Badge variant={permission === "edit" ? "default" : "secondary"}>
                        {permission === "edit" ? "Can Edit" : "View Only"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
