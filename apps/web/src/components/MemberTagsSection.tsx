import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberResponse, OrganizationResponse, TagResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from './ui/button';
import { Badge, Card, ErrorText } from './ui/form';
export function MemberTagsSection({ member }: { member: MemberResponse }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(member.tagIds ?? []);

  const org = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
  });

  const tags = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagResponse[]>('/api/v1/tags'),
    enabled: org.data?.tagsEnabled === true,
  });

  const save = useMutation({
    mutationFn: (tagIds: string[]) =>
      apiFetch<MemberResponse>(`/api/v1/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tagIds }),
      }),
    onSuccess: async (data) => {
      setSelected(data.tagIds ?? []);
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['member', member.id] });
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  if (!org.data?.tagsEnabled) return null;

  const byId = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));
  const labels = (member.tagIds ?? [])
    .map((id) => byId.get(id))
    .filter(Boolean) as string[];

  return (
    <Card title={t('members.tags.title')}>
      {tags.isError ? <ErrorText error={tags.error} /> : null}
      {editing ? (
        <div className="grid gap-3">
          <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-line p-2">
            {(tags.data ?? []).map((tag) => {
              const on = selected.includes(tag.id);
              return (
                <li key={tag.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-raised">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={on}
                      onChange={() =>
                        setSelected((current) =>
                          on
                            ? current.filter((id) => id !== tag.id)
                            : [...current, tag.id],
                        )
                      }
                    />
                    {tag.name}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => save.mutate(selected)}
              disabled={save.isPending}
            >
              {t('common.save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(member.tagIds ?? []);
                setEditing(false);
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
          {save.isError ? <ErrorText error={save.error} /> : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {labels.length === 0 ? (
            <p className="text-sm text-muted">{t('members.tags.empty')}</p>
          ) : (
            labels.map((label) => (
              <Badge key={label} tone="accent">
                {label}
              </Badge>
            ))
          )}
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t('common.edit')}
          </Button>
        </div>
      )}
    </Card>
  );
}
