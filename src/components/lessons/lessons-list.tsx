"use client";

import { useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  createLessonAction,
  createLessonFolderAction,
  deleteLessonAction,
  deleteLessonFolderAction,
  moveLessonInLibraryAction,
  renameLessonFolderAction,
  reorderLessonFoldersAction,
  saveLessonAction,
  sortLessonFilesAlphabeticallyAction,
  sortLessonFoldersAlphabeticallyAction,
  type LessonCard,
  type LessonFolderCard,
} from "@/lib/actions/lessons";
import {
  IconCheck,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconGrip,
  IconHome,
  IconLayers,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

type Dragged = { type: "lesson"; id: string } | { type: "folder"; id: string } | null;

export function LessonsList({ items, folders }: { items: LessonCard[]; folders: LessonFolderCard[] }) {
  const { t } = useT();
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [folderName, setFolderName] = useState("");
  const [kind, setKind] = useState<"ACTIVITY" | "REGULAR" | "SHORTS">("ACTIVITY");
  const [dragged, setDragged] = useState<Dragged>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;
  const visibleItems = items.filter((item) => item.folderId === currentFolderId);
  const regular = visibleItems.filter((item) => item.kind === "REGULAR");
  const activities = visibleItems.filter((item) => item.kind === "ACTIVITY");
  const shorts = visibleItems.filter((item) => item.kind === "SHORTS");

  function run(task: () => Promise<{ error?: string }>) {
    setError(null);
    startBusy(async () => {
      const result = await task();
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function createLesson() {
    if (!title.trim()) return;
    setError(null);
    startBusy(async () => {
      const result = await createLessonAction(title, kind, currentFolderId);
      if (result.error) return setError(result.error);
      setTitle("");
      if (result.id) router.push(`/teacher/lessons/${result.id}`);
    });
  }

  function createFolder() {
    if (!folderName.trim()) return;
    setError(null);
    startBusy(async () => {
      const result = await createLessonFolderAction(folderName);
      if (result.error) return setError(result.error);
      setFolderName("");
      router.refresh();
    });
  }

  function allowDrop(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function dropIntoFolder(event: DragEvent, folderId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    if (dragged?.type === "lesson") {
      run(() => moveLessonInLibraryAction({ lessonId: dragged.id, folderId }));
    } else if (dragged?.type === "folder" && folderId === null) {
      run(() => reorderLessonFoldersAction(dragged.id));
    }
    setDragged(null);
  }

  function dropBeforeFolder(event: DragEvent, beforeFolderId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (dragged?.type === "lesson") {
      run(() => moveLessonInLibraryAction({ lessonId: dragged.id, folderId: beforeFolderId }));
    } else if (dragged?.type === "folder" && dragged.id !== beforeFolderId) {
      run(() => reorderLessonFoldersAction(dragged.id, beforeFolderId));
    }
    setDragged(null);
  }

  function dropBeforeLesson(event: DragEvent, before: LessonCard) {
    event.preventDefault();
    event.stopPropagation();
    if (dragged?.type !== "lesson" || dragged.id === before.id) return;
    const moved = items.find((item) => item.id === dragged.id);
    run(() => moveLessonInLibraryAction({
      lessonId: dragged.id,
      folderId: currentFolderId,
      beforeLessonId: moved?.kind === before.kind ? before.id : null,
    }));
    setDragged(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-content">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              onDragOver={allowDrop}
              onDrop={(event) => dropIntoFolder(event, null)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-xl px-3 transition hover:bg-surface-2 hover:text-accent",
                !currentFolderId && "bg-surface-2 text-accent",
              )}
            >
              <IconHome className="h-4 w-4" /> {t.lessonUnits.allLessons}
            </button>
            {currentFolder && <><IconChevronRight className="h-4 w-4 text-faint" /><span className="truncate">{currentFolder.name}</span></>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!currentFolder && folders.length > 1 && (
              <button type="button" disabled={busy} onClick={() => run(sortLessonFoldersAlphabeticallyAction)} className="h-9 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent disabled:opacity-50">
                {t.lessonUnits.sortFoldersAz}
              </button>
            )}
            {visibleItems.length > 1 && (
              <button type="button" disabled={busy} onClick={() => run(() => sortLessonFilesAlphabeticallyAction(currentFolderId))} className="h-9 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent disabled:opacity-50">
                {t.lessonUnits.sortLessonsAz}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createLesson()} placeholder={t.lessonUnits.namePlaceholder} className={inputCls} />
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
            {([[
              "ACTIVITY", t.lessonUnits.kindActivity,
            ], ["REGULAR", t.lessonUnits.kindRegular], ["SHORTS", t.lessonUnits.kindShorts]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setKind(value)} className={cn("h-9 rounded-lg px-3 text-[13px] font-semibold transition", kind === value ? "bg-accent text-white" : "text-muted hover:text-content")}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={createLesson} disabled={busy || !title.trim()} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50">
            <IconPlus className="h-4 w-4" /> {t.lessonUnits.create}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-faint">{currentFolder ? `${t.lessonUnits.newLesson}: ${currentFolder.name}` : t.lessonUnits.dragLessonHint}</p>

        {!currentFolder && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-muted"><IconFolder className="h-4 w-4" /> {t.lessonUnits.newFolder}</span>
            <input value={folderName} maxLength={100} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createFolder()} placeholder={t.lessonUnits.folderName} className={`${inputCls} max-w-sm flex-1`} />
            <button type="button" onClick={createFolder} disabled={busy || !folderName.trim()} className="flex h-11 items-center gap-1.5 rounded-xl border border-accent px-4 text-sm font-bold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"><IconPlus className="h-4 w-4" /> {t.lessonUnits.createFolder}</button>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}
      </section>

      {!currentFolder && folders.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2"><IconFolder className="h-5 w-5 text-accent" /><h2 className="text-base font-black text-content">{t.lessonUnits.folders}</h2></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onDragOver={allowDrop} onDrop={(event) => dropIntoFolder(event, null)}>
            {folders.map((folder, index) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                index={index}
                items={items.filter((item) => item.folderId === folder.id)}
                busy={busy}
                dragging={dragged?.type === "folder" && dragged.id === folder.id}
                onOpen={() => setCurrentFolderId(folder.id)}
                onDragStart={() => setDragged({ type: "folder", id: folder.id })}
                onDragEnd={() => setDragged(null)}
                onDragOver={allowDrop}
                onDrop={(event) => dropBeforeFolder(event, folder.id)}
                onRefresh={() => router.refresh()}
                onError={setError}
              />
            ))}
          </div>
        </section>
      )}

      {regular.length > 0 && <LessonGroup title={t.lessonUnits.regularLessons} items={regular} dragged={dragged} busy={busy} folderId={currentFolderId} onDragStart={(id) => setDragged({ type: "lesson", id })} onDragEnd={() => setDragged(null)} onDragOver={allowDrop} onDropBefore={dropBeforeLesson} onDropInto={dropIntoFolder} />}
      {activities.length > 0 && <LessonGroup title={t.lessonUnits.activityLessons} items={activities} dragged={dragged} busy={busy} folderId={currentFolderId} onDragStart={(id) => setDragged({ type: "lesson", id })} onDragEnd={() => setDragged(null)} onDragOver={allowDrop} onDropBefore={dropBeforeLesson} onDropInto={dropIntoFolder} />}
      {shorts.length > 0 && <LessonGroup title={t.lessonUnits.shortsLessons} items={shorts} dragged={dragged} busy={busy} folderId={currentFolderId} onDragStart={(id) => setDragged({ type: "lesson", id })} onDragEnd={() => setDragged(null)} onDragOver={allowDrop} onDropBefore={dropBeforeLesson} onDropInto={dropIntoFolder} />}

      {visibleItems.length === 0 && (
        <div onDragOver={allowDrop} onDrop={(event) => dropIntoFolder(event, currentFolderId)} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface/60 p-6 text-center transition hover:border-accent">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl tint-accent"><IconFile className="h-6 w-6" /></span>
          <p className="text-sm font-bold text-content">{currentFolder ? t.lessonUnits.folderEmpty : t.lessonUnits.empty}</p>
          <p className="text-xs text-faint">{t.lessonUnits.dragLessonHint}</p>
        </div>
      )}
    </div>
  );
}

const folderThemes = [
  "from-violet-500/20 via-surface to-cyan-500/10",
  "from-amber-400/20 via-surface to-rose-500/10",
  "from-emerald-400/20 via-surface to-sky-500/10",
  "from-fuchsia-400/20 via-surface to-violet-500/10",
];

function FolderCard({ folder, index, items, busy, dragging, onOpen, onDragStart, onDragEnd, onDragOver, onDrop, onRefresh, onError }: {
  folder: LessonFolderCard;
  index: number;
  items: LessonCard[];
  busy: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onRefresh: () => void;
  onError: (value: string | null) => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const [pending, startPending] = useTransition();
  const counts = {
    REGULAR: items.filter((item) => item.kind === "REGULAR").length,
    ACTIVITY: items.filter((item) => item.kind === "ACTIVITY").length,
    SHORTS: items.filter((item) => item.kind === "SHORTS").length,
  };

  function rename() {
    if (!draft.trim()) return;
    onError(null);
    startPending(async () => {
      const result = await renameLessonFolderAction(folder.id, draft);
      if (result.error) onError(result.error);
      else setEditing(false);
      onRefresh();
    });
  }

  function remove() {
    if (!confirm(t.lessonUnits.deleteFolderConfirm)) return;
    onError(null);
    startPending(async () => {
      const result = await deleteLessonFolderAction(folder.id);
      if (result.error) onError(result.error);
      onRefresh();
    });
  }

  return (
    <article
      draggable={!editing}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("group relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ring-line shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", folderThemes[index % folderThemes.length], dragging && "opacity-45")}
    >
      <div className="absolute -right-5 -top-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <span className="mt-1 cursor-grab text-faint active:cursor-grabbing"><IconGrip className="h-4 w-4" /></span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="flex h-11 w-12 items-center justify-center rounded-xl bg-accent text-white shadow-sm"><IconFolder className="h-6 w-6" /></span>
          {!editing && <h3 className="mt-3 truncate text-base font-black text-content">{folder.name}</h3>}
          <p className="mt-0.5 text-xs font-semibold text-muted">{fmt(t.lessonUnits.lessonsInFolder, { n: items.length })}</p>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" title={t.lessonUnits.renameFolder} onClick={() => setEditing(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-accent"><IconPencil className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={busy || pending} title={t.lessonUnits.deleteFolder} onClick={remove} className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-rose-500 disabled:opacity-50"><IconTrash className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {editing && (
        <div className="relative mt-3 flex gap-2">
          <input autoFocus value={draft} maxLength={100} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") rename(); if (event.key === "Escape") { setDraft(folder.name); setEditing(false); } }} className="h-9 min-w-0 flex-1 rounded-xl border border-accent bg-surface px-3 text-sm font-semibold text-content outline-none" />
          <button type="button" onClick={rename} disabled={pending || !draft.trim()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"><IconCheck className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setDraft(folder.name); setEditing(false); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted"><IconX className="h-4 w-4" /></button>
        </div>
      )}
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {counts.REGULAR > 0 && <CategoryChip label={t.lessonUnits.regularLessons} count={counts.REGULAR} />}
        {counts.ACTIVITY > 0 && <CategoryChip label={t.lessonUnits.activityLessons} count={counts.ACTIVITY} />}
        {counts.SHORTS > 0 && <CategoryChip label={t.lessonUnits.shortsLessons} count={counts.SHORTS} />}
      </div>
    </article>
  );
}

function CategoryChip({ label, count }: { label: string; count: number }) {
  return <span className="rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted shadow-sm">{label} · {count}</span>;
}

function LessonGroup({ title, items, dragged, busy, folderId, onDragStart, onDragEnd, onDragOver, onDropBefore, onDropInto }: {
  title: string;
  items: LessonCard[];
  dragged: Dragged;
  busy: boolean;
  folderId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDropBefore: (event: DragEvent, before: LessonCard) => void;
  onDropInto: (event: DragEvent, folderId: string | null) => void;
}) {
  return (
    <section className="flex flex-col gap-2.5" onDragOver={onDragOver} onDrop={(event) => onDropInto(event, folderId)}>
      <div className="flex items-center gap-2"><IconFile className="h-4 w-4 text-accent" /><h2 className="text-base font-black text-content">{title}</h2><span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-black text-faint">{items.length}</span></div>
      {items.map((item) => (
        <Row key={item.id} item={item} busyOutside={busy} dragging={dragged?.type === "lesson" && dragged.id === item.id} onDragStart={() => onDragStart(item.id)} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={(event) => onDropBefore(event, item)} />
      ))}
    </section>
  );
}

function Row({ item, busyOutside, dragging, onDragStart, onDragEnd, onDragOver, onDrop }: {
  item: LessonCard;
  busyOutside: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [renameError, setRenameError] = useState<string | null>(null);

  function rename() {
    const next = draft.trim().slice(0, 160);
    if (!next) return;
    setRenameError(null);
    startBusy(async () => {
      const result = await saveLessonAction(item.id, { title: next });
      if (result.error) return setRenameError(result.error);
      setDraft(next);
      setEditing(false);
      router.refresh();
    });
  }

  function cancelRename() { setDraft(item.title); setRenameError(null); setEditing(false); }

  const filled = [
    item.sections > 0 ? fmt(t.lessonUnits.sectionsCount, { n: item.sections }) : null,
    item.words > 0 ? fmt(t.lessonUnits.words, { n: item.words }) : null,
    item.hasLexis ? t.lessonUnits.secLexis : null,
    item.hasVideo ? t.lessonUnits.secVideo : null,
    item.lines > 0 ? fmt(t.lessonUnits.linesCount, { n: item.lines }) : null,
    item.questions > 0 ? fmt(t.lessonUnits.questionsCount, { n: item.questions }) : null,
    item.tasks > 0 ? fmt(t.lessonUnits.tasksCount, { n: item.tasks }) : null,
  ].filter(Boolean) as string[];

  return (
    <div draggable={!editing} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; onDragStart(); }} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop} className={cn("flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm transition hover:ring-accent/50", dragging && "opacity-45")}>
      <span className="mt-3 cursor-grab text-faint active:cursor-grabbing"><IconGrip className="h-4 w-4" /></span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl tint-accent"><IconLayers className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <div className="flex min-w-0 max-w-xl flex-1 items-center gap-1.5">
              <input autoFocus value={draft} maxLength={160} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") rename(); if (event.key === "Escape") cancelRename(); }} className="h-9 min-w-0 flex-1 rounded-xl border border-accent bg-surface-2 px-3 text-sm font-semibold text-content outline-none" />
              <button type="button" disabled={busy || !draft.trim()} title={t.lessonUnits.save} onClick={rename} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"><IconCheck className="h-4 w-4" /></button>
              <button type="button" disabled={busy} title={t.common.cancel} onClick={cancelRename} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted disabled:opacity-50"><IconX className="h-4 w-4" /></button>
            </div>
          ) : (
            <><Link href={`/teacher/lessons/${item.id}`} className="font-semibold text-content transition hover:text-accent">{item.title}</Link><button type="button" title={t.lessonUnits.renameLesson} onClick={() => setEditing(true)} className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-accent"><IconPencil className="h-3.5 w-3.5" /></button></>
          )}
        </div>
        {renameError && <p className="mt-1 text-[12px] font-semibold text-rose-500">{renameError}</p>}
        <p className="mt-0.5 text-[12px] text-muted">{item.vocabName ? `${item.vocabName} · ` : ""}{filled.length > 0 ? filled.join(" · ") : t.lessonUnits.empty}</p>
        <p className="mt-0.5 text-[11px] text-faint">{item.assigned > 0 ? fmt(t.lessonUnits.assignedTo, { n: item.assigned }) : t.lessonUnits.notGiven}</p>
      </div>
      <Link href={`/teacher/lessons/${item.id}`} className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-line px-3 text-[13px] font-semibold text-content transition hover:border-accent hover:text-accent">{t.lessonUnits.open}<IconChevronRight className="h-4 w-4" /></Link>
      <button type="button" disabled={busy || busyOutside} title={t.lessonUnits.remove} onClick={() => { if (!confirm(t.lessonUnits.removeConfirm)) return; startBusy(async () => { await deleteLessonAction(item.id); router.refresh(); }); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"><IconTrash className="h-4 w-4" /></button>
    </div>
  );
}
