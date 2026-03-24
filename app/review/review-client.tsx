"use client"

/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Loader2,
  Search,
  ThumbsDown,
  ThumbsUp,
  UserSearch,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { fetchPublicReviewEmployee, searchPublicReview, submitPublicReviewVote } from "@/lib/public-review-api"
import type {
  FeedbackVoteValue,
  PortraitStyle,
  PublicReviewEmployeeResponse,
  PublicReviewSearchResult,
} from "@/lib/types"

interface PhotoPanelProps {
  title: string
  imageUrl: string | null
  footer?: string
  currentVote?: FeedbackVoteValue | null
  voting?: boolean
  onVote?: (vote: FeedbackVoteValue) => void
  onOpen: (url: string) => void
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
  if (!imageUrl) {
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
      />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-black/55 px-3 py-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
        <span>Открыть крупнее</span>
        <ArrowUpRight className="size-4" />
      </div>
    </button>
  )
}

function PhotoPanel({
  title,
  imageUrl,
  footer,
  currentVote = null,
  voting = false,
  onVote,
  onOpen,
}: PhotoPanelProps) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <div className="flex min-h-[4rem] items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <p className="text-sm font-semibold leading-5 text-foreground">{title}</p>
        {onVote && currentVote ? (
          <div
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              currentVote === "like"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            )}
          >
            <BadgeCheck className="size-3.5" />
          </div>
        ) : null}
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
        <PanelImage imageUrl={imageUrl} title={title} onOpen={onOpen} />
      </div>

      {onVote ? (
        <div className="grid grid-cols-1 gap-2 border-t border-border/70 bg-muted/10 p-3 sm:grid-cols-2">
          <Button
            type="button"
            variant={currentVote === "like" ? "default" : "outline"}
            className={cn(
              "h-11",
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
            className="h-11"
            disabled={!imageUrl || voting}
            onClick={() => onVote("dislike")}
          >
            {voting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ThumbsDown className="mr-2 size-4" />}
            Не нравится
          </Button>
        </div>
      ) : footer ? (
        <div className="border-t border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function ReviewClient() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PublicReviewSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<PublicReviewEmployeeResponse | null>(null)
  const [loadingEmployee, setLoadingEmployee] = useState(false)
  const [votingStyle, setVotingStyle] = useState<PortraitStyle | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function loadEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId)
    setLoadingEmployee(true)
    try {
      const payload = await fetchPublicReviewEmployee(employeeId)
      setSelectedEmployee(payload)
    } catch (error) {
      setSelectedEmployee(null)
      setSelectedEmployeeId(null)
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить портреты")
    } finally {
      setLoadingEmployee(false)
    }
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      toast.error("Введите минимум 2 символа")
      return
    }

    setSearching(true)
    setHasSearched(true)
    setSelectedEmployee(null)
    setSelectedEmployeeId(null)

    try {
      const nextResults = await searchPublicReview(trimmed)
      setResults(nextResults)

      if (nextResults.length === 1) {
        await loadEmployee(nextResults[0].employeeId)
      }
    } catch (error) {
      setResults([])
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить поиск")
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectEmployee(employeeId: string) {
    await loadEmployee(employeeId)
  }

  async function handleVote(style: PortraitStyle, vote: FeedbackVoteValue) {
    if (!selectedEmployee?.galleryItemId) return

    setVotingStyle(style)
    try {
      const payload = await submitPublicReviewVote({
        employeeId: selectedEmployee.employeeId,
        galleryItemId: selectedEmployee.galleryItemId,
        style,
        vote,
      })
      setSelectedEmployee((prev) =>
        prev
          ? {
              ...prev,
              feedback: payload.feedback,
              viewerVotes: payload.viewerVotes,
            }
          : prev
      )
      toast.success("Оценка сохранена")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить голос")
    } finally {
      setVotingStyle(null)
    }
  }

  const showResultsList = hasSearched && !searching && !selectedEmployee && results.length > 1
  const showEmptyState = hasSearched && !searching && !selectedEmployee && results.length === 0

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.10),_transparent_34%),linear-gradient(to_bottom,_#f8fbff,_#ffffff_32%,_#f8fafc_100%)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10rem] top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-[-6rem] top-16 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 md:px-6 md:py-12">
          <section className="mx-auto w-full max-w-5xl">
            <div className="rounded-[2rem] border border-border/60 bg-white/85 px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:px-10 md:py-10">
              <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-sm text-muted-foreground shadow-sm">
                  <UserSearch className="size-4" />
                  Публичная оценка портретов
                </div>
                <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-6xl">
                  Найдите себя и оцените готовые фотографии
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  Введите часть имени и откройте найденный набор фотографий.
                </p>
              </div>

              <div className="mx-auto mt-8 max-w-4xl rounded-[1.5rem] border border-border/70 bg-background/90 p-4 shadow-sm md:p-5">
                <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Например: Иванов, Петрова, Анна"
                      className="h-14 rounded-xl border-border/70 bg-white pl-11 text-base shadow-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-14 min-w-[180px] rounded-xl px-6"
                    disabled={searching}
                  >
                    {searching ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
                    Поиск
                  </Button>
                </form>
              </div>
            </div>
          </section>

          <section className="mt-8">
            {showEmptyState && (
              <Card className="mx-auto max-w-3xl rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                    <Search className="size-6" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">Ничего не найдено</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      Попробуйте другую часть фамилии, имени или отчества.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {showResultsList && (
              <Card className="mx-auto max-w-3xl rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">Найдено несколько вариантов</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Выберите нужное ФИО из списка.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {results.map((item) => (
                    <button
                      key={item.employeeId}
                      type="button"
                      onClick={() => handleSelectEmployee(item.employeeId)}
                      className="w-full rounded-[1.25rem] border border-border/70 bg-background/80 px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-muted/30"
                    >
                      <div className="text-sm font-semibold text-foreground">{item.name}</div>
                      {item.departmentName && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                          <Building2 className="size-3.5" />
                          {item.departmentName}
                        </div>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {selectedEmployeeId && loadingEmployee && (
              <Card className="mx-auto max-w-6xl rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                <CardContent className="flex min-h-[420px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Загрузка карточки сотрудника...
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedEmployee && !loadingEmployee && (
              <div className="mx-auto max-w-6xl">
                <Card className="overflow-hidden rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                  <CardHeader className="border-b border-border/70 bg-gradient-to-r from-primary/[0.05] via-transparent to-cyan-500/[0.04] pb-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-2xl md:text-3xl">{selectedEmployee.name}</CardTitle>
                        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                          {selectedEmployee.departmentName && (
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/85 px-3 py-1 text-sm">
                              <Building2 className="size-4" />
                              {selectedEmployee.departmentName}
                            </div>
                          )}
                          {selectedEmployee.hasGeneratedSet && (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-sm text-white">
                              <CheckCircle2 className="size-4 text-emerald-100" />
                              Портреты готовы к оценке
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/60 bg-white/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                        Нажмите на любое изображение, чтобы открыть его крупнее.
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 md:p-6">
                    {!selectedEmployee.hasGeneratedSet ? (
                      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-dashed border-border bg-muted/10 p-8 text-center">
                        <UserSearch className="size-10 text-muted-foreground/60" />
                        <div>
                          <p className="text-base font-medium text-foreground">Портреты ещё не готовы</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Для этого сотрудника пока нет актуального сгенерированного набора.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-5 xl:grid-cols-3">
                        <PhotoPanel
                          title="Исходное фото"
                          imageUrl={selectedEmployee.originalUrl}
                          footer="Только для сравнения"
                          onOpen={setLightboxUrl}
                        />

                        <PhotoPanel
                          title="Медицинский портрет"
                          imageUrl={selectedEmployee.medicalUrl}
                          currentVote={selectedEmployee.viewerVotes.medical}
                          voting={votingStyle === "medical"}
                          onVote={(vote) => handleVote("medical", vote)}
                          onOpen={setLightboxUrl}
                        />

                        <PhotoPanel
                          title="Корпоративный портрет"
                          imageUrl={selectedEmployee.corporateUrl}
                          currentVote={selectedEmployee.viewerVotes.corporate}
                          voting={votingStyle === "corporate"}
                          onVote={(vote) => handleVote("corporate", vote)}
                          onOpen={setLightboxUrl}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[95vh] max-w-[95vw] overflow-hidden border-0 bg-black/95 p-0"
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
              className="max-h-[95vh] w-auto max-w-full object-contain"
              draggable={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
