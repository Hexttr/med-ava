"use client"

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react"
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Search,
  SearchCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserSearch,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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

interface VotePanelProps {
  title: string
  description: string
  imageUrl: string | null
  currentVote: FeedbackVoteValue | null
  voting: boolean
  onVote: (vote: FeedbackVoteValue) => void
  onOpen: (url: string) => void
}

interface PreviewPanelProps {
  title: string
  description: string
  imageUrl: string | null
  muted?: boolean
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

function PreviewPanel({ title, description, imageUrl, muted = false, onOpen }: PreviewPanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/90 shadow-sm backdrop-blur",
        muted && "bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
          <ImageIcon className="size-3.5" />
          Сравнение
        </Badge>
      </div>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
        <PanelImage imageUrl={imageUrl} title={title} onOpen={onOpen} />
      </div>
    </div>
  )
}

function VotePanel({ title, description, imageUrl, currentVote, voting, onVote, onOpen }: VotePanelProps) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/90 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {currentVote ? (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1.5",
              currentVote === "like"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            )}
          >
            <BadgeCheck className="size-3.5" />
            {currentVote === "like" ? "Выбрано: нравится" : "Выбрано: не нравится"}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 gap-1.5">
            <Sparkles className="size-3.5" />
            Оцените фото
          </Badge>
        )}
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
        <PanelImage imageUrl={imageUrl} title={title} onOpen={onOpen} />
      </div>

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

  const selectedMeta = useMemo(
    () => results.find((item) => item.employeeId === selectedEmployeeId) ?? null,
    [results, selectedEmployeeId]
  )

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      toast.error("Введите минимум 2 символа")
      return
    }

    setSearching(true)
    setHasSearched(true)
    try {
      const nextResults = await searchPublicReview(trimmed)
      setResults(nextResults)
      setSelectedEmployeeId(null)
      setSelectedEmployee(null)
    } catch (error) {
      setResults([])
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить поиск")
    } finally {
      setSearching(false)
    }
  }

  async function handleSelectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId)
    setLoadingEmployee(true)
    try {
      const payload = await fetchPublicReviewEmployee(employeeId)
      setSelectedEmployee(payload)
    } catch (error) {
      setSelectedEmployee(null)
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить портреты")
    } finally {
      setLoadingEmployee(false)
    }
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
                  Введите часть имени, выберите нужное ФИО и поставьте отдельную оценку для медицинского и корпоративного портрета.
                </p>
              </div>

              <div className="mx-auto mt-8 max-w-4xl rounded-[1.5rem] border border-border/70 bg-background/90 p-4 shadow-sm md:p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:text-sm">
                  <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                    <SearchCheck className="size-3.5" />
                    1. Найдите себя
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                    <ImageIcon className="size-3.5" />
                    2. Сравните фото
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
                    <ThumbsUp className="size-3.5" />
                    3. Оцените результат
                  </Badge>
                </div>

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

          <section className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="h-fit rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur xl:sticky xl:top-6">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Результаты поиска</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Выберите нужного сотрудника из списка.
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    {results.length} найдено
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!hasSearched && (
                  <div className="rounded-[1.25rem] border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                    Введите часть имени в поиске выше, чтобы увидеть подходящие ФИО.
                  </div>
                )}

                {hasSearched && !searching && results.length === 0 && (
                  <div className="rounded-[1.25rem] border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                    Ничего не найдено. Попробуйте другую часть фамилии, имени или отчества.
                  </div>
                )}

                <div className="max-h-[34rem] space-y-2 overflow-auto pr-1">
                  {results.map((item) => (
                    <button
                      key={item.employeeId}
                      type="button"
                      onClick={() => handleSelectEmployee(item.employeeId)}
                      className={cn(
                        "w-full rounded-[1.25rem] border px-4 py-3 text-left transition-all",
                        selectedEmployeeId === item.employeeId
                          ? "border-primary/60 bg-primary/[0.08] shadow-sm ring-1 ring-primary/15"
                          : "border-border/70 bg-background/80 hover:border-primary/30 hover:bg-muted/30"
                      )}
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
                </div>
              </CardContent>
            </Card>

            <div className="min-w-0">
              {!selectedEmployeeId && (
                <Card className="rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                  <CardContent className="flex min-h-[460px] flex-col items-center justify-center gap-5 p-8 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserSearch className="size-8" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">Выберите сотрудника из списка</p>
                      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        После выбора откроется текущий набор портретов и блок оценки.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedEmployeeId && loadingEmployee && (
                <Card className="rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                  <CardContent className="flex min-h-[460px] items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      Загрузка карточки сотрудника...
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedEmployee && !loadingEmployee && (
                <Card className="overflow-hidden rounded-[1.5rem] border-border/60 bg-white/90 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                  <CardHeader className="border-b border-border/70 bg-gradient-to-r from-primary/[0.05] via-transparent to-cyan-500/[0.04] pb-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-2xl md:text-3xl">{selectedEmployee.name}</CardTitle>
                        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                          {selectedMeta?.departmentName && (
                            <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-sm">
                              <Building2 className="size-4" />
                              {selectedMeta.departmentName}
                            </Badge>
                          )}
                          {selectedEmployee.hasGeneratedSet && (
                            <Badge className="gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-600">
                              <CheckCircle2 className="size-4 text-emerald-100" />
                              Портреты готовы к оценке
                            </Badge>
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
                      <>
                        <div className="mb-5 grid gap-3 rounded-[1.25rem] border border-border/60 bg-muted/[0.16] p-4 md:grid-cols-3">
                          <div className="rounded-[1rem] border border-border/60 bg-white/80 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Шаг 1
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              Сравните исходное фото с итоговыми вариантами
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-border/60 bg-white/80 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Шаг 2
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              Оцените медицинский портрет отдельно от корпоративного
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-border/60 bg-white/80 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Шаг 3
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              Ваш выбор сохранится сразу после нажатия
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-5 xl:grid-cols-3">
                          <PreviewPanel
                            title="Исходное фото"
                            description="Только для сравнения. Это изображение не участвует в голосовании."
                            imageUrl={selectedEmployee.originalUrl}
                            muted
                            onOpen={setLightboxUrl}
                          />

                          <VotePanel
                            title="Медицинский портрет"
                            description="Оцените, насколько удачно получился официальный медицинский образ."
                            imageUrl={selectedEmployee.medicalUrl}
                            currentVote={selectedEmployee.viewerVotes.medical}
                            voting={votingStyle === "medical"}
                            onVote={(vote) => handleVote("medical", vote)}
                            onOpen={setLightboxUrl}
                          />

                          <VotePanel
                            title="Корпоративный портрет"
                            description="Оцените деловой вариант фото отдельно от медицинского."
                            imageUrl={selectedEmployee.corporateUrl}
                            currentVote={selectedEmployee.viewerVotes.corporate}
                            voting={votingStyle === "corporate"}
                            onVote={(vote) => handleVote("corporate", vote)}
                            onOpen={setLightboxUrl}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
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
