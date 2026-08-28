"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CodeBlock } from "@/lib/codelooter-api";
import { CodeBlockCard } from "./code-block-card";

interface SortableBlockListProps {
  blocks: CodeBlock[];
  onReorder: (blocks: CodeBlock[]) => void;
  onDownload: (index: number) => void;
  onChange: (index: number, code: string) => void;
  onMergeWithNext?: (index: number) => void;
  onSplit?: (index: number, atLine: number) => void;
}

// A single sortable wrapper that adds a drag handle to each CodeBlockCard.
function SortableItem({
  block,
  onDownload,
  onChange,
  onMergeWithNext,
  onSplit,
  isLast,
}: {
  block: CodeBlock;
  onDownload: (index: number) => void;
  onChange: (index: number, code: string) => void;
  onMergeWithNext?: (index: number) => void;
  onSplit?: (index: number, atLine: number) => void;
  isLast?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `block-${block.index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center self-stretch rounded-l-lg border border-r-0 border-border bg-muted/40 px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        title="Seret untuk mengurutkan"
        aria-label="Seret untuk mengurutkan"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* Block card (flex-1 so it fills the remaining width) */}
      <div className="min-w-0 flex-1">
        <CodeBlockCard
          block={block}
          onDownload={onDownload}
          onChange={onChange}
          onMergeWithNext={onMergeWithNext}
          onSplit={onSplit}
          isLast={isLast}
        />
      </div>
    </div>
  );
}

export function SortableBlockList({
  blocks,
  onReorder,
  onDownload,
  onChange,
  onMergeWithNext,
  onSplit,
}: SortableBlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => `block-${b.index}` === active.id);
    const newIndex = blocks.findIndex((b) => `block-${b.index}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 px-3 py-2 text-xs text-teal-700 dark:text-teal-300">
        <span className="font-medium">Mode urut:</span> Seret pegangan{" "}
        <GripVertical className="inline h-3 w-3" /> di kiri setiap blok untuk
        mengatur ulang urutan. Klik{" "}
        <span className="font-mono">Selesai</span> saat selesai.
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => `block-${b.index}`)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.map((b, i) => (
            <SortableItem
              key={`block-${b.index}`}
              block={b}
              onDownload={onDownload}
              onChange={onChange}
              onMergeWithNext={onMergeWithNext}
              onSplit={onSplit}
              isLast={i === blocks.length - 1}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
