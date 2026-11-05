import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime, type DateCalendar } from './domain';

const STORAGE_KEY = 'ribat.calendar';

function readCalendar(): DateCalendar {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'hijri' || saved === 'gregorian') return saved;
  } catch {
    // private mode
  }
  return 'gregorian';
}

function saveCalendar(calendar: DateCalendar) {
  try {
    localStorage.setItem(STORAGE_KEY, calendar);
  } catch {
    // private mode
  }
}

type CalendarContextValue = {
  calendar: DateCalendar;
  setCalendar: (calendar: DateCalendar) => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendar, setCalendarState] = useState<DateCalendar>(() =>
    readCalendar(),
  );
  const setCalendar = (next: DateCalendar) => {
    saveCalendar(next);
    setCalendarState(next);
  };
  const value = useMemo(() => ({ calendar, setCalendar }), [calendar]);
  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar requires CalendarProvider');
  return ctx;
}

/** formatDate / formatDateTime bound to UI language and calendar preference. */
export function useFormatDates() {
  const { calendar } = useCalendar();
  const { i18n } = useTranslation();
  return useMemo(
    () => ({
      calendar,
      formatDate: (date: string) => formatDate(date, i18n.language, calendar),
      formatDateTime: (iso: string) =>
        formatDateTime(iso, i18n.language, calendar),
    }),
    [calendar, i18n.language],
  );
}
