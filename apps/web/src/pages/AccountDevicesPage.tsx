import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { DeviceResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import { Badge, Card, ErrorText, PageHeader } from '../components/ui/form';

export function AccountDevicesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiFetch<DeviceResponse[]>('/api/v1/auth/devices'),
  });

  const revoke = useMutation({
    mutationFn: (device: DeviceResponse | 'all') =>
      apiFetch<void>(
        device === 'all'
          ? '/api/v1/auth/devices/all?all=true'
          : `/api/v1/auth/devices/${device.id}`,
        {
          method: 'DELETE',
        },
      ),
    onSuccess: async (_data, device) => {
      if (device === 'all' || device.current) {
        queryClient.clear();
        navigate('/login', { replace: true });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
  const date = (iso: string) => new Date(iso).toLocaleString(i18n.language);

  return (
    <section className="grid gap-6">
      <PageHeader title={t('devices.title')} subtitle={t('devices.subtitle')} />
      <Card>
        <ul className="divide-y divide-line">
          {(devices.data ?? []).map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">
                    {device.deviceLabel ?? device.userAgent ?? device.id}
                  </span>
                  {device.current ? (
                    <Badge tone="accent">{t('devices.current')}</Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t('devices.lastSeen')}: {date(device.lastSeenAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => revoke.mutate(device)}
                disabled={revoke.isPending}
              >
                {t('devices.revoke')}
              </Button>
            </li>
          ))}
        </ul>
        {revoke.isError ? <ErrorText error={revoke.error} /> : null}
      </Card>
      <div>
        <Button
          variant="danger"
          onClick={() => revoke.mutate('all')}
          disabled={revoke.isPending}
        >
          {t('devices.signOutEverywhere')}
        </Button>
      </div>
    </section>
  );
}
