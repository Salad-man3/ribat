import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateMemberInput, MemberResponse } from '@ribat/shared';
import { Button } from './ui/button';
import { Field, inputClass } from './ui/form';

const TEXT_FIELDS = [
  'motherName',
  'phone',
  'schoolGrade',
  'schoolName',
  'address',
] as const;
type Values = Record<keyof Omit<CreateMemberInput, 'householdId'>, string>;

const today = () => new Date().toISOString().slice(0, 10);

/** Create and edit share this form. Blank optional fields are left out of the payload. */
export function MemberForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  initial?: MemberResponse;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: CreateMemberInput) => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Values>({
    firstName: initial?.firstName ?? '',
    fatherName: initial?.fatherName ?? '',
    familyName: initial?.familyName ?? '',
    motherName: initial?.motherName ?? '',
    birthDate: initial?.birthDate ?? '',
    joinedAt: initial?.joinedAt ?? today(),
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    schoolGrade: initial?.schoolGrade ?? '',
    schoolName: initial?.schoolName ?? '',
    notes: initial?.notes ?? '',
  });
  const bind = (key: keyof Values) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues({ ...values, [key]: event.target.value }),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = Object.fromEntries(
          Object.entries(values)
            .map(([key, value]) => [key, value.trim()])
            .filter(([, value]) => value !== ''),
        ) as CreateMemberInput;
        onSubmit(payload);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('members.firstName')}>
          <input className={inputClass} required {...bind('firstName')} />
        </Field>
        <Field label={t('members.fatherName')}>
          <input className={inputClass} required {...bind('fatherName')} />
        </Field>
        <Field label={t('members.familyName')}>
          <input className={inputClass} required {...bind('familyName')} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('members.birthDate')}>
          <input
            type="date"
            className={inputClass}
            required
            {...bind('birthDate')}
          />
        </Field>
        <Field label={t('members.joinedAt')}>
          <input
            type="date"
            className={inputClass}
            required
            {...bind('joinedAt')}
          />
        </Field>
        {TEXT_FIELDS.map((key) => (
          <Field key={key} label={t(`members.${key}`)}>
            <input
              className={inputClass}
              {...(key === 'phone'
                ? {
                    dir: 'ltr',
                    inputMode: 'tel' as const,
                    placeholder: '+963…',
                  }
                : {})}
              {...bind(key)}
            />
          </Field>
        ))}
      </div>
      <Field label={t('members.notes')}>
        <textarea
          className={`${inputClass} min-h-20 py-2`}
          {...bind('notes')}
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
