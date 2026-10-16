import { PHONE, role } from './scene.mjs';

await role('student', { phone: '+963999001040', device: PHONE, theme: 'mushaf', start: '/member' }, async (s) => {
  const { page } = s;
  const card = (title) => page.locator('section', { has: page.getByRole('heading', { name: title, exact: true }) }).last();
  await s.line('4.1', async () => {
    await s.wait(0.5);
    await s.scroll(420, 3);
  });
  await s.line('4.2', async () => {
    await card('الحفظ').scrollIntoViewIfNeeded();
    await s.zoom(card('الحفظ'), 4, 1.25);
    await s.wait(3);
    await s.scroll(300, 1.5);
  });
  await s.line('4.3', async () => {
    await s.zoom(card('الحفظ'), 3, 1.15);
  });
});
