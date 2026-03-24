"use client"

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react"
import {
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
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
  imageUrl: string | null
  currentVote: FeedbackVoteValue | null
  voting: boolean
  onVote: (vote: FeedbackVoteValue) => void
  onOpen: (url: string) => void
}

function VotePanel({ title, imageUrl, currentVote, voting, onVote, onOpen }: VotePanelProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {currentVote && (
          <span className="text-xs text-muted-foreground">
            Ваш выбор сохранён
          </span>
        )}
      </div>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
        {imageUrl ? (
          <button
            type="button"
            onClick={() => onOpen(imageUrl)}
            className="size-full text-left transition hover:opacity-95"
          >
            <img src={imageUrl} alt={title} className="size-full object-cover object-top" />
          </button>
        ) : (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Портрет ещё не готов
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button
          type="button"
          variant={currentVote === "like" ? "default" : "outline"}
          className={cn(currentVote === "like" && "bg-emerald-600 hover:bg-emerald-600/90")}
          disabled={!imageUrl || voting}
          onClick={() => onVote("like")}
        >
          {voting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ThumbsUp className="mr-2 size-4" />}
          Нравится
        </Button>
        <Button
          type="button"
          variant={currentVote === "dislike" ? "destructive" : "outline"}
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
      <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 md:px-6">
          <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-sm text-muted-foreground">
              <UserSearch className="size-4" />
              Публичная оценка портретов
            </div>
            <h1 className="mt-6 text-balance text-3xl font-semibold text-foreground md:text-5xl">
              Найдите себя и оцените готовые фотографии
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Введите часть имени, выберите нужное ФИО и поставьте оценку отдельно для медицинского и корпоративного портрета.
            </p>

            <form onSubmit={handleSearchSubmit} className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Например: Иванов, Петрова, Анна"
                className="h-12 flex-1 text-base"
              />
              <Button type="submit" size="lg" className="h-12 min-w-[160px]" disabled={searching}>
                {searching ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
                Поиск
              </Button>
            </form>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit border-border/70 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Результаты поиска</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!hasSearched && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Сначала выполните поиск по имени.
                  </div>
                )}

                {hasSearched && !searching && results.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Ничего не найдено. Попробуйте ввести другую часть ФИО.
                  </div>
                )}

                <div className="space-y-2">
                  {results.map((item) => (
                    <button
                      key={item.employeeId}
                      type="button"
                      onClick={() => handleSelectEmployee(item.employeeId)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        selectedEmployeeId === item.employeeId
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="text-sm font-medium text-foreground">{item.name}</div>
                      {item.departmentName && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
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
                <Card className="border-border/70 bg-card/80 backdrop-blur">
                  <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
                    <UserSearch className="size-12 text-muted-foreground/60" />
                    <div>
                      <p className="text-base font-medium text-foreground">Выберите сотрудника из списка слева</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        После выбора откроется текущий набор портретов и блок оценки.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedEmployeeId && loadingEmployee && (
                <Card className="border-border/70 bg-card/80 backdrop-blur">
                  <CardContent className="flex min-h-[420px] items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Загрузка карточки сотрудника...
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedEmployee && !loadingEmployee && (
                <Card className="border-border/70 bg-card/80 backdrop-blur">
                  <CardHeader className="border-b border-border/70 pb-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="text-2xl">{selectedEmployee.name}</CardTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {selectedMeta?.departmentName && (
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="size-4" />
                              {selectedMeta.departmentName}
                            </span>
                          )}
                          {selectedEmployee.hasGeneratedSet && (
                            <span className="inline-flex items-center gap-1.5">
                              <CheckCircle2 className="size-4 text-emerald-600" />
                              Портреты готовы к оценке
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 md:p-6">
                    {!selectedEmployee.hasGeneratedSet ? (
                      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                        <UserSearch className="size-10 text-muted-foreground/60" />
                        <div>
                          <p className="text-base font-medium text-foreground">Портреты ещё не готовы</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Для этого сотрудника пока нет актуального сгенерированного набора.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-3">
                        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                            Исходное фото
                          </div>
                          <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30">
                            {selectedEmployee.originalUrl ? (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(selectedEmployee.originalUrl!)}
                                className="size-full text-left transition hover:opacity-95"
                              >
                                <img
                                  src={selectedEmployee.originalUrl}
                                  alt="Исходное фото"
                                  className="size-full object-cover object-top"
                                />
                              </button>
                            ) : (
                              <div className="flex size-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                                Исходное фото недоступно
                              </div>
                            )}
                          </div>
                          <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                            Это фото показывается только для сравнения и не участвует в голосовании.
                          </div>
                        </div>

                        <VotePanel
                          title="Медицинский портрет"
                          imageUrl={selectedEmployee.medicalUrl}
                          currentVote={selectedEmployee.viewerVotes.medical}
                          voting={votingStyle === "medical"}
                          onVote={(vote) => handleVote("medical", vote)}
                          onOpen={setLightboxUrl}
                        />

                        <VotePanel
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
              )}
            </div>
          </section>
        </div>
      </main>

      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent showCloseButton={false} className="max-h-[95vh] max-w-[95vw] overflow-hidden border-0 bg-black/95 p-0">
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
