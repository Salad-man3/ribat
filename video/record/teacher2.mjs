import { PHONE, role } from './scene.mjs';

// The tajweed teacher: an explanation lesson, where pages are logged once for the class.
await role('teacher2', { phone: '+963999001105', device: PHONE, theme: 'nabawi', start: '/teach' }, async (s) => {
  const { page } = s;
  await s.line('3.9', async () => {
    await s.tap(page.locator('main li a').first());
    const form = page.locator('section', { hasText: 'الصفحات المشروحة في هذا الدرس' }).last();
    await form.scrollIntoViewIfNeeded();
    await s.wait(0.6);
    const to = form.getByLabel('إلى صفحة');
    await s.tap(to);
    await to.fill('');
    await to.pressSequentially('3', { delay: 120 });
    await s.type(form.getByLabel('ملاحظة'), 'مخارج الحروف: الحلق واللسان');
    await s.tap(form.getByRole('button', { name: 'حفظ', exact: true }));
    await s.zoom(form, 3, 1.2);
  });
});
