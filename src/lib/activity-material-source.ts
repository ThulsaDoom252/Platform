import type { CopyTree } from "./actions/materials";

/** Saved sources win while editing; new class activities open the exact student's tree. */
export function initialActivityMaterialSource(
  trees: readonly CopyTree[],
  startingNodeIds: readonly string[],
  defaultStudentId?: string,
): { source: "MINE" | "STUDENTS"; studentTreeKey: string } {
  const usable = trees.filter(tree => tree.scope === "PERSONAL" || tree.scope === "STUDENT");
  const firstStudent = usable.find(tree => tree.scope === "STUDENT");
  const saved = usable.find(tree => startingNodeIds.some(id => tree.nodes.some(node => node.id === id)));
  if (saved) return {
    source: saved.scope === "STUDENT" ? "STUDENTS" : "MINE",
    studentTreeKey: saved.scope === "STUDENT" ? saved.key : firstStudent?.key ?? "",
  };
  if (defaultStudentId) return {
    source: "STUDENTS",
    studentTreeKey: usable.find(tree => tree.scope === "STUDENT" && tree.ownerId === defaultStudentId)?.key ?? "",
  };
  return { source: "MINE", studentTreeKey: firstStudent?.key ?? "" };
}
