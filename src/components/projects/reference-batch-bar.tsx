import { Button } from "@/components/ui/button"

interface ReferenceBatchBarProps {
  totalCount: number
  selectedCount: number
  allSelected: boolean
  disabled: boolean
  busy: boolean
  onSelectAll: () => void
  onClear: () => void
  onMoveToTop: () => void
  onMoveToBottom: () => void
  onDelete: () => void
  onCopy: () => void
  onDownload: () => void
  onDownloadRis: () => void
}

export function ReferenceBatchBar({
  totalCount,
  selectedCount,
  allSelected,
  disabled,
  busy,
  onSelectAll,
  onClear,
  onMoveToTop,
  onMoveToBottom,
  onDelete,
  onCopy,
  onDownload,
  onDownloadRis,
}: ReferenceBatchBarProps) {
  const selectionActionDisabled = disabled || busy || selectedCount === 0

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border border-foreground/30 bg-secondary/30 px-3 py-2">
      <span className="mr-1 text-sm font-medium">
        已選取 {selectedCount} / {totalCount} 筆
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSelectAll}
          disabled={disabled || allSelected}
          className="rounded-none"
        >
          全選
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onClear}
          disabled={disabled || selectedCount === 0}
          className="rounded-none"
        >
          清除
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onMoveToTop}
          disabled={
            selectionActionDisabled || selectedCount === totalCount
          }
          className="rounded-none"
        >
          移至頂部
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onMoveToBottom}
          disabled={
            selectionActionDisabled || selectedCount === totalCount
          }
          className="rounded-none"
        >
          移至底部
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onCopy}
          disabled={selectionActionDisabled}
          className="rounded-none"
        >
          複製選取
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onDownload}
          disabled={selectionActionDisabled}
          className="rounded-none"
        >
          下載選取
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onDownloadRis}
          disabled={selectionActionDisabled}
          className="rounded-none"
        >
          下載 RIS
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={selectionActionDisabled}
          className="rounded-none text-destructive hover:text-destructive"
        >
          刪除選取
        </Button>
      </div>
    </div>
  )
}
