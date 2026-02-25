"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  AlertCircle,
  Settings,
  Loader2,
  FolderPlus,
  UserPlus,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Department, Employee } from "@/lib/types"
import { BatchPortraitCard } from "@/components/batch-portrait-card"
import {
  fetchDepartments,
  fetchEmployees,
  createDepartment,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/structure-api"
import { fetchGallery, addGalleryItem } from "@/lib/gallery-api"
import { compressImageForStorage } from "@/lib/image-compress"

type GenStatus = "pending" | "analyzing" | "generating" | "complete" | "error"

interface BatchClientProps {
  hasApiKey: boolean
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) return reject(new Error("Invalid data URL"))
      resolve({ base64: match[2], mimeType: match[1] })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function BatchClient({ hasApiKey }: BatchClientProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [generationState, setGenerationState] = useState<Record<string, { status: GenStatus; medicalUrl?: string | null; corporateUrl?: string | null; error?: string }>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [newDeptName, setNewDeptName] = useState("")
  const [addDeptOpen, setAddDeptOpen] = useState(false)
  const [addToDepartmentId, setAddToDepartmentId] = useState<string | null>(null)
  const [genSelectValue, setGenSelectValue] = useState("_")
  const inputRefRoot = useRef<HTMLInputElement>(null)
  const inputRefDept = useRef<HTMLInputElement>(null)

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
      const byEmployee = new Map<string, { medicalUrl: string; corporateUrl: string }>()
      for (const item of galleryItems) {
        if (item.employeeId && !byEmployee.has(item.employeeId)) {
          byEmployee.set(item.employeeId, {
            medicalUrl: item.medicalUrl,
            corporateUrl: item.corporateUrl,
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

  const rootEmployees = employees.filter((e) => !e.departmentId)
  const employeesByDept = departments.map((d) => ({
    department: d,
    employees: employees.filter((e) => e.departmentId === d.id),
  }))
  const allEmployees = employees
  const completedCount = allEmployees.filter((e) => generationState[e.id]?.status === "complete").length
  const progressPercent = allEmployees.length > 0 ? Math.round((completedCount / allEmployees.length) * 100) : 0

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

  const handleDropOrSelect = useCallback(
    async (files: FileList | File[], departmentId: string | null) => {
      const list = Array.from("length" in files ? files : files).filter((f) => f.type.startsWith("image/"))
      if (list.length === 0) return
      for (const file of list) {
        try {
          const dataUrl = await compressImageForStorage(file).catch(() => {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(file)
            })
          })
          await createEmployee({
            name: "Сотрудник",
            photoUrl: dataUrl,
            departmentId: departmentId ?? undefined,
          })
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Не удалось добавить сотрудника")
        }
      }
      await load()
      if (list.length > 0) toast.success(list.length === 1 ? "Сотрудник добавлен" : "Сотрудники добавлены")
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
    async (emp: Employee) => {
      const id = emp.id
      setCurrentId(id)
      setGenerationState((prev) => ({ ...prev, [id]: { ...prev[id], status: "analyzing" } }))
      try {
        const photoUrl = emp.photoUrl.startsWith("http") || emp.photoUrl.startsWith("data:") ? emp.photoUrl : `${window.location.origin}${emp.photoUrl}`
        const reference = await urlToBase64(photoUrl)
        const formData = new FormData()
        formData.append("employeeName", emp.name)
        const blobRes = await fetch(photoUrl)
        const blob = await blobRes.blob()
        const file = new File([blob], `${emp.name}.jpg`, { type: blob.type || "image/jpeg" })
        formData.append("photo", file)

        const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData })
        if (!analyzeRes.ok) throw new Error("Ошибка анализа")
        const analysis = await analyzeRes.json()

        setGenerationState((prev) => ({ ...prev, [id]: { ...prev[id], status: "generating" } }))

        const [medicalRes, corporateRes] = await Promise.all([
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: analysis.medicalPrompt,
              style: "medical",
              referencePhotoBase64: reference.base64,
              referencePhotoMimeType: reference.mimeType,
            }),
          }),
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: analysis.corporatePrompt,
              style: "corporate",
              referencePhotoBase64: reference.base64,
              referencePhotoMimeType: reference.mimeType,
            }),
          }),
        ])
        let medicalUrl: string | null = null
        let corporateUrl: string | null = null
        if (medicalRes.ok) {
          const data = await medicalRes.json()
          medicalUrl = data.imageUrl
        }
        if (corporateRes.ok) {
          const data = await corporateRes.json()
          corporateUrl = data.imageUrl
        }
        setGenerationState((prev) => ({ ...prev, [id]: { status: "complete", medicalUrl, corporateUrl } }))
        if (medicalUrl && corporateUrl) {
          try {
            await addGalleryItem({
              name: emp.name,
              medicalUrl,
              corporateUrl,
              employeeId: id,
            })
          } catch {
            // ignore
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
      toProcess = toProcess.filter((e) => generationState[e.id]?.status !== "complete")
      if (toProcess.length === 0) {
        toast.info(scope === "one" ? "У сотрудника уже есть портреты" : "Нет сотрудников для обработки")
        return
      }
      setIsProcessing(true)
      for (const emp of toProcess) {
        await processOne(emp)
      }
      setIsProcessing(false)
      toast.success("Обработка завершена")
      setGenSelectValue("_")
    },
    [employees, generationState, processOne]
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddDeptOpen(true)}
          disabled={isProcessing}
        >
          <FolderPlus className="mr-2 size-4" />
          Добавить отдел
        </Button>
        <Select
          value={genSelectValue}
          onValueChange={(v) => {
            setGenSelectValue(v)
            if (v === "_all") processBatch("all")
            else if (v === "_root") processBatch("root")
            else if (v.startsWith("dept_")) processBatch("department", v.slice(5))
          }}
          disabled={isProcessing || employees.length === 0}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Сгенерировать…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Сгенерировать…</SelectItem>
            <SelectItem value="_all">Сгенерировать все</SelectItem>
            <SelectItem value="_root">Только без отдела</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={`dept_${d.id}`}>
                Отдел: {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {allEmployees.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{allEmployees.length} готово
          </Badge>
        )}
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

      {allEmployees.length > 0 && (
        <div className="flex flex-col gap-1">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Без отдела */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Без отдела</h3>
        <div
          className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 py-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files?.length) handleDropOrSelect(e.dataTransfer.files, null)
          }}
          onClick={() => inputRefRoot.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRefRoot.current?.click()
          }}
        >
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
          <UserPlus className="size-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Добавить сотрудника (фото)</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rootEmployees.map((emp) => {
            const gen = generationState[emp.id]
            return (
              <BatchPortraitCard
                key={emp.id}
                item={{
                  id: emp.id,
                  name: emp.name,
                  preview: emp.photoUrl,
                  status: gen?.status ?? "pending",
                  medicalUrl: gen?.medicalUrl ?? null,
                  corporateUrl: gen?.corporateUrl ?? null,
                  error: gen?.error,
                }}
                index={rootEmployees.findIndex((e) => e.id === emp.id)}
                isCurrent={currentId === emp.id}
                isProcessing={isProcessing}
                onRemove={() => handleRemoveEmployee(emp.id)}
                onNameChange={(name) => handleEmployeeNameChange(emp.id, name)}
                showNameInput
                onGenerate={gen?.status !== "complete" ? () => processBatch("one", undefined, emp.id) : undefined}
              />
            )
          })}
        </div>
      </div>

      {/* По отделам */}
      {employeesByDept.map(({ department, employees: deptEmployees }) => (
        <div key={department.id} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{department.name}</h3>
          <div
            className="flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files?.length) handleDropOrSelect(e.dataTransfer.files, department.id)
            }}
            onClick={() => {
              setAddToDepartmentId(department.id)
              setTimeout(() => inputRefDept.current?.click(), 0)
            }}
            role="button"
            tabIndex={0}
          >
            <UserPlus className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Добавить в отдел</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deptEmployees.map((emp) => {
              const gen = generationState[emp.id]
              return (
                <BatchPortraitCard
                  key={emp.id}
                  item={{
                    id: emp.id,
                    name: emp.name,
                    preview: emp.photoUrl,
                    status: gen?.status ?? "pending",
                    medicalUrl: gen?.medicalUrl ?? null,
                    corporateUrl: gen?.corporateUrl ?? null,
                    error: gen?.error,
                  }}
                  index={deptEmployees.findIndex((e) => e.id === emp.id)}
                  isCurrent={currentId === emp.id}
                  isProcessing={isProcessing}
                  onRemove={() => handleRemoveEmployee(emp.id)}
                  onNameChange={(name) => handleEmployeeNameChange(emp.id, name)}
                  showNameInput
                  onGenerate={gen?.status !== "complete" ? () => processBatch("one", undefined, emp.id) : undefined}
                />
              )
            })}
          </div>
        </div>
      ))}

      <Dialog open={addDeptOpen} onOpenChange={setAddDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый отдел</DialogTitle>
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
    </div>
  )
}
