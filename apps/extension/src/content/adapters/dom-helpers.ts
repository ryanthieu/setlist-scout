export function getJsonLdScriptContents(doc: Document): string[] {
  return Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  ).map((el) => el.textContent ?? "");
}
