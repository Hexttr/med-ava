"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  AlertCircle,
  Settings,
  Loader2,
  FolderPlus,
  UserPlus,
  Sparkles,
  Pencil,
  Trash2,
  Download,
} from "lucide-react"
import JSZip from "jszip"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GenerateModeSwitch } from "@/components/generate-mode-switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Department, Employee, GalleryFeedbackSummary } from "@/lib/types"
import { BatchPortraitCard } from "@/components/batch-portrait-card"
import {
  fetchDepartments,
  fetchEmployees,
  createDepartment,
  createEmployeesBatch,
  updateEmployee,
  deleteEmployee,
  updateDepartment,
  deleteDepartment,
} from "@/lib/structure-api"
import { fetchGallery, saveGalleryItemSet, fetchGalleryByEmployeeId, updateGalleryItem } from "@/lib/gallery-api"
import {
  analyzePortrait,
  generatePortrait,
  generatePortraitSet,
  referencePhotoFromUrl,
} from "@/lib/portrait-generation-client"
import { buildPortraitArchiveBaseName, ensureUniqueArchiveBaseName } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

const UPLOAD_BATCH_LIMIT = 50
const CARDS_PER_PAGE = 30

type GenStatus = "pending" | "analyzing" | "generating" | "complete" | "error"

interface BatchClientProps {
  hasApiKey: boolean
}

async function urlToBlob(url: string): Promise<Blob> {
  const match = url.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    const mime = match[1]
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  const res = await fetch(url)
  return res.blob()
}

function getExtension(mime: string): string {
  if (mime.includes("png")) return "png"
  if (mime.includes("webp")) return "webp"
  return "jpg"
}

