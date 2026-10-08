import { notFound } from "next/navigation";
import { TestPractice } from "@/components/tests/test-practice";
import { findLibraryTest } from "@/lib/tests/catalog";

export default async function TestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const test = findLibraryTest(testId);
  if (!test) notFound();
  return <TestPractice test={test} />;
}
