"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, X, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PhotoUploaderProps {
  onFileSelect: (file: File) => void
  currentPreview: string | null
  onClear: () => void
  disabled?: boolean
}

export function PhotoUploader({ onFileSelect, currentPreview, onClear, disabled }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items?.length) {
      setIsDragging(true)
    }
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
      if (e.dataTransfer.files?.[0]) {
        const file = e.dataTransfer.files[0]
        if (file.type.startsWith("image/")) {
          onFileSelect(file)
        }
      }
    },
    [onFileSelect]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        onFileSelect(e.target.files[0])
      }
    },
    [onFileSelect]
  )

  if (currentPreview) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="relative aspect-[3/4] w-full max-w-xs mx-auto">
          <img
            src={currentPreview}
            alt="Загруженное фото"
            className="size-full object-cover rounded-lg"
          />
        </div>
        {!disabled && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 size-8 rounded-full"
            onClick={onClear}
          >
            <X className="size-4" />
            <span className="sr-only">Удалить фото</span>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
        "px-6 py-12 text-center",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
        disabled && "pointer-events-none opacity-50"
      )}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          inputRef.current?.click()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        {isDragging ? (
          <ImageIcon className="size-6 text-primary" />
        ) : (
          <Upload className="size-6 text-muted-foreground" />
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">
        {isDragging ? "Отпустите фото здесь" : "Загрузите фотографию PNG, JPG до 10 МБ"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Перетащите файл или нажмите для выбора
      </p>
    </div>
  )
}
