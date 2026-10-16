import { PHONE, role } from './scene.mjs';

const STATUS = ['حاضر', 'حاضر', 'متأخر', 'حاضر', 'غائب'];

await role('teacher', { phone: '+963999001030', device: PHONE, theme: 'nabawi', start: '/teach' }, async (s) => {
  const { page, context } = s;
  const chip = (row, name) => page.getByRole('radiogroup').nth(row).getByRole('radio', { name, exact: true });

  await s.line('3.1', async () => {
    await page.getByText('الآن', { exact: true }).first().waitFor();
    await s.zoom(page.locator('main li').first(), 4, 1.25);
  });

  await s.line('3.2', async () => {
    await s.tap(page.locator('main li a').first());
    await page.getByRole('radiogroup').first().waitFor();
    await s.wait(0.6);
    for (const [i, name] of STATUS.entries()) await s.tap(chip(i, name));
  });

  await s.line('3.3', async () => {
    await s.zoom(page.getByRole('progressbar').locator('xpath=..'), 3, 1.3);
  });

  await s.line('3.4', async () => {
    const row = page.locator('main li').first();
    await s.tap(row.getByRole('button', { name: 'تسجيل' }));
    await s.wait(0.5);
    await s.zoom(row.getByRole('button', { name: 'اختبار', exact: true }).locator('xpath=..'), 3, 1.3);
    await s.wait(1);
    await s.tap(row.getByRole('button', { name: 'مراجعة', exact: true }));
    await s.tap(row.getByRole('button', { name: 'اختبار', exact: true }));
    await s.tap(row.getByRole('button', { name: 'حفظ جديد', exact: true }));
    const from = Number(await row.getByLabel('من آية').inputValue());
    const to = row.getByLabel('إلى آية');
    await s.tap(to);
    await to.fill('');
    await to.pressSequentially(String(from + 4), { delay: 120 });
    await s.tap(row.getByRole('button', { name: 'جيد جداً' }));
    await s.tap(row.getByRole('button', { name: 'أضف خطأ' }));
    await s.zoom(row, 3, 1.15);
    await s.tap(row.getByRole('button', { name: 'حفظ', exact: true }));
  });

  await s.line('3.5', async () => {
    await s.zoom(page.locator('main li').nth(1).getByText(/آخر موضع/), 3, 1.4);
  });

  await s.line('3.6', async () => {
    await context.setOffline(true);
    await s.wait(0.6);
    await s.zoom(page.getByText(/غير متصل/).first(), 3, 1.3);
  });

  await s.line('3.7', async () => {
    await s.tap(chip(5, 'حاضر'));
    await s.tap(chip(6, 'حاضر'));
  });

  await s.line('3.8', async () => {
    await s.zoom(page.getByText(/غير متصل/).first(), 2, 1.3);
    await s.wait(1.5);
    await context.setOffline(false);
    const synced = page.getByText('أُرسلت كل التغييرات');
    await synced.waitFor({ timeout: 8000 }).catch(async () => {
      await s.tap(page.getByRole('button', { name: 'زامن الآن' }));
      await synced.waitFor({ timeout: 15000 });
    });
    await s.zoom(synced, 3, 1.3);
  });
});
