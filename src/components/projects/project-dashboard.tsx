"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import {
  clearPendingConversion,
  usePendingConversion,
} from "@/lib/anonymous-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  defaultStyle: string
  updatedAt: string
  _count?: { references: number }
}

const styles = [
  ["apa", "APA 7th"],
  ["mla", "MLA 9"],
  ["chicago", "Chicago"],
  ["harvard", "Harvard"],
  ["ieee", "IEEE"],
  ["vancouver", "Vancouver"],
  ["bibtex", "BibTeX"],
] as const

function getStyleLabel(styleKey: string) {
  const found = styles.find(([k]) => k === styleKey.toLowerCase())
  return found ? found[1] : styleKey.toUpperCase()
}

function formatRelativeTime(dateStr: string) {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffSeconds < 60) return "剛剛更新"
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} 分鐘前更新`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} 小時前更新`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays} 天前更新`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths} 個月前更新`
    return date.toLocaleDateString("zh-TW")
  } catch {
    return "最近更新"
  }
}

interface ProjectDashboardProps {
  initialProjects: ProjectSummary[]
  loadError?: string
}

export function ProjectDashboard({
  initialProjects,
  loadError: initialLoadError,
}: ProjectDashboardProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [defaultStyle, setDefaultStyle] = useState("apa")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState(initialLoadError ?? "")
  const [reloading, setReloading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const pendingConversion = usePendingConversion()

  // Rename state
  const [projectToRename, setProjectToRename] = useState<ProjectSummary | null>(
    null,
  )
  const [renameName, setRenameName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState("")

  // Delete state
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)

  async function loadProjects() {
    setReloading(true)
    try {
      const response = await fetch("/api/projects", {
        headers: { "Cache-Control": "no-cache" },
      })
      const payload = (await response.json()) as {
        projects?: ProjectSummary[]
        error?: string
      }
      if (response.status === 401) {
        router.refresh()
        return
      }
      if (!response.ok || !payload.projects) {
        setLoadError(payload.error || "無法載入專案。")
        return
      }
      setProjects(payload.projects)
      setLoadError("")
    } catch {
      setLoadError("無法連線到專案服務，請稍後再試。")
    } finally {
      setReloading(false)
    }
  }

  function openCreateDialog() {
    setError("")
    setName("")
    setDescription("")
    setDefaultStyle("apa")
    setCreateDialogOpen(true)
  }

  async function createProject() {
    if (!name.trim()) {
      setError("請輸入專案名稱。")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const projectName = name.trim()
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: description || null,
          defaultStyle,
        }),
      })
      const payload = (await response.json()) as {
        project?: ProjectSummary
        error?: string
      }
      if (!response.ok || !payload.project) {
        toast.error(payload.error || "建立專案失敗。")
        return
      }
      setProjects((current) => [payload.project as ProjectSummary, ...current])
      setCreateDialogOpen(false)
      setName("")
      setDescription("")
      setDefaultStyle("apa")
      toast.success(`已建立專案「${projectName}」。`)
      router.push(`/projects/${payload.project.id}`)
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
    } finally {
      setSubmitting(false)
    }
  }

  function openRenameDialog(project: ProjectSummary) {
    setProjectToRename(project)
    setRenameName(project.name)
    setRenameError("")
  }

  async function handleRenameProject() {
    const project = projectToRename
    if (!project) return

    const trimmed = renameName.trim()
    if (!trimmed) {
      setRenameError("請輸入專案名稱。")
      return
    }
    if (trimmed === project.name) {
      setProjectToRename(null)
      return
    }

    setRenaming(true)
    setRenameError("")
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const payload = (await response.json()) as {
        project?: ProjectSummary
        error?: string
      }
      if (!response.ok || !payload.project) {
        setRenameError(payload.error || "重新命名失敗。")
        return
      }
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? (payload.project as ProjectSummary) : item,
        ),
      )
      setProjectToRename(null)
      toast.success(`已更名為「${trimmed}」。`)
    } catch {
      setRenameError("無法連線到專案服務，請稍後再試。")
    } finally {
      setRenaming(false)
    }
  }

  async function confirmDeleteProject() {
    const project = projectToDelete
    if (!project) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(payload.error || "刪除專案失敗。")
        return
      }
      setProjects((current) => current.filter((item) => item.id !== project.id))
      setProjectToDelete(null)
      toast.success(`已刪除專案「${project.name}」。`)
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppShell
      projects={projects}
      onProjectCreated={(newProject) => {
        setProjects((current) => [newProject as ProjectSummary, ...current])
      }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 sm:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-semibold tracking-[-0.05em]">
              我的專案
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              管理已儲存的論文文獻與引用格式。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/convert"
              className="text-sm font-semibold text-muted-foreground hover:text-accent transition-colors"
            >
              快速轉換
            </Link>
            {!loadError && projects.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={openCreateDialog}
                className="rounded-none"
              >
                <Plus className="size-4" /> 新專案
              </Button>
            )}
          </div>
        </div>

        {pendingConversion && (
          <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-accent/40 bg-accent/10 p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  您剛才快速轉換了 {pendingConversion.count} 筆文獻尚未保存
                </p>
                <p className="text-xs text-muted-foreground">
                  建立新專案即可自動載入並儲存這些文獻。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                onClick={openCreateDialog}
                className="rounded-none"
              >
                <Plus className="size-4" /> 建立專案並儲存
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => clearPendingConversion()}
                className="rounded-none text-muted-foreground hover:text-foreground"
              >
                忽略
              </Button>
            </div>
          </div>
        )}

        {loadError ? (
          <Card className="rounded-none border-foreground/30">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm text-destructive" role="alert">
                {loadError}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadProjects()}
                disabled={reloading}
                className="rounded-none"
              >
                {reloading ? "重試中…" : "重試"}
              </Button>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="rounded-none border-dashed">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <FolderOpen className="mb-4 size-10 text-accent" />
              <h2 className="font-heading text-2xl font-semibold tracking-[-0.04em]">
                還沒有任何專案
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                建立第一個專案，就能把轉換後的文獻保存下來、排序並匯出。
              </p>
              <Button
                type="button"
                onClick={openCreateDialog}
                className="mt-5 rounded-none"
              >
                <Plus className="size-4" /> 建立第一個專案
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="group relative flex flex-col justify-between rounded-none border border-border bg-card p-5 transition-colors hover:border-accent cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/projects/${project.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-heading text-xl font-semibold tracking-[-0.04em] text-foreground group-hover:text-accent transition-colors"
                    >
                      {project.name}
                    </Link>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="relative shrink-0"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 rounded-none text-muted-foreground hover:text-foreground"
                              aria-label="專案選單"
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openRenameDialog(project)}
                          >
                            <Pencil className="size-4" />
                            <span>重新命名</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setProjectToDelete(project)}
                          >
                            <Trash2 className="size-4" />
                            <span>刪除專案</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                    {project.description || "沒有專案描述"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {project._count?.references ?? 0} 筆文獻
                  </span>
                  <span>·</span>
                  <span>預設 {getStyleLabel(project.defaultStyle)}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(project.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !submitting) {
            setCreateDialogOpen(false)
            setError("")
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup className="rounded-none">
              <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                <DialogTitle>建立專案</DialogTitle>
                <DialogDescription className="mt-1">
                  建立專案後，就能保存、整理並匯出文獻。
                </DialogDescription>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span className="font-semibold">專案名稱</span>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={100}
                      placeholder="例如：IEEE ToE 研究文獻"
                      className="rounded-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">描述（選填）</span>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={500}
                      placeholder="這個專案的用途…"
                      className="min-h-24 rounded-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">預設引用格式</span>
                    <select
                      value={defaultStyle}
                      onChange={(event) => setDefaultStyle(event.target.value)}
                      className="h-10 rounded-none border border-input bg-card px-3 text-sm"
                    >
                      {styles.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={submitting}
                        className="rounded-none"
                      >
                        取消
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    onClick={() => void createProject()}
                    disabled={submitting}
                    className="rounded-none"
                  >
                    {submitting ? "建立中…" : "建立專案"}
                  </Button>
                </div>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={projectToRename !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !renaming) {
            setProjectToRename(null)
            setRenameError("")
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup className="rounded-none">
              <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                <DialogTitle>重新命名專案</DialogTitle>
                <DialogDescription className="mt-1">
                  請輸入新的專案名稱。
                </DialogDescription>

                <div className="mt-4">
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">專案名稱</span>
                    <Input
                      value={renameName}
                      onChange={(event) => setRenameName(event.target.value)}
                      maxLength={100}
                      className="rounded-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void handleRenameProject()
                        }
                      }}
                    />
                  </label>
                </div>

                {renameError && (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    {renameError}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={renaming}
                        className="rounded-none"
                      >
                        取消
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    onClick={() => void handleRenameProject()}
                    disabled={renaming}
                    className="rounded-none"
                  >
                    {renaming ? "儲存中…" : "儲存"}
                  </Button>
                </div>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={projectToDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleting) {
            setProjectToDelete(null)
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup className="rounded-none">
              <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                <DialogTitle>刪除專案</DialogTitle>
                <DialogDescription className="mt-1">
                  確定要刪除「{projectToDelete?.name}」嗎？
                  專案內的所有文獻也會一併被刪除，此動作無法復原。
                </DialogDescription>

                <div className="mt-6 flex justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deleting}
                        className="rounded-none"
                      >
                        取消
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void confirmDeleteProject()}
                    disabled={deleting}
                    className="rounded-none"
                  >
                    {deleting ? "刪除中…" : "確認刪除"}
                  </Button>
                </div>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </AppShell>
  )
}
