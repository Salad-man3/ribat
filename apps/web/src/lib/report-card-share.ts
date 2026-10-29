/** Decision 15.1: plain wa.me link with app URL only — no PII in the query string. */
export function reportCardWhatsappUrl(appUrl: string, message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message.replace('{{url}}', appUrl))}`;
}
