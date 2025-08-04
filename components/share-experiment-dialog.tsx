"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Search, UserPlus, Trash2, Mail } from "lucide-react"
import { toast } from "sonner"

const supabase = createClient(
  "https://vnrbidtckiaxljjzmxul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

interface ShareExperimentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  experimentId: number
  experimentTitle: string
  onShareUpdate: () => void
}

interface SharedUser {
  id: string
  email: string
  permission_level: "view" | "edit"
  shared_at: string
}

export function ShareExperimentDialog({
  open,
  onOpenChange,
  experimentId,
  experimentTitle,
  onShareUpdate,
}: ShareExperimentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [searchEmail, setSearchEmail] = useState("")
  const [permissionLevel, setPermissionLevel] = useState<"view" | "edit">("view")
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])

  useEffect(() => {
    if (open && experimentId) {
      loadSharedUsers()
    }
  }, [open, experimentId])

  const loadSharedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("experiment_shares")
        .select(`
          user_id,
          permission_level,
          created_at,
          profiles!inner(email)
        `)
        .eq("experiment_id", experimentId)

      if (error) throw error

      const users =
        data?.map((share: any) => ({
          id: share.user_id,
          email: share.profiles.email,
          permission_level: share.permission_level,
          shared_at: share.created_at,
        })) || []

      setSharedUsers(users)
    } catch (error) {
      console.error("Error loading shared users:", error)
    }
  }

  const handleShare = async () => {
    if (!searchEmail.trim()) return

    setLoading(true)
    try {
      // First, find the user by email
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", searchEmail.trim())
        .single()

      if (userError || !userData) {
        toast.error("User not found. They may need to create an account first.")
        return
      }

      // Check if already shared
      const { data: existingShare } = await supabase
        .from("experiment_shares")
        .select("id")
        .eq("experiment_id", experimentId)
        .eq("user_id", userData.id)
        .single()

      if (existingShare) {
        toast.error("Experiment is already shared with this user")
        return
      }

      // Create the share
      const { error: shareError } = await supabase.from("experiment_shares").insert({
        experiment_id: experimentId,
        user_id: userData.id,
        permission_level: permissionLevel,
      })

      if (shareError) throw shareError

      toast.success(`Experiment shared with ${searchEmail}`)
      setSearchEmail("")
      loadSharedUsers()
      onShareUpdate()
    } catch (error) {
      console.error("Error sharing experiment:", error)
      toast.error("Failed to share experiment")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveShare = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("experiment_shares")
        .delete()
        .eq("experiment_id", experimentId)
        .eq("user_id", userId)

      if (error) throw error

      toast.success("Share removed")
      loadSharedUsers()
      onShareUpdate()
    } catch (error) {
      console.error("Error removing share:", error)
      toast.error("Failed to remove share")
    }
  }

  const handleUpdatePermission = async (userId: string, newPermission: "view" | "edit") => {
    try {
      const { error } = await supabase
        .from("experiment_shares")
        .update({ permission_level: newPermission })
        .eq("experiment_id", experimentId)
        .eq("user_id", userId)

      if (error) throw error

      toast.success("Permission updated")
      loadSharedUsers()
      onShareUpdate()
    } catch (error) {
      console.error("Error updating permission:", error)
      toast.error("Failed to update permission")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Experiment</DialogTitle>
          <p className="text-sm text-gray-600">{experimentTitle}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add User Form */}
          <div className="space-y-3">
            <Label>Share with user</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Enter email address"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={permissionLevel} onValueChange={(value: "view" | "edit") => setPermissionLevel(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only</SelectItem>
                  <SelectItem value="edit">Can Edit</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleShare} disabled={loading || !searchEmail.trim()}>
                <UserPlus className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Shared Users List */}
          {sharedUsers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Shared with ({sharedUsers.length})</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sharedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{user.email}</p>
                          <p className="text-xs text-gray-500">
                            Shared {new Date(user.shared_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={user.permission_level}
                          onValueChange={(value: "view" | "edit") => handleUpdatePermission(user.id, value)}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveShare(user.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
