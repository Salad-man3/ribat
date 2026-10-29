import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberResponse } from '@ribat/shared';
import { useMembers } from '../api/members';
import { cn } from '../lib/utils';
import { fullName } from './MemberCard';
import { inputClass } from './ui/form';

function teacherRank(teaching: { endedAt?: string | null }[] | undefined): number {
  if (!teaching?.length) return 2;
  if (teaching.some((t) => !t.endedAt)) return 0;
  return 1;
}

export function MemberCombobox({
  value,
  onChange,
  exclude,
  includeCourses,
  placeholder,
  id,
}: {
  value: string;
  onChange: (memberId: string) => void;
  exclude?: Set<string>;
  includeCourses?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pickedName, setPickedName] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const members = useMembers('ACTIVE', query, includeCourses);

  const options = useMemo(() => {
    const rows = [...(members.data ?? [])]
      .filter((m) => !exclude?.has(m.id))
      .sort((a, b) => teacherRank(a.teaching) - teacherRank(b.teaching));
    return rows.slice(0, 12);
  }, [members.data, exclude]);

  const selected = members.data?.find((m) => m.id === value);
  const display = value
    ? (selected ? fullName(selected) : pickedName || query)
    : query;

  const pick = (member: MemberResponse) => {
    onChange(member.id);
    setPickedName(fullName(member));
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setPickedName('');
    setQuery('');
    setHighlight(0);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={cn(inputClass, value && 'pe-16')}
        placeholder={placeholder ?? t('members.search')}
        value={display}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setPickedName('');
          if (value) onChange('');
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((i) => (i + 1) % options.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((i) => (i - 1 + options.length) % options.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(options[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {value ? (
        <button
          type="button"
          className="absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
        >
          {t('common.cancel')}
        </button>
      ) : null}
      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{t('members.empty')}</li>
          ) : (
            options.map((member, index) => (
              <li key={member.id} role="option" aria-selected={member.id === value}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col px-3 py-2 text-start text-sm',
                    index === highlight ? 'bg-paper' : 'hover:bg-paper',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(member)}
                >
                  <span className="font-medium">{fullName(member)}</span>
                  {member.teaching?.some((row) => !row.endedAt) ? (
                    <span className="text-xs text-muted">{t('members.teaching')}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
