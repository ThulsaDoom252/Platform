import { redirect } from "next/navigation";

/** Повторения временно закрыты вместе с разделом домашки. */
export default function StudentRevisionPage() {
  redirect("/student");
}
