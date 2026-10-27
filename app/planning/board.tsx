"use client";

import Link from "next/link";
import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Assignee } from "@/lib/planning/db";
import { TASK_STAGES, type TaskStatus } from "@/lib/planning/stages";
import type { Person } from "@/lib/planning/session";
import { createTask, moveTask } from "./actions";
import { SubmitButton } from "./client";
import { DueTag, PersonTag } from "./ui";

export type BoardCard = {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: Assignee | null;
  due_date: string | null;
  context: string | null;
};

type Move = { id: string; status: TaskStatus; claimFor?: Person };

// Pointer position decides the column; keyboard drags fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function KanbanBoard({
  cards,
  me,
  doneHidden,
}: {
  cards: BoardCard[];
  me: Person;
  doneHidden: number;
}) {
  const [board, applyMove] = useOptimistic(cards, (state, move: Move) =>
    state.map((c) =>
      c.id === move.id
        ? { ...c, status: move.status, assignee: move.claimFor ?? c.assignee }
        : c,
    ),
  );
  const [, startTransition] = useTransition();
  const [active, setActive] = useState<BoardCard | null>(null);
  const justDragged = useRef(false);
  // A stable id keeps dnd-kit's aria-describedby the same on server and client.
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart({ active }: DragStartEvent) {
    justDragged.current = true;
    setActive(board.find((c) => c.id === active.id) ?? null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActive(null);
    setTimeout(() => (justDragged.current = false), 0);
    const card = board.find((c) => c.id === active.id);
    const status = over?.id as TaskStatus | undefined;
    if (!card || !status || status === card.status) return;
    const claim = status === "todo" && !card.assignee;
    startTransition(async () => {
      applyMove({ id: card.id, status, claimFor: claim ? me : undefined });
      await moveTask(card.id, status, claim);
    });
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "To move a task, press space or enter, use the arrow keys to move it to another column, then press space or enter again to drop it. Press escape to cancel.",
        },
      }}
    >
      <div className="pl-kanban">
        {TASK_STAGES.map((stage) => {
          const list = board
            .filter((c) => c.status === stage.id)
            .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
          return (
            <Column key={stage.id} id={stage.id} label={stage.label} hint={stage.hint} count={list.length}>
              {stage.id === "backlog" ? <QuickAdd /> : null}
              {list.map((c) => (
                <Card key={c.id} card={c} justDragged={justDragged} />
              ))}
              {stage.id === "done" && doneHidden ? (
                <Link href="/tasks?show=done" className="pl-link pl-kanban-more">
                  + {doneHidden} more finished
                </Link>
              ) : null}
              {!list.length && stage.id !== "backlog" ? (
                <p className="pl-kanban-empty">Drop tasks here</p>
              ) : null}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }}>
        {active ? <CardBody card={active} lifted /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  label,
  hint,
  count,
  children,
}: {
  id: TaskStatus;
  label: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={`pl-kanban-col pl-kanban-${id} ${isOver ? "is-over" : ""}`}>
      <header className="pl-kanban-head">
        <h2>{label}</h2>
        <span className="pl-small">{count}</span>
      </header>
      <p className="pl-kanban-hint">{hint}</p>
      <div className="pl-kanban-cards">{children}</div>
    </section>
  );
}

function Card({
  card,
  justDragged,
}: {
  card: BoardCard;
  justDragged: React.RefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-roledescription="Draggable task"
      className={`pl-kanban-slot ${isDragging ? "is-dragging" : ""}`}
    >
      <Link
        href={`/tasks/${card.id}`}
        draggable={false}
        tabIndex={-1}
        onClick={(e) => {
          if (justDragged.current) e.preventDefault();
        }}
      >
        <CardBody card={card} />
      </Link>
    </div>
  );
}

function CardBody({ card, lifted }: { card: BoardCard; lifted?: boolean }) {
  const done = card.status === "done";
  return (
    <div className={`pl-kcard ${done ? "is-done" : ""} ${lifted ? "is-lifted" : ""}`}>
      <strong>{card.title}</strong>
      {card.context ? <span className="pl-row-sub">{card.context}</span> : null}
      <span className="pl-row-meta">
        <PersonTag who={card.assignee} />
        <DueTag date={card.due_date} done={done} />
      </span>
    </div>
  );
}

function QuickAdd() {
  return (
    <form action={createTask} className="pl-kanban-add">
      <input className="pl-input" name="title" placeholder="+ Add to backlog" aria-label="New backlog task" required />
      <SubmitButton className="pl-btn pl-btn-quiet" pendingLabel="…">
        Add
      </SubmitButton>
    </form>
  );
}
