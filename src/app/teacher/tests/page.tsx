import { Suspense } from "react";
import { TestsLibrary } from "@/components/tests/tests-library";
import { TestsLibrarySkeleton } from "@/components/tests/tests-library-skeleton";

export default function TeacherTestsPage() {
  return <Suspense fallback={<TestsLibrarySkeleton />}><TestsLibrary /></Suspense>;
}
