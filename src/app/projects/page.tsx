"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, FolderOpen, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { SiteHeader } from "@/components/site-header"

interface ProjectSummary {
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [defaultStyle, setDefaultStyle] = useState("apa")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [requiresLogin, setRequiresLogin] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/projects", {
        headers: { "Cache-Control": "no-cache" },
      })
      const payload = (await response.json()) as {
        projects?: ProjectSummary[]
        error?: string
      }
      if (response.status === 401) {
        setRequiresLogin(true)
      }
      if (!response.ok || !payload.projects) {
        setError(payload.error || "無法載入專案。")
        return
      }
      setProjects(payload.projects)
    } catch {
      setError("無法連線到專案服務，請稍後再試。")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // This effect synchronizes the page with the remote project list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects()
  }, [loadProjects])

  async function createProject() {
    if (!name.trim()) {
      setError("請輸入專案名稱。")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description || null,
          defaultStyle,
        }),
      })
      const payload = (await response.json()) as {
        project?: ProjectSummary
        error?: string
      }
      if (!response.ok || !payload.project) {
        setError(payload.error || "建立專案失敗。")
        return
      }
      setProjects((current) => [payload.project as ProjectSummary, ...current])
      setName("")
      setDescription("")
    } catch {
      setError("無法連線到專案服務，請稍後再試。")
    } finally {
      setSubmitting(false)
    }
  }

  async function renameProject(project: ProjectSummary) {
    const nextName = window.prompt("請輸入新的專案名稱", project.name)?.trim()
    if (!nextName || nextName === project.name) {
      return
    }

    setError("")
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      })
      const payload = (await response.json()) as {
        project?: ProjectSummary
        error?: string
      }
      if (!response.ok || !payload.project) {
        setError(payload.error || "重新命名失敗。")
        return
      }
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? (payload.project as ProjectSummary) : item
        )
      )
    } catch {
      setError("無法連線到專案服務，請稍後再試。")
    }
  }

  async function confirmDeleteProject() {
    const project = projectToDelete
    if (!project) {
      return
    }

    setDeleting(true)
    setError("")
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error || "刪除專案失敗。")
        return
      }
      setProjects((current) => current.filter((item) => item.id !== project.id))
      setProjectToDelete(null)
    } catch {
      setError("無法連線到專案服務，請稍後再試。")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> 回到轉換器
          </Link>
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.05em]">
            我的專案
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理已儲存的論文文獻與引用格式。
          </p>
        </div>
        <FolderOpen className="hidden size-12 text-accent sm:block" />
      </div>

      {requiresLogin ? (
        <Card className="rounded-none">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm">請先登入，才能使用論文專案。</p>
            <Button
              type="button"
              onClick={() => {
                window.location.href = "/api/auth/signin?callbackUrl=/projects"
              }}
              className="rounded-none"
            >
              前往登入
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6 rounded-none border-foreground/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Plus className="size-5" /> 建立專案
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
              <label className="grid content-start gap-1 text-sm">
                <span className="font-semibold">預設引用格式</span>
                <select
                  value={defaultStyle}
                  onChange={(event) => setDefaultStyle(event.target.value)}
                  className="h-10 rounded-none border border-input bg-background px-3"
                >
                  {styles.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                onClick={() => void createProject()}
                disabled={submitting}
                className="w-fit rounded-none sm:col-span-2"
              >
                {submitting ? "建立中…" : "建立專案"}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <p className="mb-5 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">正在載入專案…</p>
          ) : projects.length === 0 ? (
            <Card className="rounded-none border-dashed">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                目前還沒有專案。建立第一個專案後，就能把轉換結果保存下來。
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <Card key={project.id} className="rounded-none">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-3 text-xl">
                      <Link
                        href={`/projects/${project.id}`}
                        className="min-w-0 break-words hover:text-accent"
                      >
                        {project.name}
                      </Link>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {project._count?.references ?? 0} 筆
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="min-h-10 text-sm text-muted-foreground">
                      {project.description || "沒有專案描述"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      預設格式：{project.defaultStyle.toUpperCase()}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void renameProject(project)}
                        className="rounded-none"
                      >
                        重新命名
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProjectToDelete(project)}
                        className="rounded-none text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" /> 刪除專案
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      </main>

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
            <DialogPopup>
              <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                <DialogTitle>刪除專案</DialogTitle>
                <DialogDescription className="mt-1">
                  確定要刪除「{projectToDelete?.name}」及其中的{" "}
                  {projectToDelete?._count?.references ?? 0}{" "}
                  筆文獻嗎？此動作無法復原。
                </DialogDescription>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deleting}
                        className="rounded-none border-foreground/30 bg-background"
                      />
                    }
                  >
                    取消
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void confirmDeleteProject()}
                    disabled={deleting}
                    className="rounded-none"
                  >
                    {deleting ? "刪除中…" : "刪除專案"}
                  </Button>
                </div>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  )
}
