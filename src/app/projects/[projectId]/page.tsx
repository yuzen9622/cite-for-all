"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { InlineConverter } from "@/components/projects/inline-converter"
import { ReferenceBatchBar } from "@/components/projects/reference-batch-bar"
import {
  ReferenceEditor,
  type EditableReference,
} from "@/components/projects/reference-editor"
import { SiteHeader } from "@/components/site-header"
import { AppShell } from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"
import { STYLE_OPTIONS, type CitationStyle } from "@/lib/citations"
import {
  citationExportText,
  formatCitationExport,
  formatRisExport,
  type CitationExportRecord,
} from "@/lib/export-citations"

export interface StoredReference extends EditableReference {
  projectId: string
  sortOrder: number
  input: string
  inputType: string
  provider: string | null
  itemType: string | null
  citations: Record<string, string>
  bibtex: string
  isEdited: boolean
}

export interface ProjectData {
  id: string
  name: string
  description: string | null
  defaultStyle: string
  references: StoredReference[]
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportRecord(reference: StoredReference): CitationExportRecord {
  return {
    metadata: {
      title: reference.title,
      authors: reference.authors,
      year: reference.year ?? undefined,
      journal: reference.journal ?? undefined,
      volume: reference.volume ?? undefined,
      issue: reference.issue ?? undefined,
      pages: reference.pages ?? undefined,
      doi: reference.doi ?? undefined,
      publisher: reference.publisher ?? undefined,
      url: reference.url ?? undefined,
      type: reference.itemType ?? undefined,
    },
    citations: reference.citations as CitationExportRecord["citations"],
    bibtex: reference.bibtex,
  }
}

interface SortableReferenceProps {
  reference: StoredReference
  index: number
  startNumber: number
  style: CitationStyle
  projectId: string
  isEditing: boolean
  dragDisabled: boolean
  actionsDisabled: boolean
  selected: boolean
  selectionDisabled: boolean
  dragGroupIds: Set<string>
  activeDragId: string | null
  dragOffset: { x: number; y: number }
  onToggleSelected: () => void
  onEdit: () => void
  onDelete: () => void
  onSaved: (reference: EditableReference) => void
  onCancel: () => void
}

function SortableReference({
  reference,
  index,
  startNumber,
  style,
  projectId,
  isEditing,
  dragDisabled,
  actionsDisabled,
  selected,
  selectionDisabled,
  dragGroupIds,
  activeDragId,
  dragOffset,
  onToggleSelected,
  onEdit,
  onDelete,
  onSaved,
  onCancel,
}: SortableReferenceProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: reference.id, disabled: dragDisabled })
  const isGrouped = dragGroupIds.has(reference.id)
  const isFollower = isGrouped && activeDragId !== reference.id
  const displayTransform = isFollower
    ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
    : CSS.Transform.toString(transform)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: displayTransform, transition }}
      className={cn(
        isDragging && "relative z-10 opacity-70",
        isFollower && "relative z-10 opacity-70",
      )}
    >
      <Card
        className={cn(
          "rounded-none transition-shadow",
          isDragging && "shadow-lg ring-2 ring-accent",
          selected && "ring-2 ring-accent bg-secondary/20",
        )}
      >
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              disabled={selectionDisabled}
              aria-label={`選取：${reference.title}`}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#b84025] disabled:cursor-not-allowed disabled:opacity-40"
            />
            <button
              type="button"
              className="mt-0.5 inline-flex size-8 shrink-0 touch-none cursor-grab items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
              disabled={dragDisabled}
              aria-label={`拖曳排序：${reference.title}`}
              title="拖曳排序；使用鍵盤時按空白鍵拿起，再用方向鍵移動"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[11px] font-bold text-[#b84025]">
                項目 {String(index + startNumber).padStart(2, "0")} ·{" "}
                {reference.inputType === "doi" ? "DOI" : "標題"}
              </p>
              <CardTitle className="break-words text-lg">
                {reference.title}
              </CardTitle>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {[reference.year, reference.journal, reference.doi]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-11 sm:pl-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              disabled={actionsDisabled}
              className="rounded-none"
            >
              <Pencil /> 編輯
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={actionsDisabled}
              className="rounded-none text-destructive hover:text-destructive"
            >
              <Trash2 /> 刪除
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <ReferenceEditor
              projectId={projectId}
              reference={reference}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap border bg-secondary/30 p-4 font-heading text-sm leading-7">
              {citationExportText(
                exportRecord(reference),
                style,
                index,
                startNumber,
              )}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const [project, setProject] = useState<ProjectData | null>(null)
  const [style, setStyle] = useState<CitationStyle>("apa")
  const [startNumber, setStartNumber] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [requiresLogin, setRequiresLogin] = useState(false)
  const [reorderPending, setReorderPending] = useState(false)
  const [reorderStatus, setReorderStatus] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[]
    count: number
  } | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dragGroup, setDragGroup] = useState<Set<string>>(new Set())
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Edit Project Settings state
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editDefaultStyle, setEditDefaultStyle] = useState("apa")
  const [savingProject, setSavingProject] = useState(false)
  const [editProjectError, setEditProjectError] = useState("")

  function openEditProjectDialog() {
    if (!project) return
    setEditName(project.name)
    setEditDescription(project.description || "")
    setEditDefaultStyle(project.defaultStyle)
    setEditProjectError("")
    setEditProjectOpen(true)
  }

  async function handleSaveProjectDetails() {
    if (!project) return
    const trimmedName = editName.trim()
    if (!trimmedName) {
      setEditProjectError("請輸入專案名稱。")
      return
    }

    setSavingProject(true)
    setEditProjectError("")
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: editDescription || null,
          defaultStyle: editDefaultStyle,
        }),
      })
      const payload = (await response.json()) as {
        project?: ProjectData
        error?: string
      }

      if (!response.ok || !payload.project) {
        setEditProjectError(payload.error || "儲存專案失敗。")
        return
      }

      setProject((prev) =>
        prev
          ? {
              ...prev,
              name: payload.project?.name ?? trimmedName,
              description: payload.project?.description ?? editDescription,
              defaultStyle: payload.project?.defaultStyle ?? editDefaultStyle,
            }
          : null,
      )
      setEditProjectOpen(false)
      toast.success("專案設定已更新。")
    } catch {
      setEditProjectError("無法連線到專案服務，請稍後再試。")
    } finally {
      setSavingProject(false)
    }
  }

  async function handleSetDefaultStyle(newDefaultStyle: CitationStyle) {
    if (!project || project.defaultStyle === newDefaultStyle) return
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultStyle: newDefaultStyle }),
      })
      const payload = (await response.json()) as {
        project?: ProjectData
        error?: string
      }
      if (!response.ok || !payload.project) {
        toast.error(payload.error || "更新預設格式失敗。")
        return
      }
      setProject((prev) =>
        prev ? { ...prev, defaultStyle: newDefaultStyle } : null,
      )
      const styleLabel =
        STYLE_OPTIONS.find((opt) => opt.id === newDefaultStyle)?.label ??
        newDefaultStyle.toUpperCase()
      toast.success(`已將「${styleLabel}」設為專案預設格式。`)
    } catch {
      toast.error("無法連線到專案服務，請稍後再試。")
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const loadProject = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: { "Cache-Control": "no-cache" },
      })
      const payload = (await response.json()) as {
        project?: ProjectData
        error?: string
      }
      if (response.status === 401) {
        setRequiresLogin(true)
      }
      if (!response.ok || !payload.project) {
        setError(payload.error || "無法載入專案。")
        return
      }
      setProject(payload.project)
      setStyle(
        STYLE_OPTIONS.some(
          (option) => option.id === payload.project?.defaultStyle,
        )
          ? (payload.project.defaultStyle as CitationStyle)
          : "apa",
      )
    } catch {
      setError("無法連線到專案服務，請稍後再試。")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    // This effect synchronizes the page with the remote project record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProject()
  }, [loadProject])

  const selectedCount = selectedIds.size
  const allSelected =
    project !== null &&
    project.references.length > 0 &&
    selectedCount === project.references.length
  const selectedReferences = useMemo(
    () =>
      project?.references.filter((reference) =>
        selectedIds.has(reference.id),
      ) ?? [],
    [project, selectedIds],
  )
  const selectionDisabled = reorderPending || editingId !== null || bulkDeleting

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (!project) {
      return
    }

    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(project.references.map((reference) => reference.id)),
    )
  }

  const records = useMemo(
    () => project?.references.map(exportRecord) ?? [],
    [project?.references],
  )
  const allText = useMemo(
    () => formatCitationExport(records, style, startNumber),
    [records, startNumber, style],
  )

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(allText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      toast.success(`已複製 ${records.length} 筆引用。`)
    } catch {
      toast.error("瀏覽器未允許剪貼簿權限，請手動選取文字複製。")
    }
  }

  function downloadAll() {
    const filename = `${project?.name ?? "project"}-${style}.${style === "bibtex" ? "bib" : "txt"}`
    try {
      downloadTextFile(allText, filename, "text/plain;charset=utf-8")
      toast.success(`已下載 ${filename}。`)
    } catch {
      toast.error("下載失敗，請稍後再試。")
    }
  }

  function downloadRis() {
    const filename = `${project?.name ?? "project"}.ris`
    try {
      downloadTextFile(
        formatRisExport(records),
        filename,
        "application/x-research-info-systems;charset=utf-8",
      )
      toast.success(`已下載 ${filename}。`)
    } catch {
      toast.error("下載失敗，請稍後再試。")
    }
  }

  async function deleteReference(reference: StoredReference) {
    if (!window.confirm(`確定要刪除「${reference.title}」嗎？`)) {
      return
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/references/${reference.id}`,
        { method: "DELETE" },
      )
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(payload.error || "刪除文獻失敗。")
        return
      }
      setProject((current) =>
        current
          ? {
              ...current,
              references: current.references.filter(
                (item) => item.id !== reference.id,
              ),
            }
          : current,
      )
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(reference.id)
        return next
      })
      toast.success(`已刪除「${reference.title}」。`)
    } catch {
      toast.error("無法連線到文獻服務，請稍後再試。")
    }
  }

  function updateReference(reference: EditableReference) {
    setProject((current) =>
      current
        ? {
            ...current,
            references: current.references.map((item) =>
              item.id === reference.id ? { ...item, ...reference } : item,
            ),
          }
        : current,
    )
    setEditingId(null)
  }

  function handleConverterSaved(created: StoredReference[]) {
    setProject((current) =>
      current
        ? { ...current, references: [...current.references, ...created] }
        : current,
    )
  }

  function moveSelected(direction: "top" | "bottom") {
    if (
      !project ||
      selectedIds.size === 0 ||
      selectedIds.size === project.references.length
    ) {
      return
    }

    const selectedRows = project.references.filter((reference) =>
      selectedIds.has(reference.id),
    )
    const rest = project.references.filter(
      (reference) => !selectedIds.has(reference.id),
    )
    const nextReferences =
      direction === "top"
        ? [...selectedRows, ...rest]
        : [...rest, ...selectedRows]

    void saveOrder(nextReferences.map((reference) => reference.id))
  }

  async function copySelected() {
    try {
      await navigator.clipboard.writeText(
        formatCitationExport(
          selectedReferences.map(exportRecord),
          style,
          startNumber,
        ),
      )
      toast.success(`已複製 ${selectedReferences.length} 筆引用。`)
    } catch {
      toast.error("瀏覽器未允許剪貼簿權限，請手動選取文字複製。")
    }
  }

  function downloadSelected() {
    const filename = `${project?.name ?? "project"}-selected-${style}.${style === "bibtex" ? "bib" : "txt"}`
    try {
      downloadTextFile(
        formatCitationExport(
          selectedReferences.map(exportRecord),
          style,
          startNumber,
        ),
        filename,
        "text/plain;charset=utf-8",
      )
      toast.success(`已下載 ${filename}。`)
    } catch {
      toast.error("下載失敗，請稍後再試。")
    }
  }

  function downloadSelectedRis() {
    const filename = `${project?.name ?? "project"}-selected.ris`
    try {
      downloadTextFile(
        formatRisExport(selectedReferences.map(exportRecord)),
        filename,
        "application/x-research-info-systems;charset=utf-8",
      )
      toast.success(`已下載 ${filename}。`)
    } catch {
      toast.error("下載失敗，請稍後再試。")
    }
  }

  async function confirmBulkDelete() {
    const target = deleteTarget
    if (!target) {
      return
    }

    setBulkDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/references`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceIds: target.ids }),
      })
      const payload = (await response.json()) as {
        deleted?: number
        error?: string
      }

      if (!response.ok) {
        toast.error(payload.error || "刪除文獻失敗。")
        return
      }

      setProject((current) =>
        current
          ? {
              ...current,
              references: current.references.filter(
                (reference) => !selectedIds.has(reference.id),
              ),
            }
          : current,
      )
      setSelectedIds(new Set())
      setDeleteTarget(null)
      toast.success(`已刪除 ${payload.deleted ?? target.count} 筆文獻。`)
    } catch {
      toast.error("無法連線到文獻服務，請稍後再試。")
    } finally {
      setBulkDeleting(false)
    }
  }

  async function saveOrder(ids: string[]) {
    if (!project || reorderPending || editingId) {
      return
    }

    const previousReferences = project.references
    const previousIds = new Set(previousReferences.map((r) => r.id))
    const nextReferences = ids.map((id, index) => ({
      ...previousReferences.find((reference) => reference.id === id)!,
      sortOrder: index + 1,
    }))

    // 排序請求期間可能有內嵌轉換器並行新增文獻；套用/回滾時都要保留
    // 不在排序清單中的新項目，避免被舊快照覆蓋造成前後端不同步。
    const applySorted = (current: ProjectData | null) => {
      if (!current) {
        return current
      }
      const additions = current.references.filter(
        (reference) => !previousIds.has(reference.id),
      )
      return additions.length
        ? { ...current, references: [...nextReferences, ...additions] }
        : { ...current, references: nextReferences }
    }
    const rollbackSorted = (current: ProjectData | null) => {
      if (!current) {
        return current
      }
      const additions = current.references.filter(
        (reference) => !previousIds.has(reference.id),
      )
      return additions.length
        ? { ...current, references: [...previousReferences, ...additions] }
        : { ...current, references: previousReferences }
    }

    setProject(applySorted)
    setReorderPending(true)
    setReorderStatus("正在儲存新排序…")

    try {
      const response = await fetch(`/api/projects/${projectId}/references`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceIds: ids }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || "儲存文獻排序失敗。")
      }

      toast.success("已儲存新的文獻排序。")
    } catch (reorderError) {
      setProject(rollbackSorted)
      toast.error(
        reorderError instanceof Error
          ? reorderError.message
          : "無法連線到文獻服務，請稍後再試。",
      )
    } finally {
      // The outcome is announced by the toast; this line only reports progress.
      setReorderStatus("")
      setReorderPending(false)
    }
  }

  function reorderReferences(activeId: string, overId: string) {
    if (!project || activeId === overId || reorderPending || editingId) {
      return
    }

    const oldIndex = project.references.findIndex(
      (item) => item.id === activeId,
    )
    const newIndex = project.references.findIndex((item) => item.id === overId)
    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    const nextIds = arrayMove(project.references, oldIndex, newIndex).map(
      (reference) => reference.id,
    )
    void saveOrder(nextIds)
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id)
    setActiveDragId(activeId)
    if (project && selectedIds.has(activeId) && selectedIds.size > 1) {
      const group = project.references
        .filter((reference) => selectedIds.has(reference.id))
        .map((reference) => reference.id)
      setDragGroup(new Set(group))
    } else {
      setDragGroup(new Set([activeId]))
    }
  }

  function handleDragMove(event: DragMoveEvent) {
    setDragOffset({ x: event.delta.x, y: event.delta.y })
  }

  function resetDragState() {
    setActiveDragId(null)
    setDragGroup(new Set())
    setDragOffset({ x: 0, y: 0 })
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) {
      resetDragState()
      return
    }

    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    if (!project || reorderPending || editingId) {
      resetDragState()
      return
    }

    if (dragGroup.size > 1 && dragGroup.has(activeId)) {
      if (dragGroup.has(overId)) {
        // 目標在群組內部：群組保持相對順序，不移動
        resetDragState()
        return
      }
      const ids = project.references.map((reference) => reference.id)
      const groupIds = ids.filter((id) => dragGroup.has(id))
      const offsetInGroup = groupIds.indexOf(activeId)
      const overIndex = ids.indexOf(overId)
      // 以 active 為錨點：active 應落到 over 的位置，群組其他成員
      // 保持與 active 的相對順序一起平移，並 clamp 到陣列邊界。
      const newGroupStart = Math.max(
        0,
        Math.min(overIndex - offsetInGroup, ids.length - groupIds.length),
      )

      if (newGroupStart !== ids.indexOf(groupIds[0])) {
        const rest = ids.filter((id) => !dragGroup.has(id))
        const nextIds = [
          ...rest.slice(0, newGroupStart),
          ...groupIds,
          ...rest.slice(newGroupStart),
        ]
        void saveOrder(nextIds)
      }
    } else {
      void reorderReferences(activeId, overId)
    }
    resetDragState()
  }

  if (loading) {
    return (
      <AppShell>
        <main className="mx-auto max-w-5xl px-4 py-12 text-sm text-muted-foreground">
          正在載入專案…
        </main>
      </AppShell>
    )
  }

  if (requiresLogin) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-12">
          <Card className="rounded-none">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm">請先登入，才能查看此專案。</p>
              <Button
                type="button"
                onClick={() => {
                  window.location.href = `/api/auth/signin?callbackUrl=/projects/${projectId}`
                }}
                className="rounded-none"
              >
                前往登入
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  if (!project) {
    return (
      <AppShell>
        <main className="mx-auto max-w-5xl px-4 py-12">
          <p className="text-sm text-destructive" role="alert">
            {error || "找不到此專案。"}
          </p>
          <Link href="/" className="mt-4 inline-flex text-sm underline">
            回到專案列表
          </Link>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 sm:py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" /> 我的專案
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-4xl font-semibold tracking-[-0.05em]">
                {project.name}
              </h1>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openEditProjectDialog}
                className="rounded-none gap-1.5"
                title="編輯專案名稱、描述與預設格式"
              >
                <Pencil className="size-3.5" /> 編輯專案
              </Button>
            </div>
            {project.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground text-sm">
              {project.references.length} 筆文獻
            </span>
            <span>
              預設：
              {STYLE_OPTIONS.find((o) => o.id === project.defaultStyle)
                ?.label ?? project.defaultStyle.toUpperCase()}
            </span>
          </div>
        </div>

        {error && (
          <p className="mb-5 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Card className="mb-6 rounded-none border-foreground/30">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl">引用格式與匯出</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={style}
                onChange={(event) =>
                  setStyle(event.target.value as CitationStyle)
                }
                className="h-9 rounded-none border border-input bg-background px-3 text-sm"
                aria-label="選擇引用格式"
              >
                {STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {style !== project.defaultStyle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleSetDefaultStyle(style)}
                  className="rounded-none text-xs text-muted-foreground hover:text-foreground"
                  title="將目前選擇的格式儲存為此專案的預設格式"
                >
                  設為預設格式
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyAll()}
                className="rounded-none"
              >
                {copied ? <Check /> : <Copy />} {copied ? "已複製" : "複製全部"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadAll}
                className="rounded-none"
              >
                <Download /> 下載
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadRis}
                className="rounded-none"
              >
                <Download /> RIS
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(style === "ieee" || style === "vancouver") && (
              <div className="mb-4 flex items-center gap-3 text-sm">
                <label htmlFor="project-start-number">起始編號</label>
                <Input
                  id="project-start-number"
                  type="number"
                  min={1}
                  max={9999}
                  value={startNumber}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10)
                    if (Number.isInteger(value) && value > 0) {
                      setStartNumber(Math.min(value, 9999))
                    }
                  }}
                  className="h-9 w-24 rounded-none"
                />
              </div>
            )}
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap border bg-secondary/30 p-4 font-heading text-sm leading-7">
              {allText || "目前沒有可匯出的文獻。"}
            </pre>
          </CardContent>
        </Card>

        <InlineConverter projectId={projectId} onSaved={handleConverterSaved} />

        {project.references.length > 0 && (
          <ReferenceBatchBar
            totalCount={project.references.length}
            selectedCount={selectedCount}
            allSelected={allSelected}
            disabled={selectionDisabled}
            busy={bulkDeleting}
            onSelectAll={toggleSelectAll}
            onClear={() => setSelectedIds(new Set())}
            onMoveToTop={() => moveSelected("top")}
            onMoveToBottom={() => moveSelected("bottom")}
            onDelete={() =>
              setDeleteTarget({
                ids: Array.from(selectedIds),
                count: selectedCount,
              })
            }
            onCopy={() => void copySelected()}
            onDownload={downloadSelected}
            onDownloadRis={downloadSelectedRis}
          />
        )}

        {project.references.length > 1 && (
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>拖曳每筆文獻左側的把手即可調整引用與匯出順序。</p>
            <p className="shrink-0" aria-live="polite">
              {reorderStatus}
            </p>
          </div>
        )}

        {project.references.length === 0 ? (
          <Card className="rounded-none border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              此專案目前沒有文獻。請在上方「批次加入文獻」輸入 DOI 或標題。
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={project.references.map((reference) => reference.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {project.references.map((reference, index) => (
                  <SortableReference
                    key={reference.id}
                    reference={reference}
                    index={index}
                    startNumber={startNumber}
                    style={style}
                    projectId={projectId}
                    isEditing={editingId === reference.id}
                    dragDisabled={
                      reorderPending || editingId !== null || bulkDeleting
                    }
                    actionsDisabled={reorderPending}
                    selected={selectedIds.has(reference.id)}
                    selectionDisabled={selectionDisabled}
                    dragGroupIds={dragGroup}
                    activeDragId={activeDragId}
                    dragOffset={dragOffset}
                    onToggleSelected={() => toggleSelected(reference.id)}
                    onEdit={() => setEditingId(reference.id)}
                    onDelete={() => void deleteReference(reference)}
                    onSaved={updateReference}
                    onCancel={() => setEditingId(null)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !bulkDeleting) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup>
              <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                <DialogTitle>刪除選取的文獻</DialogTitle>
                <DialogDescription className="mt-1">
                  確定要刪除選取的 {deleteTarget?.count ?? 0}{" "}
                  筆文獻嗎？此動作無法復原。
                </DialogDescription>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={bulkDeleting}
                        className="rounded-none border-foreground/30 bg-background"
                      />
                    }
                  >
                    取消
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void confirmBulkDelete()}
                    disabled={bulkDeleting}
                    className="rounded-none"
                  >
                    {bulkDeleting ? "刪除中…" : "刪除選取"}
                  </Button>
                </div>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={editProjectOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !savingProject) {
            setEditProjectOpen(false)
            setEditProjectError("")
          }
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup className="rounded-none">
              <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
                <DialogTitle>編輯專案設定</DialogTitle>
                <DialogDescription className="mt-1">
                  修改專案名稱、描述與預設引用格式。
                </DialogDescription>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span className="font-semibold">專案名稱</span>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      className="rounded-none"
                      autoFocus
                    />
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span className="font-semibold">描述（選填）</span>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      maxLength={500}
                      placeholder="這個專案的用途…"
                      className="min-h-24 rounded-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span className="font-semibold">預設引用格式</span>
                    <select
                      value={editDefaultStyle}
                      onChange={(e) => setEditDefaultStyle(e.target.value)}
                      className="h-10 rounded-none border border-input bg-card px-3 text-sm"
                    >
                      {STYLE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {editProjectError && (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {editProjectError}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={savingProject}
                        className="rounded-none"
                      >
                        取消
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    onClick={() => void handleSaveProjectDetails()}
                    disabled={savingProject}
                    className="rounded-none"
                  >
                    {savingProject ? "儲存中…" : "儲存設定"}
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
