"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { studentPlatformCommandAction } from "@/lib/actions/class";

/**
 * Даёт учителю привести уже работающего на платформе ученика в класс.
 * Команда одноразовая: после чтения она удаляется на сервере, поэтому
 * обновление страницы не затягивает ученика в класс повторно.
 */
export function StudentClassSummons() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    let pulling = false;

    const pull = async () => {
      if (pulling) return;
      pulling = true;
      try {
        const command = await studentPlatformCommandAction();
        if (alive && command.enterClass && pathname !== "/student/class") {
          router.push("/student/class");
        }
      } finally {
        pulling = false;
      }
    };

    void pull();
    const timer = window.setInterval(() => void pull(), 2_500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  return null;
}
