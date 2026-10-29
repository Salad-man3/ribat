import { z } from 'zod';
import { LocaleSchema } from './organization.js';

export type OrganizationLocale = z.infer<typeof LocaleSchema>;

export const WHATSAPP_SETUP_PLACEHOLDERS = [
  '{{mosqueName}}',
  '{{setupUrl}}',
  '{{phone}}',
  '{{code}}',
  '{{expires}}',
] as const;

export const WhatsappSetupTemplateSchema = z
  .string()
  .trim()
  .max(1000)
  .refine((body) => body.includes('{{code}}'), {
    message: 'Template must include {{code}}',
  });

export type WhatsappSetupMessageContext = {
  mosqueName: string;
  setupUrl: string;
  phone: string;
  code: string;
  expires: string;
};

const DEFAULT_TEMPLATES: Record<OrganizationLocale, string> = {
  ar: `السلام عليكم،
{{mosqueName}} — رمز إعداد الدخول إلى تطبيق رباط:
افتح {{setupUrl}}
رقم الهاتف: {{phone}}
الرمز: {{code}}
ينتهي: {{expires}}
اختر كلمة المرور بنفسك. لن يطلب منك أحد في المسجد كلمة المرور.`,
  en: `Hello,
{{mosqueName}} — Ribat app setup code:
Open {{setupUrl}}
Phone: {{phone}}
Code: {{code}}
Expires: {{expires}}
Choose your own password. Mosque staff will never ask for your password.`,
};

export function defaultWhatsappSetupTemplate(locale: OrganizationLocale): string {
  return DEFAULT_TEMPLATES[locale];
}

export function resolveWhatsappSetupTemplate(
  locale: OrganizationLocale,
  override: string | null | undefined,
): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return defaultWhatsappSetupTemplate(locale);
}

export function interpolateWhatsappSetupMessage(
  template: string,
  ctx: WhatsappSetupMessageContext,
): string {
  return template
    .replaceAll('{{mosqueName}}', ctx.mosqueName)
    .replaceAll('{{setupUrl}}', ctx.setupUrl)
    .replaceAll('{{phone}}', ctx.phone)
    .replaceAll('{{code}}', ctx.code)
    .replaceAll('{{expires}}', ctx.expires);
}

export function whatsappDigitsFromE164(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function whatsappSetupChatUrl(phoneE164: string, message: string): string {
  const digits = whatsappDigitsFromE164(phoneE164);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
