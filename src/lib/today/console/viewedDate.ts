import { useEffect, useRef, useState } from "react";

import type { LocalDate } from "#domain/date";

/** Follows midnight only while the console remains on today. */
export function useViewedDate(today: LocalDate): [LocalDate, (date: LocalDate) => void] {
  const [date, setDate] = useState<LocalDate>(today);
  const followsToday = useRef(true);
  useEffect(() => {
    if (followsToday.current) setDate(today);
  }, [today]);
  return [
    date,
    (next) => {
      followsToday.current = next === today;
      setDate(next);
    },
  ];
}
