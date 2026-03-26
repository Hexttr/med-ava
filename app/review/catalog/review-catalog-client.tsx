"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  Building2,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { GalleryFeedbackBadges } from "@/components/gallery-feedback-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fetchPublicReviewCatalog, submitPublicReviewComment, submitPublicReviewVote } from "@/lib/public-review-api"
import type {
  FeedbackVoteValue,
  GalleryImageComment,
  ReviewImageStyle,
  PublicReviewCatalogDepartment,
  PublicReviewCatalogEmployee,
} from "@/lib/types"

type DisplayMode = "before-after" | "medical-only" | "corporate-only"

const COMMENT_MAX_LENGTH = 240
const REVIEW_STYLES: ReviewImageStyle[] = ["original", "medical", "corporate"]

function imageCommentKey(galleryItemId: string, style: ReviewImageStyle) {
  return `${galleryItemId}:${style}`
}

function PanelImage({
  imageUrl,
  title,
  onOpen,
}: {
  imageUrl: string | null
  title: string
  onOpen: (url: string) => void
}) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) {
    return (
      <div className="flex size-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Изображение пока недоступно
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(imageUrl)}
      className="group relative size-full text-left"
    >
      <img
        src={imageUrl}
        alt={title}
        className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-black/55 px-3 py-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
        <span>Открыть крупнее</span>
        <ArrowUpRight className="size-4" />
      </div>
    </button>
  )
}

