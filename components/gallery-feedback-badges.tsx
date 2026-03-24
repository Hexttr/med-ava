"use client"

import { ThumbsDown, ThumbsUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { GalleryStyleFeedbackSummary } from "@/lib/types"

interface GalleryFeedbackBadgesProps {
  summary?: GalleryStyleFeedbackSummary
  className?: string
}

export function GalleryFeedbackBadges({ summary, className }: GalleryFeedbackBadgesProps) {
  if (!summary || (summary.likes === 0 && summary.dislikes === 0)) {
    return null
  }

  return (
    <div className={className ?? "flex items-center gap-1.5"}>
      <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <ThumbsUp className="size-3" />
        {summary.likes}
      </Badge>
      <Badge variant="outline" className="gap-1 border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
        <ThumbsDown className="size-3" />
        {summary.dislikes}
      </Badge>
    </div>
  )
}