export function BatchClient({ hasApiKey }: BatchClientProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [generationState, setGenerationState] = useState<Record<string, {
    status: GenStatus
    medicalUrl?: string | null
    corporateUrl?: string | null
    medicalPreviewUrl?: string | null
    corporatePreviewUrl?: string | null
    error?: string
    feedback?: GalleryFeedbackSummary
  }>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [newDeptName, setNewDeptName] = useState("")
  const [addDeptOpen, setAddDeptOpen] = useState(false)
  const [editDeptId, setEditDeptId] = useState<string | null>(null)
  const [editDeptName, setEditDeptName] = useState("")
  const [addEmployeesOpen, setAddEmployeesOpen] = useState(false)
  const [addToDepartmentId, setAddToDepartmentId] = useState<string | null>(null)
  /** "_all" = все сотрудники, иначе id отдела */
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>("_all")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [cardsPage, setCardsPage] = useState(1)
  const [regeneratingCard, setRegeneratingCard] = useState<{ employeeId: string; style: "medical" | "corporate" } | null>(null)
  const [generateMode, setGenerateMode] = useState<"all" | "medical" | "corporate">("all")
  const inputRefRoot = useRef<HTMLInputElement>(null)
  const inputRefDept = useRef<HTMLInputElement>(null)
  const inputRefAddEmployees = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [depts, emps, galleryItems] = await Promise.all([
        fetchDepartments(),
        fetchEmployees(),
        fetchGallery().catch(() => []),
      ])
      setDepartments(depts)
      setEmployees(emps)
      // Показать «Стало» для сотрудников, у которых уже есть результаты в галерее
      const byEmployee = new Map<string, {
        medicalUrl: string | null
        corporateUrl: string | null
        medicalPreviewUrl: string | null
        corporatePreviewUrl: string | null
        feedback?: GalleryFeedbackSummary
      }>()
      for (const item of galleryItems) {
        if (item.employeeId && !byEmployee.has(item.employeeId)) {
          byEmployee.set(item.employeeId, {
            medicalUrl: item.medicalUrl ?? null,
            corporateUrl: item.corporateUrl ?? null,
            medicalPreviewUrl: item.medicalPreviewUrl ?? null,
            corporatePreviewUrl: item.corporatePreviewUrl ?? null,
            feedback: item.feedback,
          })
        }
      }
      setGenerationState((prev) => {
        const next = { ...prev }
        for (const [employeeId, urls] of byEmployee) {
          next[employeeId] = {
            status: "complete",
            medicalUrl: urls.medicalUrl,
            corporateUrl: urls.corporateUrl,
            medicalPreviewUrl: urls.medicalPreviewUrl,
            corporatePreviewUrl: urls.corporatePreviewUrl,
            feedback: urls.feedback,
          }
        }
        return next
      })
    } catch {
      setDepartments([])
      setEmployees([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCardsPage(1)
  }, [filterDepartmentId])

  const allEmployees = employees
  /** Сотрудники, видимые при текущем фильтре */
  const visibleEmployees =
    filterDepartmentId === "_all"
      ? allEmployees
      : employees.filter((e) => e.departmentId === filterDepartmentId)

  const displayedCount = Math.min(cardsPage * CARDS_PER_PAGE, visibleEmployees.length)
  const displayedEmployees = visibleEmployees.slice(0, displayedCount)
  const hasMore = displayedCount < visibleEmployees.length

  const handleAddDepartment = useCallback(async () => {
    const name = newDeptName.trim()
    if (!name) {
      toast.error("Введите название отдела")
      return
    }
    try {
      await createDepartment({ name })
      setNewDeptName("")
      setAddDeptOpen(false)
      await load()
      toast.success("Отдел создан")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать отдел")
    }
  }, [newDeptName, load])

  const handleSaveEditDepartment = useCallback(async () => {
    if (!editDeptId || !editDeptName.trim()) return
    try {
      await updateDepartment(editDeptId, { name: editDeptName.trim() })
      setEditDeptId(null)
      setEditDeptName("")
      await load()
      toast.success("Отдел обновлён")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось обновить отдел")
    }
  }, [editDeptId, editDeptName, load])

  const handleDeleteDepartment = useCallback(
    async (id: string) => {
      try {
        await deleteDepartment(id)
        if (filterDepartmentId === id) setFilterDepartmentId("_all")
        await load()
        toast.success("Отдел удалён")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось удалить отдел")
      }
    },
    [filterDepartmentId, load]
  )

  const handleDropOrSelect = useCallback(
    async (files: FileList | File[], departmentId: string | null) => {
      const list = Array.from("length" in files ? files : files).filter((f) => f.type.startsWith("image/"))
      if (list.length === 0) return
      if (list.length > UPLOAD_BATCH_LIMIT) {
        toast.warning(`Загружено ${UPLOAD_BATCH_LIMIT} из ${list.length}. Остальные можно добавить повторной загрузкой.`)
      }
      const toUpload = list.slice(0, UPLOAD_BATCH_LIMIT)
      setUploading(true)
      setUploadProgress(`Загрузка ${toUpload.length} фото...`)
      try {
        const result = await createEmployeesBatch(toUpload, departmentId ?? undefined)
        await load()
        if (result.created > 0) {
          toast.success(result.created === 1 ? "Сотрудник добавлен" : `Добавлено сотрудников: ${result.created}`)
        }
        if (result.errors?.length) {
          toast.error(`Ошибки: ${result.errors.slice(0, 2).join("; ")}${result.errors.length > 2 ? "..." : ""}`)
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось добавить сотрудников")
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [load]
  )

  const handleEmployeeNameChange = useCallback(
    async (employeeId: string, name: string) => {
      const emp = employees.find((e) => e.id === employeeId)
      if (!emp) return
      try {
        await updateEmployee(employeeId, { name: name.trim() || "Сотрудник" })
        setEmployees((prev) => prev.map((e) => (e.id === employeeId ? { ...e, name: name.trim() || "Сотрудник" } : e)))
      } catch {
        // ignore
      }
    },
    [employees]
  )

  const handleEmployeeDepartmentChange = useCallback(
    async (employeeId: string, departmentId: string | null) => {
      try {
        await updateEmployee(employeeId, { departmentId })
        const dept = departmentId ? departments.find((d) => d.id === departmentId) : null
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === employeeId ? { ...e, departmentId, departmentName: dept?.name } : e
          )
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось изменить отдел")
      }
    },
    [departments]
  )

  const handleRemoveEmployee = useCallback(
    async (employeeId: string) => {
      try {
        await deleteEmployee(employeeId)
        setEmployees((prev) => prev.filter((e) => e.id !== employeeId))
        setGenerationState((prev) => {
          const next = { ...prev }
          delete next[employeeId]
          return next
        })
        toast.success("Сотрудник удалён")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не удалось удалить")
      }
    },
    []
  )

  const processOne = useCallback(
    async (emp: Employee, mode: "all" | "medical" | "corporate") => {
      const id = emp.id
      setCurrentId(id)
      setGenerationState((prev) => ({ ...prev, [id]: { ...prev[id], status: "analyzing" } }))
      try {
        const photoUrl = emp.photoUrl.startsWith("http") || emp.photoUrl.startsWith("data:") ? emp.photoUrl : `${window.location.origin}${emp.photoUrl}`
        const { file, reference } = await referencePhotoFromUrl(photoUrl, `${emp.name}.jpg`)
        const analysis = await analyzePortrait(file, emp.name)

        setGenerationState((prev) => ({ ...prev, [id]: { ...prev[id], status: "generating" } }))

        const genMedical = mode === "all" || mode === "medical"
        const genCorporate = mode === "all" || mode === "corporate"
        const generated = await generatePortraitSet(analysis, reference, mode)
        const medicalUrl = generated.medicalUrl
        const corporateUrl = generated.corporateUrl
        setGenerationState((prev) => ({
          ...prev,
          [id]: {
            status: "complete",
            medicalUrl: genMedical ? medicalUrl : prev[id]?.medicalUrl ?? null,
            corporateUrl: genCorporate ? corporateUrl : prev[id]?.corporateUrl ?? null,
            medicalPreviewUrl: genMedical ? medicalUrl : prev[id]?.medicalPreviewUrl ?? null,
            corporatePreviewUrl: genCorporate ? corporateUrl : prev[id]?.corporatePreviewUrl ?? null,
            feedback: {
              original: { likes: 0, dislikes: 0 },
              medical: { likes: 0, dislikes: 0 },
              corporate: { likes: 0, dislikes: 0 },
            },
          },
        }))
        const finalMedical = genMedical ? medicalUrl : null
        const finalCorporate = genCorporate ? corporateUrl : null
        if (finalMedical || finalCorporate) {
          try {
            const galleryItem = await saveGalleryItemSet({
              name: emp.name,
              medicalUrl: finalMedical ?? undefined,
              corporateUrl: finalCorporate ?? undefined,
              employeeId: id,
            })
            setGenerationState((prev) => ({
              ...prev,
              [id]: {
                ...prev[id],
                medicalPreviewUrl: galleryItem.medicalPreviewUrl ?? prev[id]?.medicalUrl ?? null,
                corporatePreviewUrl: galleryItem.corporatePreviewUrl ?? prev[id]?.corporateUrl ?? null,
                feedback: galleryItem.feedback ?? prev[id]?.feedback,
              },
            }))
          } catch {
            toast.warning(`Портреты для "${emp.name}" сгенерированы, но не сохранены в галерею`)
          }
        }
      } catch (error) {
        setGenerationState((prev) => ({
          ...prev,
          [id]: { status: "error", error: error instanceof Error ? error.message : "Ошибка" },
        }))
      } finally {
        setCurrentId(null)
      }
    },
    []
  )

  const handleRegenerateOne = useCallback(
    async (employeeId: string, style: "medical" | "corporate") => {
      const emp = employees.find((e) => e.id === employeeId)
      if (!emp) return
      const gen = generationState[employeeId]
      if (gen?.status !== "complete") return
      setRegeneratingCard({ employeeId, style })
      try {
        const photoUrl = emp.photoUrl.startsWith("http") || emp.photoUrl.startsWith("data:") ? emp.photoUrl : `${window.location.origin}${emp.photoUrl}`
        const { file, reference } = await referencePhotoFromUrl(photoUrl, `${emp.name}.jpg`)
        const analysis = await analyzePortrait(file, emp.name)
        const newUrl = await generatePortrait(analysis.identityAnchors, style, reference)
        setGenerationState((prev) => ({
          ...prev,
          [employeeId]: {
            ...prev[employeeId],
            [style === "medical" ? "medicalUrl" : "corporateUrl"]: newUrl,
            [style === "medical" ? "medicalPreviewUrl" : "corporatePreviewUrl"]: newUrl,
          },
        }))
        const newMedical = style === "medical" ? newUrl : gen?.medicalUrl
        const newCorporate = style === "corporate" ? newUrl : gen?.corporateUrl
        const galleryItems = await fetchGalleryByEmployeeId(employeeId)
        const item = galleryItems[0]
        if (item?.id) {
          const updatedItem = await updateGalleryItem(item.id, { [style === "medical" ? "medicalUrl" : "corporateUrl"]: newUrl })
          setGenerationState((prev) => ({
            ...prev,
            [employeeId]: {
              ...prev[employeeId],
              medicalUrl: updatedItem.medicalUrl ?? prev[employeeId]?.medicalUrl ?? null,
              corporateUrl: updatedItem.corporateUrl ?? prev[employeeId]?.corporateUrl ?? null,
              medicalPreviewUrl: updatedItem.medicalPreviewUrl ?? prev[employeeId]?.medicalPreviewUrl ?? null,
              corporatePreviewUrl: updatedItem.corporatePreviewUrl ?? prev[employeeId]?.corporatePreviewUrl ?? null,
              feedback: updatedItem.feedback ?? prev[employeeId]?.feedback,
            },
          }))
        } else if (newMedical && newCorporate) {
          try {
            const galleryItem = await saveGalleryItemSet({
              name: emp.name,
              medicalUrl: newMedical,
              corporateUrl: newCorporate,
              employeeId,
            })
            setGenerationState((prev) => ({
              ...prev,
              [employeeId]: {
                ...prev[employeeId],
                medicalPreviewUrl: galleryItem.medicalPreviewUrl ?? prev[employeeId]?.medicalPreviewUrl ?? null,
                corporatePreviewUrl: galleryItem.corporatePreviewUrl ?? prev[employeeId]?.corporatePreviewUrl ?? null,
                feedback: galleryItem.feedback ?? prev[employeeId]?.feedback,
              },
            }))
          } catch {
            toast.warning(`Портреты для "${emp.name}" сгенерированы, но не сохранены в галерею`)
          }
        }
        toast.success("Портрет перегенерирован")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка")
      } finally {
        setRegeneratingCard(null)
      }
    },
    [employees, generationState]
  )

  const needsGeneration = useCallback(
    (employeeId: string) => {
      const gen = generationState[employeeId]
      if (generateMode === "all") return !(gen?.medicalUrl && gen?.corporateUrl)
      if (generateMode === "medical") return !gen?.medicalUrl
      return !gen?.corporateUrl
    },
    [generationState, generateMode]
  )

  const processBatch = useCallback(
    async (scope: "all" | "root" | "department" | "one", departmentId?: string, employeeId?: string) => {
      let toProcess: Employee[]
      if (scope === "one" && employeeId) {
        toProcess = employees.filter((e) => e.id === employeeId)
      } else if (scope === "department" && departmentId) {
        toProcess = employees.filter((e) => e.departmentId === departmentId)
      } else if (scope === "root") {
        toProcess = employees.filter((e) => !e.departmentId)
      } else {
        toProcess = employees
      }
      toProcess = toProcess.filter((e) => needsGeneration(e.id))
      if (toProcess.length === 0) {
        toast.info(scope === "one" ? "У сотрудника уже есть портреты" : "Нет сотрудников для обработки")
        return
      }
      setIsProcessing(true)
      try {
        for (const emp of toProcess) await processOne(emp, generateMode)
        toast.success("Обработка завершена")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка обработки")
      } finally {
        setIsProcessing(false)
      }
    },
    [employees, processOne, generateMode, needsGeneration]
  )

  /** Генерация только для видимых на странице сотрудников (без уже готовых) */
  const handleGenerateVisible = useCallback(() => {
    const toProcess = visibleEmployees.filter((e) => needsGeneration(e.id))
    if (toProcess.length === 0) {
      toast.info("Нет сотрудников для обработки")
      return
    }
    setIsProcessing(true)
    ;(async () => {
      try {
        for (const emp of toProcess) await processOne(emp, generateMode)
        toast.success("Обработка завершена")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка обработки")
      } finally {
        setIsProcessing(false)
      }
    })()
  }, [visibleEmployees, processOne, generateMode, needsGeneration])

  /** Скачать все успешно сгенерированные изображения (по текущему фильтру) */
  const handleDownloadAll = useCallback(async () => {
    const toDownload = visibleEmployees.filter((emp) => {
      const gen = generationState[emp.id]
      return gen?.status === "complete" && (gen.medicalUrl || gen.corporateUrl)
    })
    if (toDownload.length === 0) {
      toast.info("Нет готовых портретов для скачивания")
      return
    }
    try {
      const zip = new JSZip()
      const usedFileNames = new Set<string>()
      for (const emp of toDownload) {
        const gen = generationState[emp.id]
        if (!gen) continue
        const baseName = ensureUniqueArchiveBaseName(
          buildPortraitArchiveBaseName(emp.name),
          usedFileNames
        )
        if (gen.medicalUrl) {
          const blob = await urlToBlob(gen.medicalUrl)
          const ext = getExtension(blob.type || "image/png")
          zip.file(`medical/${baseName}.${ext}`, blob)
        }
        if (gen.corporateUrl) {
          const blob = await urlToBlob(gen.corporateUrl)
          const ext = getExtension(blob.type || "image/png")
          zip.file(`corporate/${baseName}.${ext}`, blob)
        }
      }
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = "portraits.zip"
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Скачано ${toDownload.length} портретов`)
    } catch {
      toast.error("Не удалось создать архив")
    }
  }, [visibleEmployees, generationState])

  const handleAddEmployeesInModal = useCallback(
    async (files: FileList | File[]) => {
      await handleDropOrSelect(
        files,
        filterDepartmentId === "_all" ? null : filterDepartmentId
      )
      setAddEmployeesOpen(false)
    },
    [handleDropOrSelect, filterDepartmentId]
  )

  if (!hasApiKey) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <AlertCircle className="size-8 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Требуется API-ключ</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Настройте API-ключ Gemini в настройках перед генерацией портретов.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 size-4" />
              Открыть настройки
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Первая строка: три кнопки + переключатель режима */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => setAddDeptOpen(true)}
          disabled={isProcessing}
        >
          <FolderPlus className="mr-2 size-4" />
          Добавить отдел
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => setAddEmployeesOpen(true)}
          disabled={isProcessing || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
              {uploadProgress ?? "Загрузка..."}
            </>
          ) : (
            <>
              <UserPlus className="mr-2 size-4" />
              Добавить сотрудников
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(
            "h-9 min-w-[140px]",
            isProcessing && "cursor-wait !opacity-100"
          )}
          onClick={handleGenerateVisible}
          disabled={isProcessing || visibleEmployees.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
              Генерация...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Сгенерировать
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0"
          onClick={handleDownloadAll}
          disabled={isProcessing}
        >
          <Download className="mr-2 size-4 shrink-0" />
          Скачать все
        </Button>
        </div>
        <GenerateModeSwitch
          value={generateMode}
          onChange={(v) => setGenerateMode(v)}
          disabled={isProcessing}
        />
      </div>

      {/* Карточки отделов */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setFilterDepartmentId("_all")}
          disabled={isProcessing}
          className={cn(
            "flex min-h-[88px] flex-col items-stretch justify-between rounded-none border px-3 py-2 text-left transition-colors",
            filterDepartmentId === "_all"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card hover:bg-muted/50"
          )}
        >
          <span className="text-sm font-medium">Все сотрудники</span>
          <span className="mt-1 self-end text-2xl font-semibold tabular-nums text-muted-foreground">
            {allEmployees.length}
          </span>
        </button>
        {departments.map((d) => {
          const count = employees.filter((e) => e.departmentId === d.id).length
          return (
            <div
              key={d.id}
              className={cn(
                "relative flex min-h-[88px] flex-col items-stretch justify-between rounded-none border px-3 py-2 text-left transition-colors",
                filterDepartmentId === d.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <button
                type="button"
                onClick={() => setFilterDepartmentId(d.id)}
                disabled={isProcessing}
                className="absolute inset-0 z-0 rounded-none"
                aria-label={`Выбрать отдел ${d.name}`}
              />
              <div className="relative z-10 flex flex-1 flex-col justify-between pointer-events-none">
                <div className="flex items-start gap-1 pr-10">
                  <span className="line-clamp-2 min-w-0 flex-1 pt-0.5 text-sm font-medium">
                    {d.name}
                  </span>
                </div>
                <span className="mt-1 self-end text-2xl font-semibold tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
              <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 pointer-events-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded"
                  onClick={() => {
                    setEditDeptId(d.id)
                    setEditDeptName(d.name)
                  }}
                  disabled={isProcessing}
                  aria-label="Редактировать отдел"
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 rounded text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteDepartment(d.id)}
                  disabled={isProcessing || count > 0}
                  aria-label="Удалить отдел"
                  title={count > 0 ? "Сначала переместите сотрудников" : "Удалить отдел"}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <input
        ref={inputRefDept}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length && addToDepartmentId !== null)
            handleDropOrSelect(e.target.files, addToDepartmentId)
          e.target.value = ""
          setAddToDepartmentId(null)
        }}
      />
      <input
        ref={inputRefRoot}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleDropOrSelect(e.target.files, null)
          e.target.value = ""
        }}
      />
      <input
        ref={inputRefAddEmployees}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length) handleAddEmployeesInModal(e.target.files)
          e.target.value = ""
        }}
      />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2 lg:gap-10">
        {displayedEmployees.map((emp) => {
          const gen = generationState[emp.id]
          return (
            <BatchPortraitCard
              key={emp.id}
              item={{
                id: emp.id,
                name: emp.name,
                preview: emp.thumbnailUrl ?? emp.photoUrl,
                originalUrl: emp.thumbnailUrl ? emp.photoUrl : undefined,
                status: gen?.status ?? "pending",
                medicalUrl: gen?.medicalUrl ?? null,
                corporateUrl: gen?.corporateUrl ?? null,
                medicalPreviewUrl: gen?.medicalPreviewUrl ?? null,
                corporatePreviewUrl: gen?.corporatePreviewUrl ?? null,
                error: gen?.error,
                departmentId: emp.departmentId ?? undefined,
                departmentName: emp.departmentName,
                feedback: gen?.feedback,
              }}
              index={displayedEmployees.findIndex((e) => e.id === emp.id)}
              isCurrent={currentId === emp.id}
              isProcessing={isProcessing}
              departments={departments}
              onRemove={() => handleRemoveEmployee(emp.id)}
              onNameChange={(name) => handleEmployeeNameChange(emp.id, name)}
              onDepartmentChange={(_, departmentId) =>
                handleEmployeeDepartmentChange(emp.id, departmentId || null)
              }
              showNameInput
              onGenerate={gen?.status !== "complete" ? () => processBatch("one", undefined, emp.id) : undefined}
              onRegenerate={gen?.status === "complete" ? () => processOne(emp, generateMode) : undefined}
              onRegenerateOne={gen?.status === "complete" ? (style) => handleRegenerateOne(emp.id, style) : undefined}
              regeneratingStyle={regeneratingCard?.employeeId === emp.id ? regeneratingCard.style : null}
            />
          )
        })}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCardsPage((p) => p + 1)}
            disabled={isProcessing}
          >
            Показать ещё ({visibleEmployees.length - displayedCount} осталось)
          </Button>
        </div>
      )}

      <Dialog open={addDeptOpen} onOpenChange={setAddDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый отдел</DialogTitle>
            <DialogDescription>
              Создайте новый отдел для сотрудников пакетной обработки.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Название отдела"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeptOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddDepartment}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDeptId} onOpenChange={(open) => !open && setEditDeptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать отдел</DialogTitle>
            <DialogDescription>
              Обновите название выбранного отдела.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Название отдела"
            value={editDeptName}
            onChange={(e) => setEditDeptName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveEditDepartment()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDeptId(null)}>
              Отмена
            </Button>
            <Button onClick={handleSaveEditDepartment}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addEmployeesOpen} onOpenChange={setAddEmployeesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить сотрудников</DialogTitle>
            <DialogDescription>
              Загрузите фотографии новых сотрудников для пакетной генерации портретов.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Перетащите сюда несколько фотографий или нажмите для выбора. Каждое фото — отдельный сотрудник. Рекомендуется не более 50 за раз. Фото сохраняются без сжатия для лучшей похожести при генерации.
          </p>
          <div
            className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed border-border bg-muted/20 py-6 transition-colors hover:border-primary/40 hover:bg-muted/40"
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add("border-primary/50", "bg-primary/5")
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-primary/50", "bg-primary/5")
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove("border-primary/50", "bg-primary/5")
              if (e.dataTransfer.files?.length)
                handleAddEmployeesInModal(e.dataTransfer.files)
            }}
            onClick={() => inputRefAddEmployees.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRefAddEmployees.current?.click()
            }}
          >
            <UserPlus className="size-10 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Перетащите фото сюда или нажмите для выбора
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
