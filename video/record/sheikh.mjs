import { DESKTOP, role } from './scene.mjs';

const card = (page, title) => page.locator('section', { has: page.getByRole('heading', { name: title, exact: true }) }).last();
const nav = (page, label) => page.locator('aside nav a', { hasText: label });

await role('sheikh', { phone: '+963999001001', device: DESKTOP, theme: 'emerald', start: '/staff' }, async (s) => {
  const { page } = s;

  await s.line('2.1', async () => {
    await s.wait(0.6);
    await page.mouse.move(1330, 300, { steps: 40 });
  });

  await s.line('2.2', async () => {
    await s.tap(nav(page, 'الأعضاء'));
    await page.waitForLoadState('networkidle');
    await s.wait(0.8);
    await s.scroll(700, 2.5);
    const child = page.locator('main a[href^="/staff/members/"]').filter({ has: page.locator('xpath=..//*[contains(text(),"الصف")]') }).first();
    await s.tap((await child.count()) ? child : page.locator('main a[href^="/staff/members/"]').nth(4));
    await page.waitForLoadState('networkidle');
    await s.wait(0.6);
    await s.zoom(card(page, 'أولياء الأمور'), 3);
  });

  await s.line('2.3', async () => {
    // An adult student with a phone and no login yet.
    await page.goto('http://localhost:5273/staff/members');
    const adult = await page.evaluate(async () => {
      const rows = await (await fetch('/api/v1/members?status=ACTIVE&limit=200')).json();
      return rows.find((m) => m.phone === '+963999001305');
    });
    await s.type(page.getByPlaceholder('ابحث بالاسم أو الهاتف'), adult.firstName);
    await s.wait(1);
    await s.tap(page.locator(`main a[href="/staff/members/${adult.id}"]`));
    await page.waitForLoadState('networkidle');
    const access = card(page, 'الدخول إلى التطبيق');
    await access.scrollIntoViewIfNeeded();
    await s.tap(access.getByRole('button', { name: /منح الصلاحية|إصدار رمز إعداد جديد/ }));
    await s.wait(0.8);
    await s.zoom(access, 3.5);
  });

  await s.line('2.4', async () => {
    const notes = card(page, 'ملاحظات خاصة');
    await s.type(notes.getByPlaceholder('اكتب ملاحظة…'), 'حافظ متقن، يُرشَّح لإمامة التراويح.');
    await s.tap(notes.getByRole('button', { name: 'إضافة ملاحظة' }));
    await s.zoom(notes, 3);
  });

  await s.line('2.5', async () => {
    await s.tap(nav(page, 'الحلقات'));
    await page.waitForLoadState('networkidle');
    await s.wait(0.6);
    await s.tap(page.locator('main summary', { hasText: 'حلقة جديدة' }));
    const form = page.locator('main details form');
    await s.type(form.getByLabel('الاسم'), 'حلقة الناشئة');
    await form.getByLabel('النوع').selectOption('BOTH');
    await s.wait(0.5);
    await s.type(form.getByLabel('المكان'), 'المكتبة');
    await s.tap(form.getByRole('button', { name: 'حلقة جديدة' }));
    await page.waitForURL(/\/staff\/courses\/[0-9a-f-]{36}/);
    await page.waitForLoadState('networkidle');
  });

  await s.line('2.6', async () => {
    const toggles = page.locator('main label', { hasText: 'عدة معلمين' });
    await s.zoom(toggles.locator('xpath=..'), 6, 1.3);
    await s.tap(toggles.locator('input[type=checkbox]'));
    await s.wait(1.2);
    await s.tap(page.locator('main label', { hasText: 'مجموعات' }).locator('input[type=checkbox]'));
    await s.wait(1.2);
    await s.zoom(card(page, 'المجموعات'), 3, 1.2);
  });

  await s.line('2.7', async () => {
    await s.tap(nav(page, 'الحلقات'));
    await page.waitForLoadState('networkidle');
    await s.tap(page.locator('main a', { hasText: 'حلقة تحفيظ العصر' }).first());
    await page.waitForLoadState('networkidle');
    const schedule = card(page, 'الجدول الأسبوعي');
    await s.zoom(schedule, 4.5);
    await s.wait(4.5);
    await s.zoom(card(page, 'الأسابيع الأربعة القادمة'), 3.5);
  });

  await s.line('2.8', async () => {
    await s.tap(nav(page, 'إعدادات المسجد'));
    await page.waitForLoadState('networkidle');
    await s.wait(0.6);
    const isha = page.locator('label', { hasText: 'العشاء' }).locator('input[type=time]');
    await isha.scrollIntoViewIfNeeded();
    await s.zoom(isha.locator('xpath=ancestor::section[1]'), 4);
    await s.tap(isha);
    await page.keyboard.press('ArrowRight');
    await s.wait(0.4);
    await page.keyboard.press('ArrowUp');
    await s.wait(0.4);
    await page.keyboard.press('ArrowUp');
  });

  await s.line('2.9', async () => {
    await s.tap(nav(page, 'سجل التغييرات'));
    await page.waitForLoadState('networkidle');
    await s.wait(0.8);
    await s.tap(page.locator('main summary').first());
    await s.zoom(page.locator('main details').first(), 3);
  });
});
