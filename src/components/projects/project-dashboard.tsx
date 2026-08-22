"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  defaultStyle: string;
  updatedAt: string;
  _count?: { references: number };
}

const styles = [
  ["apa", "APA 7th"],
  ["mla", "MLA 9"],
  ["chicago", "Chicago"],
  ["harvard", "Harvard"],
  ["ieee", "IEEE"],
  ["vancouver", "Vancouver"],
  ["bibtex", "BibTeX"],
] as const;

interface ProjectDashboardProps {
  initialProjects: ProjectSummary[];
  loadError?: string;
}

export function ProjectDashboard({
  initialProjects,
  loadError: initialLoadError,
}: ProjectDashboardProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("apa");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(initialLoadError ?? "");
  const [reloading, setReloading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  async function loadProjects() {
    setReloading(true);
    try {
      const response = await fetch("/api/projects", {
        headers: { "Cache-Control": "no-cache" },
      });
      const payload = (await response.json()) as {
        projects?: ProjectSummary[];
        error?: string;
      };
      if (response.status === 401) {
        router.refresh();
        return;
      }
      if (!response.ok || !payload.projects) {
        setLoadError(payload.error || "無法載入專案。");
        return;
      }
      setProjects(payload.projects);
      setLoadError("");
    } catch {
      setLoadError("無法連線到專案服務，請稍後再試。");
    } finally {
      setReloading(false);
    }
  }

  function openCreateDialog() {
    setError("");
    setName("");
    setDescription("");
    setDefaultStyle("apa");
    setCreateDialogOpen(true);
  }

  async function createProject() {
    if (!name.trim()) {
      setError("請輸入專案名稱。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const projectName = name.trim();
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: description || null,
          defaultStyle,
        }),
      });
      const payload = (await response.json()) as {
        project?: ProjectSummary;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        toast.error(payload.error || "建立專案失敗。");
        return;
      }
      setProjects((current) => [payload.project as ProjectSummary, ...current]);
      setCreateDialogOpen(false);
      setName("");
      setDescription("");
      setDefaultStyle("apa");
      toast.success(`已建立專案「${projectName}」。`);
      router.push(`/projects/${payload.project.id}`);
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  async function renameProject(project: ProjectSummary) {
    const nextName = window.prompt("請輸入新的專案名稱", project.name)?.trim();
    if (!nextName || nextName === project.name) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const payload = (await response.json()) as {
        project?: ProjectSummary;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        toast.error(payload.error || "重新命名失敗。");
        return;
      }
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? (payload.project as ProjectSummary) : item,
        ),
      );
      toast.success(`已更名為「${nextName}」。`);
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。");
    }
  }

  async function confirmDeleteProject() {
    const project = projectToDelete;
    if (!project) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        // The dialog stays open so the user can retry; the toast still shows
        // because sonner stacks above the dialog backdrop.
        toast.error(payload.error || "刪除專案失敗。");
        return;
      }
      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );
      setProjectToDelete(null);
      toast.success(`已刪除專案「${project.name}」。`);
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <SiteHeader />
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
              className="text-sm font-semibold text-muted-foreground hover:text-accent"
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
      </main>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !submitting) {
            setCreateDialogOpen(false);
            setError("");
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
                </div>

                {error && (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        className="rounded-none border-foreground/30 bg-background"
                      />
                    }
                  >
                    取消
                  </DialogClose>
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

      <Dialog
        open={projectToDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleting) {
            setProjectToDelete(null);
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
  );
}
