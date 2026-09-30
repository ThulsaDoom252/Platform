import { redirect } from "next/navigation";

/** Ошибки временно закрыты ученикам до следующего этапа разработки. */
export default function StudentMistakesPage() {
  redirect("/student");
}
