import { PHONE, role } from './scene.mjs';

await role('father', { phone: '+963999001050', device: PHONE, theme: 'iznik', start: '/guardian' }, async (s) => {
  const { page } = s;
  const card = (title) => page.locator('section', { has: page.getByRole('heading', { name: title, exact: true }) });
  await s.line('5.1', async () => {
    await s.zoom(page.locator('header nav a', { hasText: 'الإشعارات' }), 3, 1.15);
  });
  await s.line('5.2', async () => {
    await s.scroll(650, 2.5);
    await s.zoom(card('الحضور').first(), 2.5, 1.2);
    await s.wait(2.5);
    await card('الحفظ').first().scrollIntoViewIfNeeded();
    await s.zoom(card('الحفظ').first(), 2.5, 1.2);
  });
  await s.line('5.3', async () => {
    await s.tap(page.locator('header nav a', { hasText: 'الإشعارات' }));
    await page.waitForLoadState('networkidle');
    await s.wait(0.8);
    await s.scroll(250, 2);
  });
  await s.line('5.4', async () => {
    await page.goto('http://localhost:5273/guardian');
    await page.waitForLoadState('networkidle');
    const form = card('الأعذار').last();
    await form.scrollIntoViewIfNeeded();
    await s.type(form.getByLabel('السبب'), 'موعد عند طبيب الأسنان');
    await s.tap(form.getByRole('button', { name: 'إرسال العذر' }));
    await s.wait(0.8);
    await s.zoom(form, 3, 1.15);
  });
  await s.line('5.5', async () => {
    await s.scroll(-3000, 2.5);
  });
});
