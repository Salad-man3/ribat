import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EducationLevelSchema,
  LEVELS_WITH_FACULTY,
  StudyStatusSchema,
  type CreateMemberInput,
  type EducationLevel,
  type MemberResponse,
  type CustomValues,
  type StudyStatus,
} from '@ribat/shared';
import { CustomFieldsSection } from './CustomFieldsSection';
import { Button } from './ui/button';
import { Field, inputClass } from './ui/form';

const TEXT_FIELDS = ['motherName', 'phone', 'address'] as const;
const EDUCATION_KEYS = [
  'studyStatus',
  'schoolGrade',
  'schoolName',
  'university',
  'faculty',
  'universityYear',
  'highestEducation',
] as const;
type Values = Record<
  Exclude<
    keyof CreateMemberInput,
    'householdId' | 'customValues' | 'tagIds' | (typeof EDUCATION_KEYS)[number]
  > | (typeof EDUCATION_KEYS)[number],
  string
>;

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
    studyStatus: initial?.studyStatus ?? '',
    university: initial?.university ?? '',
    faculty: initial?.faculty ?? '',
    universityYear: initial?.universityYear?.toString() ?? '',
    highestEducation: initial?.highestEducation ?? '',
    notes: initial?.notes ?? '',
  });
  const [customValues, setCustomValues] = useState<CustomValues>(
    initial?.customValues ?? {},
  );
  const status = values.studyStatus as StudyStatus | '';
  const level = values.highestEducation as EducationLevel | '';
  const showFaculty =
    status === 'UNIVERSITY' ||
    (status === 'NOT_STUDYING' &&
      level !== '' &&
      LEVELS_WITH_FACULTY.includes(level));
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
        const rest = Object.fromEntries(
          Object.entries(values)
            .filter(([key]) => !(EDUCATION_KEYS as readonly string[]).includes(key))
            .map(([key, value]) => [key, value.trim()])
            .filter(([, value]) => value !== ''),
        );
        // Only the chosen status's fields go out; the rest are nulled so they cannot linger.
        const text = (key: keyof Values, on: boolean) =>
          on ? values[key].trim() || null : null;
        onSubmit({
          ...rest,
          studyStatus: status || null,
          schoolGrade: text('schoolGrade', status === 'SCHOOL'),
          schoolName: text('schoolName', status === 'SCHOOL'),
          university: text('university', status === 'UNIVERSITY'),
          universityYear:
            status === 'UNIVERSITY' && values.universityYear
              ? Number(values.universityYear)
              : null,
          highestEducation: status === 'NOT_STUDYING' ? level || null : null,
          faculty: text('faculty', showFaculty),
          customValues,
        } as CreateMemberInput);
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('members.education')}>
          <select className={inputClass} {...bind('studyStatus')}>
            <option value="" />
            {StudyStatusSchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`members.studyStatusValue.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {status === 'SCHOOL' ? (
          <>
            <Field label={t('members.schoolGrade')}>
              <input className={inputClass} {...bind('schoolGrade')} />
            </Field>
            <Field label={t('members.schoolName')}>
              <input className={inputClass} {...bind('schoolName')} />
            </Field>
          </>
        ) : null}
        {status === 'UNIVERSITY' ? (
          <>
            <Field label={t('members.university')}>
              <input className={inputClass} {...bind('university')} />
            </Field>
            <Field label={t('members.universityYear')}>
              <input
                type="number"
                min={1}
                max={8}
                className={inputClass}
                {...bind('universityYear')}
              />
            </Field>
          </>
        ) : null}
        {status === 'NOT_STUDYING' ? (
          <Field label={t('members.highestEducation')}>
            <select className={inputClass} {...bind('highestEducation')}>
              <option value="" />
              {EducationLevelSchema.options.map((value) => (
                <option key={value} value={value}>
                  {t(`members.educationLevel.${value}`)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {showFaculty ? (
          <Field label={t('members.faculty')}>
            <input className={inputClass} {...bind('faculty')} />
          </Field>
        ) : null}
      </div>
      <Field label={t('members.notes')}>
        <textarea
          className={`${inputClass} min-h-20 py-2`}
          {...bind('notes')}
        />
      </Field>
      <CustomFieldsSection
        entityType="MEMBER"
        values={customValues}
        onChange={setCustomValues}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
