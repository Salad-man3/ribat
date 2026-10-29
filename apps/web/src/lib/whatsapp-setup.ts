export const WHATSAPP_SETUP_PLACEHOLDERS = [
  '{{mosqueName}}',
  '{{setupUrl}}',
  '{{phone}}',
  '{{code}}',
  '{{expires}}',
] as const;

export type WhatsappSetupMessageContext = {
  mosqueName: string;
  setupUrl: string;
  phone: string;
  code: string;
  expires: string;
};

const DEFAULT_TEMPLATES: Record<'ar' | 'en', string> = {
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

export function defaultWhatsappSetupTemplate(locale: 'ar' | 'en'): string {
  return DEFAULT_TEMPLATES[locale];
}

export function resolveWhatsappSetupTemplate(
  locale: 'ar' | 'en',
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
  return ['mosqueName', 'setupUrl', 'phone', 'code', 'expires'].reduce(
    (text, key) =>
      text.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        ctx[key as keyof WhatsappSetupMessageContext],
      ),
    template,
  );
}

export function whatsappDigitsFromE164(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function whatsappSetupChatUrl(phoneE164: string, message: string): string {
  const digits = whatsappDigitsFromE164(phoneE164);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function setupWhatsappChatUrl(input: {
  locale: 'ar' | 'en';
  override: string | null | undefined;
  phone: string;
  mosqueName: string;
  setupUrl: string;
  code: string;
  expires: string;
}): string {
  return whatsappSetupChatUrl(
    input.phone,
    interpolateWhatsappSetupMessage(
      resolveWhatsappSetupTemplate(input.locale, input.override),
      {
        mosqueName: input.mosqueName,
        setupUrl: input.setupUrl,
        phone: input.phone,
        code: input.code,
        expires: input.expires,
      },
    ),
  );
}
