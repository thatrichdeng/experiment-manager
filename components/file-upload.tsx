"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Upload, File, X } from "lucide-react"

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<any>
  acceptedTypes?: string
  maxSize?: number // in MB
  label: string
}

export function FileUpload({ onFileUpload, acceptedTypes = "*", maxSize = 10, label }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`)
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const result = await onFileUpload(selectedFile)

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (result) {
        setTimeout(() => {
          setSelectedFile(null)
          setUploadProgress(0)
          setUploading(false)
        }, 1000)
      }
    } catch (error) {
      console.error("Upload failed:", error)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setUploadProgress(0)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file-upload">{label}</Label>
        <Input id="file-upload" type="file" accept={acceptedTypes} onChange={handleFileSelect} disabled={uploading} />
      </div>

      {selectedFile && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <File className="h-4 w-4 text-gray-600" />
          <span className="flex-1 text-sm">{selectedFile.name}</span>
          <span className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          {!uploading && (
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
        </div>
      )}

      {selectedFile && !uploading && (
        <Button onClick={handleUpload} className="w-full">
          <Upload className="h-4 w-4 mr-2" />
          Upload {label}
        </Button>
      )}
    </div>
  )
}
