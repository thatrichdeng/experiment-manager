"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DebugInfoProps {
  tags: any[]
  selectedTagIds: number[]
  experiments: any[]
}

export function DebugInfo({ tags, selectedTagIds, experiments }: DebugInfoProps) {
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <Card className="mt-4 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-sm text-yellow-800">Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <strong>Available Tags ({tags.length}):</strong>
          <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-32">
            {JSON.stringify(
              tags.map((t) => ({ id: t.id, name: t.name, category: t.category })),
              null,
              2,
            )}
          </pre>
        </div>
        <div>
          <strong>Selected Tag IDs:</strong>
          <pre className="bg-white p-2 rounded mt-1">{JSON.stringify(selectedTagIds, null, 2)}</pre>
        </div>
        <div>
          <strong>Experiments with Tags:</strong>
          <pre className="bg-white p-2 rounded mt-1 overflow-auto max-h-32">
            {JSON.stringify(
              experiments.map((e) => ({
                id: e.id,
                title: e.title,
                tags: e.tags?.map((t) => ({ id: t.id, name: t.name })) || [],
              })),
              null,
              2,
            )}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