function ReviewPanel({
  title,
  style,
  imageUrl,
  currentVote,
  feedback,
  comment,
  commentDraft,
  voting,
  savingComment,
  onVote,
  onCommentDraftChange,
  onCommentSave,
  onOpen,
  helperText,
}: {
  title: string
  style: ReviewImageStyle
  imageUrl: string | null
  currentVote: FeedbackVoteValue | null
  feedback?: { likes: number; dislikes: number }
  comment: GalleryImageComment | null
  commentDraft: string
  voting: boolean
  savingComment: boolean
  onVote: (vote: FeedbackVoteValue) => void
  onCommentDraftChange: (value: string) => void
  onCommentSave: () => void
  onOpen: (url: string) => void
  helperText: string
}) {
  const hasChanges = commentDraft.trim() !== (comment?.text ?? "")

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white/95 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {helperText}
          </p>
        </div>
        <GalleryFeedbackBadges summary={feedback} className="shrink-0" />
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/20">
        <PanelImage imageUrl={imageUrl} title={title} onOpen={onOpen} />
      </div>

      <div className="space-y-3 border-t border-slate-200/80 bg-slate-50/80 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={currentVote === "like" ? "default" : "outline"}
            className={cn(
              "h-10",
              currentVote === "like" && "bg-emerald-600 text-white hover:bg-emerald-600/90"
            )}
            disabled={!imageUrl || voting}
            onClick={() => onVote("like")}
          >
            {voting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ThumbsUp className="mr-2 size-4" />}
            Нравится
          </Button>
          <Button
            type="button"
            variant={currentVote === "dislike" ? "destructive" : "outline"}
            className="h-10"
            disabled={!imageUrl || voting}
            onClick={() => onVote("dislike")}
          >
            {voting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ThumbsDown className="mr-2 size-4" />}
            Не нравится
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <MessageSquareText className="size-3.5" />
              Миниотзыв
            </div>
            {comment?.updatedAt ? (
              <span className="text-[11px] text-muted-foreground">
                Обновлено {new Date(comment.updatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
          <Textarea
            value={commentDraft}
            onChange={(event) => onCommentDraftChange(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
            placeholder={
              style === "original"
                ? "Например: исходник слишком тёмный, мягкий или требует другой кадрировки"
                : style === "medical"
                ? "Например: удачный медицинский образ, но стоит доработать фон"
                : "Например: хороший деловой образ, но выражение лица слишком строгое"
            }
            className="min-h-[92px] rounded-xl border-slate-200/90 bg-white text-sm shadow-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {commentDraft.trim().length}/{COMMENT_MAX_LENGTH}
            </span>
            <Button
              type="button"
              size="sm"
              variant={hasChanges ? "default" : "outline"}
              disabled={savingComment || !imageUrl || !hasChanges}
              onClick={onCommentSave}
            >
              {savingComment ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Сохранить отзыв
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function updateEmployeeInDepartments(
  departments: PublicReviewCatalogDepartment[],
  employeeId: string,
  updater: (employee: PublicReviewCatalogEmployee) => PublicReviewCatalogEmployee
) {
  return departments.map((department) => ({
    ...department,
    employees: department.employees.map((employee) =>
      employee.employeeId === employeeId ? updater(employee) : employee
    ),
  }))
}

export function ReviewCatalogClient() {
  const [departments, setDepartments] = useState<PublicReviewCatalogDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all")
  const [displayMode, setDisplayMode] = useState<DisplayMode>("before-after")
  const [query, setQuery] = useState("")
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [votingTarget, setVotingTarget] = useState<string | null>(null)
  const [savingCommentTarget, setSavingCommentTarget] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setLoading(true)
      try {
        const payload = await fetchPublicReviewCatalog()
        if (cancelled) return
        setDepartments(payload.departments)
      } catch (error) {
        if (cancelled) return
        toast.error(error instanceof Error ? error.message : "Не удалось загрузить каталог")
        setDepartments([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase("ru")
  const filteredDepartments = useMemo(() => {
    const nextDepartments = departments
      .map((department) => {
        const employees = department.employees.filter((employee) =>
          normalizedQuery ? employee.name.toLocaleLowerCase("ru").includes(normalizedQuery) : true
        )
        return {
          ...department,
          employeeCount: employees.length,
          employees,
        }
      })
      .filter((department) => department.employees.length > 0)

    if (selectedDepartmentId === "all") return nextDepartments
    return nextDepartments.filter((department) => (department.departmentId ?? "__no_department__") === selectedDepartmentId)
  }, [departments, normalizedQuery, selectedDepartmentId])

  const totalVisibleEmployees = filteredDepartments.reduce((sum, department) => sum + department.employeeCount, 0)
  const visibleProgress = useMemo(() => {
    const stylesForMode =
      displayMode === "before-after"
        ? REVIEW_STYLES
        : displayMode === "medical-only"
          ? (["medical"] as ReviewImageStyle[])
          : (["corporate"] as ReviewImageStyle[])

    let likes = 0
    let dislikes = 0
    for (const department of filteredDepartments) {
      for (const employee of department.employees) {
        for (const style of stylesForMode) {
          likes += employee.feedback[style].likes
          dislikes += employee.feedback[style].dislikes
        }
      }
    }

    const total = likes + dislikes
    const likePct = total > 0 ? Math.round((likes / total) * 100) : 0
    return { likes, dislikes, total, likePct }
  }, [displayMode, filteredDepartments])

  function getCommentDraft(employee: PublicReviewCatalogEmployee, style: ReviewImageStyle) {
    const key = imageCommentKey(employee.galleryItemId, style)
    return commentDrafts[key] ?? employee.comments[style]?.text ?? ""
  }

  async function handleVote(employee: PublicReviewCatalogEmployee, style: ReviewImageStyle, vote: FeedbackVoteValue) {
    const key = `${employee.employeeId}:${style}`
    setVotingTarget(key)
    try {
      const payload = await submitPublicReviewVote({
        employeeId: employee.employeeId,
        galleryItemId: employee.galleryItemId,
        style,
        vote,
      })
      setDepartments((prev) =>
        updateEmployeeInDepartments(prev, employee.employeeId, (item) => ({
          ...item,
          feedback: payload.feedback,
          viewerVotes: payload.viewerVotes,
        }))
      )
      toast.success("Оценка сохранена")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить голос")
    } finally {
      setVotingTarget(null)
    }
  }

  async function handleCommentSave(employee: PublicReviewCatalogEmployee, style: ReviewImageStyle) {
    const key = imageCommentKey(employee.galleryItemId, style)
    setSavingCommentTarget(key)
    try {
      const payload = await submitPublicReviewComment({
        employeeId: employee.employeeId,
        galleryItemId: employee.galleryItemId,
        style,
        commentText: getCommentDraft(employee, style),
      })
      setDepartments((prev) =>
        updateEmployeeInDepartments(prev, employee.employeeId, (item) => ({
          ...item,
          comments: payload.comments,
        }))
      )
      setCommentDrafts((prev) => ({
        ...prev,
        [key]: payload.comments[style]?.text ?? "",
      }))
      toast.success("Отзыв сохранён")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить отзыв")
    } finally {
      setSavingCommentTarget(null)
    }
  }

  function renderEmployeeCard(employee: PublicReviewCatalogEmployee) {
    const contentGridClass =
      displayMode === "before-after"
        ? "grid gap-4 xl:grid-cols-3"
        : "grid gap-4"

    return (
      <Card
        key={employee.employeeId}
        className="overflow-hidden rounded-[1.5rem] border-slate-300/90 bg-white/96 shadow-[0_16px_48px_rgba(15,23,42,0.10)]"
      >
        <CardHeader className="border-b border-slate-200/80 bg-gradient-to-r from-primary/[0.04] to-cyan-500/[0.03] pb-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">{employee.name}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {employee.departmentName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1">
                    <Building2 className="size-4" />
                    {employee.departmentName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  <Users className="size-4" />
                  Актуальный набор для оценки
                </span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Нажмите на изображение, чтобы открыть крупнее
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-5">
          <div className={contentGridClass}>
            {displayMode === "before-after" ? (
              <ReviewPanel
                title="Исходное фото"
                style="original"
                imageUrl={employee.originalUrl}
                currentVote={employee.viewerVotes.original}
                feedback={employee.feedback.original}
                comment={employee.comments.original}
                commentDraft={getCommentDraft(employee, "original")}
                voting={votingTarget === `${employee.employeeId}:original`}
                savingComment={savingCommentTarget === imageCommentKey(employee.galleryItemId, "original")}
                onVote={(vote) => handleVote(employee, "original", vote)}
                onCommentDraftChange={(value) =>
                  setCommentDrafts((prev) => ({
                    ...prev,
                    [imageCommentKey(employee.galleryItemId, "original")]: value,
                  }))
                }
                onCommentSave={() => handleCommentSave(employee, "original")}
                onOpen={setLightboxUrl}
                helperText="Оцените качество исходного фото: свет, резкость, ракурс и пригодность для генерации."
              />
            ) : null}

            {displayMode !== "corporate-only" ? (
              <ReviewPanel
                title="Медицинский портрет"
                style="medical"
                imageUrl={employee.medicalUrl}
                currentVote={employee.viewerVotes.medical}
                feedback={employee.feedback.medical}
                comment={employee.comments.medical}
                commentDraft={getCommentDraft(employee, "medical")}
                voting={votingTarget === `${employee.employeeId}:medical`}
                savingComment={savingCommentTarget === imageCommentKey(employee.galleryItemId, "medical")}
                onVote={(vote) => handleVote(employee, "medical", vote)}
                onCommentDraftChange={(value) =>
                  setCommentDrafts((prev) => ({
                    ...prev,
                    [imageCommentKey(employee.galleryItemId, "medical")]: value,
                  }))
                }
                onCommentSave={() => handleCommentSave(employee, "medical")}
                onOpen={setLightboxUrl}
                helperText="Оцените изображение и при необходимости обновите короткий комментарий."
              />
            ) : null}

            {displayMode !== "medical-only" ? (
              <ReviewPanel
                title="Корпоративный портрет"
                style="corporate"
                imageUrl={employee.corporateUrl}
                currentVote={employee.viewerVotes.corporate}
                feedback={employee.feedback.corporate}
                comment={employee.comments.corporate}
                commentDraft={getCommentDraft(employee, "corporate")}
                voting={votingTarget === `${employee.employeeId}:corporate`}
                savingComment={savingCommentTarget === imageCommentKey(employee.galleryItemId, "corporate")}
                onVote={(vote) => handleVote(employee, "corporate", vote)}
                onCommentDraftChange={(value) =>
                  setCommentDrafts((prev) => ({
                    ...prev,
                    [imageCommentKey(employee.galleryItemId, "corporate")]: value,
                  }))
                }
                onCommentSave={() => handleCommentSave(employee, "corporate")}
                onOpen={setLightboxUrl}
                helperText="Оцените изображение и при необходимости обновите короткий комментарий."
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_34%),linear-gradient(to_bottom,_#e7effb,_#f8fbff_30%,_#edf3f8_100%)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10rem] top-16 h-80 w-80 rounded-full bg-blue-500/14 blur-3xl" />
          <div className="absolute right-[-8rem] top-8 h-96 w-96 rounded-full bg-cyan-400/14 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 md:px-6 md:py-10">
          <section className="rounded-[2rem] border border-slate-300/90 bg-white/96 px-6 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1 text-sm text-muted-foreground">
                  <Building2 className="size-4" />
                  Каталог оценки по отделам
                </div>
                <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Удобный обзор портретов по всем отделам
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  Выберите отдел, переключайте режим просмотра и оценивайте каждое сгенерированное изображение с коротким комментарием прямо в каталоге.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                <Card className="rounded-[1.25rem] border-blue-600/80 bg-blue-600 shadow-[0_14px_34px_rgba(37,99,235,0.28)]">
                  <CardContent className="p-4 text-white">
                    <div className="text-xs uppercase tracking-[0.08em] text-blue-100">Всего<br />отделов</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{departments.length}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.25rem] border-blue-600/80 bg-blue-600 shadow-[0_14px_34px_rgba(37,99,235,0.28)]">
                  <CardContent className="p-4 text-white">
                    <div className="text-xs uppercase tracking-[0.08em] text-blue-100">Сотрудников с наборами</div>
                    <div className="mt-2 text-3xl font-semibold text-white">
                      {departments.reduce((sum, department) => sum + department.employeeCount, 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="h-fit rounded-[1.5rem] border-blue-200/90 bg-gradient-to-b from-blue-50 via-white to-blue-50/80 shadow-[0_18px_50px_rgba(37,99,235,0.12)] xl:sticky xl:top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Отделы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedDepartmentId("all")}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    selectedDepartmentId === "all"
                      ? "border-blue-500/50 bg-blue-500/12 shadow-sm"
                      : "border-blue-200/90 bg-white/95 hover:border-blue-300 hover:bg-blue-50/85"
                  )}
                >
                  <div className="text-sm font-semibold text-foreground">Все отделы</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {departments.reduce((sum, department) => sum + department.employeeCount, 0)} сотрудников
                  </div>
                </button>

                {departments.map((department) => {
                  const departmentKey = department.departmentId ?? "__no_department__"
                  return (
                    <button
                      key={departmentKey}
                      type="button"
                      onClick={() => setSelectedDepartmentId(departmentKey)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition",
                        selectedDepartmentId === departmentKey
                          ? "border-blue-500/50 bg-blue-500/12 shadow-sm"
                          : "border-blue-200/90 bg-white/95 hover:border-blue-300 hover:bg-blue-50/85"
                      )}
                    >
                      <div className="text-sm font-semibold text-foreground">{department.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{department.employeeCount} сотрудников</div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[1.5rem] border-slate-300/90 bg-white/96 shadow-[0_16px_48px_rgba(15,23,42,0.10)]">
                <CardContent className="space-y-4 p-4 md:p-5">
                  <div className="overflow-hidden rounded-full border border-slate-200/90 bg-slate-100">
                    <div className="flex h-3 w-full">
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${visibleProgress.total > 0 ? visibleProgress.likePct : 50}%` }}
                      />
                      <div
                        className="bg-rose-500 transition-all"
                        style={{ width: `${visibleProgress.total > 0 ? 100 - visibleProgress.likePct : 50}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <ThumbsUp className="size-4" />
                      <span className="font-medium">{visibleProgress.likes}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {visibleProgress.total > 0
                        ? `Соотношение оценок в текущем представлении: ${visibleProgress.likePct}% / ${100 - visibleProgress.likePct}%`
                        : "Оценок пока нет"}
                    </div>
                    <div className="flex items-center gap-2 text-rose-700">
                      <ThumbsDown className="size-4" />
                      <span className="font-medium">{visibleProgress.dislikes}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <Tabs value={displayMode} onValueChange={(value) => setDisplayMode(value as DisplayMode)}>
                      <TabsList className="h-auto rounded-xl bg-slate-100 p-1">
                        <TabsTrigger value="before-after" className="rounded-lg px-4 py-2">
                          Было / стало
                        </TabsTrigger>
                        <TabsTrigger value="medical-only" className="rounded-lg px-4 py-2">
                          Только медицинские
                        </TabsTrigger>
                        <TabsTrigger value="corporate-only" className="rounded-lg px-4 py-2">
                          Только бизнес
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="relative w-full xl:max-w-sm">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск по ФИО внутри каталога"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/80 pl-11"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                      <Users className="size-4" />
                      {totalVisibleEmployees} сотрудников в текущем представлении
                    </span>
                    {displayMode === "before-after" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                        <ImageIcon className="size-4" />
                        Исходники тоже участвуют в оценке
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                      <MessageSquareText className="size-4" />
                      Один общий миниотзыв на изображение
                    </span>
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <Card className="rounded-[1.5rem] border-slate-300/90 bg-white/96 shadow-[0_16px_48px_rgba(15,23,42,0.10)]">
                  <CardContent className="flex min-h-[320px] items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      Загрузка каталога отделов...
                    </div>
                  </CardContent>
                </Card>
              ) : filteredDepartments.length === 0 ? (
                <Card className="rounded-[1.5rem] border-slate-300/90 bg-white/96 shadow-[0_16px_48px_rgba(15,23,42,0.10)]">
                  <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
                    <Search className="size-8 text-muted-foreground/60" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">Ничего не найдено</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Попробуйте изменить отдел или уточнить поисковый запрос.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredDepartments.map((department) => {
                  const gridClass =
                    displayMode === "before-after"
                      ? "grid gap-6"
                      : "grid gap-6 xl:grid-cols-2"

                  return (
                    <section key={department.departmentId ?? "__no_department__"} className="space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{department.name}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {department.employeeCount} сотрудников доступны для оценки
                          </p>
                        </div>
                      </div>

                      <div className={gridClass}>
                        {department.employees.map((employee) => renderEmployeeCard(employee))}
                      </div>
                    </section>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </main>

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[95vh] max-w-[95vw] items-center justify-center overflow-hidden border-0 bg-black/95 p-0"
        >
          <DialogTitle className="sr-only">Просмотр фотографии</DialogTitle>
          {lightboxUrl && (
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute right-2 top-2 z-10 rounded-none bg-white/20 p-1.5 text-white hover:bg-white/30"
              aria-label="Закрыть"
            >
              <X className="size-5" />
            </button>
          )}
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt=""
              className="mx-auto block max-h-[95vh] w-auto max-w-full object-contain"
              draggable={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
