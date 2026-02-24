"use client"

import { useCallback, useState } from "react"
import { Upload, X, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import type { OrganizationEmployee } from "@/lib/types"

interface EmployeeCardsProps {
  items: OrganizationEmployee[]
  onChange: (id: string, data: { name: string }) => void
  onRemove: (id: string) => void
  onFilesAdded: (files: File[]) => void
  disabled?: boolean
}

export function EmployeeCards({
  items,
  onChange,
  onRemove,
  onFilesAdded,
  disabled,
}: EmployeeCardsProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items?.length) setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = e.dataTransfer.files
      if (files?.length) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
        if (imageFiles.length) onFilesAdded(imageFiles)
      }
    },
    [onFilesAdded]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files?.length) onFilesAdded(Array.from(files))
      e.target.value = ""
    },
    [onFilesAdded]
  )

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-4 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        )}
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 py-4 text-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileInput}
            disabled={disabled}
            multiple
          />
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">
            Перетащите фото сюда или нажмите для выбора (несколько файлов)
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative flex flex-col gap-2 rounded-lg border border-border bg-card p-2"
          >
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              aria-label="Удалить"
            >
              <X className="size-3.5" />
            </button>
            <div className="aspect-[3/4] overflow-hidden rounded-md bg-muted">
              {item.photoUrl ? (
                <img
                  src={item.photoUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <ImageIcon className="size-8 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <Input
              value={item.name}
              onChange={(e) => onChange(item.id, { name: e.target.value })}
              placeholder="Имя сотрудника"
              disabled={disabled}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
