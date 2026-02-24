"use client"

import { useEffect, useState, useCallback } from "react"
import { Building2, Plus, Pencil, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmployeeCards } from "@/components/employee-cards"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog"
import type { Organization, OrganizationEmployee } from "@/lib/types"
import {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  removeOrganization,
} from "@/lib/organizations-store"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function OrganizationsClient() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | null>(null)
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null)
  const [formEmployees, setFormEmployees] = useState<OrganizationEmployee[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadOrgs = useCallback(() => {
    setOrganizations(getAllOrganizations())
  }, [])

  useEffect(() => {
    loadOrgs()
  }, [loadOrgs])

  function openCreate() {
    setEditingId(null)
    setFormName("")
    setFormPhotoUrl(null)
    setFormPhotoFile(null)
    setFormEmployees([])
    setDialogOpen(true)
  }

  function openEdit(org: Organization) {
    setEditingId(org.id)
    setFormName(org.name)
    setFormPhotoUrl(org.photoUrl)
    setFormPhotoFile(null)
    setFormEmployees(org.employees.map((e) => ({ ...e })))
    setDialogOpen(true)
  }

  async function handleAddFiles(files: File[]) {
    const newEmployees: OrganizationEmployee[] = []
    for (const file of files) {
      try {
        const photoUrl = await fileToDataUrl(file)
        const name = file.name.replace(/\.[^.]+$/, "").trim() || "Сотрудник"
        newEmployees.push({
          id: crypto.randomUUID(),
          name,
          photoUrl,
        })
      } catch {
        toast.error(`Не удалось загрузить ${file.name}`)
      }
    }
    if (newEmployees.length) {
      setFormEmployees((prev) => [...prev, ...newEmployees])
      toast.success(`Добавлено фото: ${newEmployees.length}`)
    }
  }

  function handleEmployeeChange(id: string, data: { name: string }) {
    setFormEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, name: data.name } : e))
    )
  }

  function handleEmployeeRemove(id: string) {
    setFormEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  function applySave(name: string, photoUrl: string | null) {
    if (editingId) {
      updateOrganization(editingId, { name, photoUrl, employees: formEmployees })
      loadOrgs()
      setDialogOpen(false)
      toast.success("Организация обновлена")
    } else {
      const org = createOrganization({ name, photoUrl })
      if (formEmployees.length) {
        updateOrganization(org.id, { employees: formEmployees })
      }
      loadOrgs()
      setDialogOpen(false)
      toast.success("Организация создана")
    }
  }

  function handleSave() {
    const name = formName.trim()
    if (!name) {
      toast.error("Введите название организации")
      return
    }

    if (formPhotoFile) {
      const reader = new FileReader()
      reader.onload = () => {
        applySave(name, reader.result as string)
      }
      reader.readAsDataURL(formPhotoFile)
    } else {
      applySave(name, formPhotoUrl)
    }
  }

  function handleConfirmDelete() {
    if (deleteId) {
      removeOrganization(deleteId)
      loadOrgs()
      setDeleteId(null)
      toast.success("Организация удалена")
    }
  }

  const handleOrgPhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith("image/")) {
      setFormPhotoFile(file)
      const url = URL.createObjectURL(file)
      setFormPhotoUrl(url)
    }
    e.target.value = ""
  }, [])

  const clearOrgPhoto = useCallback(() => {
    if (formPhotoUrl && formPhotoFile) URL.revokeObjectURL(formPhotoUrl)
    setFormPhotoUrl(null)
    setFormPhotoFile(null)
  }, [formPhotoUrl, formPhotoFile])

  if (organizations.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Building2 className="size-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Организаций пока нет</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Создайте организацию и добавьте сотрудников для пакетной генерации.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Добавить организацию
            </Button>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Новая организация</DialogTitle>
            </DialogHeader>
            <OrgForm
              formName={formName}
              setFormName={setFormName}
              formPhotoUrl={formPhotoUrl}
              onPhotoSelect={handleOrgPhotoSelect}
              clearOrgPhoto={clearOrgPhoto}
              formEmployees={formEmployees}
              handleEmployeeChange={handleEmployeeChange}
              handleEmployeeRemove={handleEmployeeRemove}
              handleAddFiles={handleAddFiles}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSave}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Организации</h2>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Добавить организацию
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <Card key={org.id}>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{org.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {org.employees.length} сотрудников
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(org)} aria-label="Редактировать">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(org.id)}
                    aria-label="Удалить"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {org.photoUrl && (
                <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
                  <img src={org.photoUrl} alt="" className="size-full object-cover" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактирование организации" : "Новая организация"}</DialogTitle>
          </DialogHeader>
          <OrgForm
            formName={formName}
            setFormName={setFormName}
            formPhotoUrl={formPhotoUrl}
            onPhotoSelect={handleOrgPhotoSelect}
            clearOrgPhoto={clearOrgPhoto}
            formEmployees={formEmployees}
            handleEmployeeChange={handleEmployeeChange}
            handleEmployeeRemove={handleEmployeeRemove}
            handleAddFiles={handleAddFiles}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить организацию?</AlertDialogTitle>
            <AlertDialogDescription>
              Список сотрудников и данные организации будут удалены. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function OrgForm({
  formName,
  setFormName,
  formPhotoUrl,
  onPhotoSelect,
  clearOrgPhoto,
  formEmployees,
  handleEmployeeChange,
  handleEmployeeRemove,
  handleAddFiles,
}: {
  formName: string
  setFormName: (v: string) => void
  formPhotoUrl: string | null
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  clearOrgPhoto: () => void
  formEmployees: OrganizationEmployee[]
  handleEmployeeChange: (id: string, data: { name: string }) => void
  handleEmployeeRemove: (id: string) => void
  handleAddFiles: (files: File[]) => void
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="org-name">Название организации *</Label>
        <Input
          id="org-name"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Например: Поликлиника №1"
        />
      </div>
      <div className="space-y-2">
        <Label>Фото организации (необязательно)</Label>
        {formPhotoUrl ? (
          <div className="relative inline-block">
            <img src={formPhotoUrl} alt="" className="max-h-32 rounded-md border object-cover" />
            <Button type="button" variant="secondary" size="icon" className="absolute right-1 top-1 size-7" onClick={clearOrgPhoto}>
              ×
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground underline">
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoSelect} />
            Выбрать фото
          </label>
        )}
      </div>
      <div className="space-y-2">
        <Label>Сотрудники</Label>
        <EmployeeCards
          items={formEmployees}
          onChange={handleEmployeeChange}
          onRemove={handleEmployeeRemove}
          onFilesAdded={handleAddFiles}
        />
      </div>
    </div>
  )
}
