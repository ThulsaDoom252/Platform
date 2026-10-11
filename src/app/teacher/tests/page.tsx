import { Suspense } from "react";
import { TestsLibrary } from "@/components/tests/tests-library";
import { TestsLibrarySkeleton } from "@/components/tests/tests-library-skeleton";
import { TestsWorkspaceNav } from "@/components/tests/tests-workspace-nav";

export default function TeacherTestsPage() {
  return <><TestsWorkspaceNav /><Suspense fallback={<TestsLibrarySkeleton />}><TestsLibrary /></Suspense></>;
}
