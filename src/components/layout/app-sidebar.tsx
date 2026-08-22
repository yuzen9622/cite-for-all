"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { ExternalLink, Folder, LogOut, Plus, Zap } from "lucide-react"
import { toast } from "sonner"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export interface SidebarProject {
  id: string
  name: string
  description?: string | null
  defaultStyle?: string
  updatedAt?: string
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

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  projects?: SidebarProject[]
  onProjectCreated?: (project: SidebarProject) => void
}

export function AppSidebar({
  projects: propProjects,
  onProjectCreated,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user

  const [fetchedProjects, setFetchedProjects] = React.useState<
    SidebarProject[]
  >([])
  const [isFetching, setIsFetching] = React.useState(propProjects === undefined)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [defaultStyle, setDefaultStyle] = React.useState("apa")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState("")

  const projects = propProjects ?? fetchedProjects
  const loading = propProjects === undefined && isFetching

  React.useEffect(() => {
    if (propProjects !== undefined) {
      return
    }

    let isMounted = true
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects", {
          headers: { "Cache-Control": "no-cache" },
        })
        if (res.ok) {
          const data = (await res.json()) as { projects?: SidebarProject[] }
          if (isMounted && data.projects) {
            setFetchedProjects(data.projects)
          }
        }
      } catch {
        // ignore background sidebar fetch errors
      } finally {
        if (isMounted) setIsFetching(false)
      }
    }

    void fetchProjects()
    return () => {
      isMounted = false
    }
  }, [propProjects])

  function openCreateDialog() {
    setError("")
    setName("")
    setDescription("")
    setDefaultStyle("apa")
    setCreateDialogOpen(true)
  }

  async function handleCreateProject() {
    if (!name.trim()) {
      setError("請輸入專案名稱。")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const projectName = name.trim()
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: description || null,
          defaultStyle,
        }),
      })
      const payload = (await res.json()) as {
        project?: SidebarProject
        error?: string
      }

      if (!res.ok || !payload.project) {
        toast.error(payload.error || "建立專案失敗。")
        return
      }

      const created = payload.project
      if (onProjectCreated) {
        onProjectCreated(created)
      } else {
        setFetchedProjects((prev) => [created, ...prev])
      }

      setCreateDialogOpen(false)
      setName("")
      setDescription("")
      setDefaultStyle("apa")
      toast.success(`已建立專案「${projectName}」。`)
      router.push(`/projects/${created.id}`)
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
    } finally {
      setSubmitting(false)
    }
  }

  const isProjectsActive = pathname === "/" || pathname === "/projects"
  const isConvertActive = pathname === "/convert"

  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex shrink-0 items-baseline gap-2 font-heading text-xl font-bold tracking-[-0.04em] text-sidebar-foreground hover:text-accent transition-colors"
              aria-label="回到 Cite for All 首頁"
            >
              <span>CITE</span>
              <span className="font-mono text-accent">/</span>
              <span>ALL</span>
            </Link>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>導覽</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/" />}
                    isActive={isProjectsActive}
                    tooltip="我的專案"
                  >
                    <Folder className="size-4" />
                    <span>我的專案</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/convert" />}
                    isActive={isConvertActive}
                    tooltip="快速轉換"
                  >
                    <Zap className="size-4" />
                    <span>快速轉換</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel>專案列表</SidebarGroupLabel>
              <SidebarGroupAction
                render={
                  <button
                    type="button"
                    onClick={openCreateDialog}
                    title="建立新專案"
                    aria-label="建立新專案"
                  />
                }
              >
                <Plus className="size-4" />
              </SidebarGroupAction>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {loading ? (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  </>
                ) : projects.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    尚無專案
                  </div>
                ) : (
                  projects.map((project) => {
                    const isActive = pathname === `/projects/${project.id}`
                    return (
                      <SidebarMenuItem key={project.id}>
                        <SidebarMenuButton
                          render={<Link href={`/projects/${project.id}`} />}
                          isActive={isActive}
                          tooltip={project.name}
                        >
                          <span className="truncate">{project.name}</span>
                          <SidebarMenuBadge>
                            {project._count?.references ?? 0}
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex flex-col gap-2">
            <a
              href="https://citationstyles.org/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="size-2 shrink-0 rounded-full bg-[#5d9a56] shadow-[0_0_0_4px_rgb(93_154_86/0.12)]" />
                <span className="truncate">CSL (citeproc-js)</span>
              </div>
              <ExternalLink className="size-3 shrink-0" />
            </a>

            <SidebarSeparator className="mx-0" />

            {user && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex min-w-0 items-center gap-2">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name ?? user.email ?? "使用者頭像"}
                      className="size-7 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-secondary text-xs font-bold text-foreground">
                      {(user.name ?? user.email ?? "使")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {user.name || "使用者"}
                    </p>
                    {user.email && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                  className="size-7 p-0 rounded-none text-muted-foreground hover:text-destructive"
                  title="登出"
                  aria-label="登出"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>

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
                    onClick={() => void handleCreateProject()}
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
    </>
  )
}
