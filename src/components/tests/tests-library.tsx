"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { parseTestLibraryLocation, testLibraryHref, type TestLibraryLocation } from "@/lib/test-library";
import { TestsLibraryView } from "./tests-library-view";

export function TestsLibrary() {
  const { t, locale } = useT();
  const searchParams = useSearchParams();
  const location = parseTestLibraryLocation(searchParams);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [location.level, location.category]);

  const navigate = (next: TestLibraryLocation) => {
    // Keep folders bookmarkable and Back/Forward working, without server refetches.
    window.history.pushState(null, "", testLibraryHref(next.level, next.category));
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return <TestsLibraryView location={location} labels={t.testsLibrary} locale={locale} onNavigate={navigate} headingRef={headingRef} />;
}
