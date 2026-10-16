import { PHONE, role } from './scene.mjs';

await role('student', { phone: '+963999001040', device: PHONE, theme: 'mushaf', start: '/member' }, async (s) => {
  const { page } = s;
  const card = (title) => page.locator('section', { has: page.getByRole('heading', { name: title, exact: true }) }).last();
  await s.line('4.1', async () => {
    await s.wait(0.5);
    await s.scroll(420, 3);
  });
  await s.line('4.2', async () => {
    await s.zoom(card('الحضور'), 3.5, 1.2);
    await s.wait(3.5);
    await s.zoom(card('الحفظ'), 3.5, 1.2);
  });
  await s.line('4.3', async () => {
    await s.zoom(card('الحفظ'), 3, 1.15);
  });
});
