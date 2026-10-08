import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DeviceResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { logout } from '../api/auth';
import { Button } from '../components/ui/button';

export function AccountDevicesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiFetch<DeviceResponse[]>('/api/v1/auth/devices'),
  });

  const revokeAll = useMutation({
    mutationFn: () => apiFetch<void>('/api/v1/auth/devices/all?all=true', { method: 'DELETE' }),
    onSuccess: async () => {
      await logout().catch(() => undefined);
      await queryClient.resetQueries();
      window.location.href = '/login';
    },
  });

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t('devices.title')}</h1>
      <ul className="grid gap-2">
        {(devices.data ?? []).map((device) => (
          <li key={device.id} className="rounded-lg border bg-white p-3 text-sm">
            {device.deviceLabel ?? device.userAgent ?? device.id}
            {device.current ? ` (${t('devices.current')})` : ''}
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" onClick={() => revokeAll.mutate()}>
        {t('devices.signOutEverywhere')}
      </Button>
    </section>
  );
}
