import { redirect } from "next/navigation";

/** Домашка временно закрыта ученикам до следующего этапа разработки. */
export default function StudentHomeworkPage() {
  redirect("/student");
}
