import { DESKTOP, role } from './scene.mjs';

await role('themes', { phone: '+963999001001', device: DESKTOP, theme: 'emerald', start: '/staff/courses' }, async (s) => {
  const { page } = s;
  const aside = page.locator('aside');
  await s.line('6.1', async () => {
    await s.tap(aside.getByRole('button', { name: 'English' }));
    await s.wait(1.6);
    await s.tap(aside.getByRole('button', { name: 'العربية' }));
  });
  await s.line('6.2', async () => {
    await s.tap(aside.getByRole('button', { name: 'المظهر' }));
    await s.wait(0.8);
    for (const name of ['النبوي', 'إزنيق', 'الحمراء', 'مصحف', 'قيام']) {
      await s.tap(page.locator('[popover]:popover-open').getByRole('radio', { name }));
      await s.wait(0.7);
    }
  });
  await s.line('6.3', async () => {
    await page.keyboard.press('Escape');
  });
});
