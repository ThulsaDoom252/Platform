"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { IconPicker } from "./icon-picker";
import {
  createNodeAction,
  updateNodeAction,
  type NodeState,
} from "@/lib/actions/materials";
import { IconPencil, IconPlus } from "@/components/icons";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export type EditorTarget =
  | {
      mode: "create";
      parentId: string | null;
      kind: "FOLDER" | "PAGE";
      scope?: "MATERIAL" | "MISTAKE";
      ownerId?: string;
    }
  | {
      mode: "edit";
      nodeId: string;
      name: string;
      icon: string | null;
      description: string | null;
      isPage: boolean;
    };

export function NodeEditor({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}) {
  const isEdit = target?.mode === "edit";
  const action = isEdit ? updateNodeAction : createNodeAction;
  const [state, formAction, pending] = useActionState<NodeState, FormData>(action, {});

  const [icon, setIcon] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!target) return;
    if (target.mode === "edit") {
      setIcon(target.icon);
      setName(target.name);
      setDescription(target.description ?? "");
    } else {
      setIcon(target.kind === "PAGE" ? "📄" : "📁");
      setName("");
      setDescription("");
    }
  }, [target]);

  // Закрываем окно, когда действие отработало успешно.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  if (!target) return null;

  const isPage = target.mode === "edit" ? target.isPage : target.kind === "PAGE";
  const title = isEdit
    ? "Переименовать"
    : isPage
      ? "Новая страница"
      : "Новая папка";

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      icon={isEdit ? <IconPencil className="h-5 w-5" /> : <IconPlus className="h-5 w-5" />}
    >
      <form action={formAction} className="flex flex-col gap-4">
        {target.mode === "edit" ? (
          <input type="hidden" name="nodeId" value={target.nodeId} />
        ) : (
          <>
            <input type="hidden" name="parentId" value={target.parentId ?? ""} />
            <input type="hidden" name="kind" value={target.kind} />
            <input type="hidden" name="scope" value={target.scope ?? "MATERIAL"} />
            <input type="hidden" name="ownerId" value={target.ownerId ?? ""} />
          </>
        )}
        <input type="hidden" name="icon" value={icon ?? ""} />

        <div>
          <label className="text-sm font-medium text-content">Название</label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder={isPage ? "Например: Sport" : "Например: Vocabulary"}
            className={`${inputCls} mt-1.5`}
          />
        </div>

        {isPage && (
          <div>
            <label className="text-sm font-medium text-content">Подзаголовок</label>
            <input
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Короткое описание страницы"
              className={`${inputCls} mt-1.5`}
            />
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-sm font-medium text-content">Иконка</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-lg">
              {icon ?? "—"}
            </span>
          </div>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        {state.error && <p className="text-sm text-rose-500">{state.error}</p>}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
