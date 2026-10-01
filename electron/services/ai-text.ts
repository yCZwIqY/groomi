// Tiptap formatting is not story context. Decode entities after removing markup so
// escaped angle brackets in the actual manuscript remain intact.
export function toAiText(html: string | undefined): string {
  if (!html) return '';
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<img\b[^>]*>/gi, '[이미지]')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (encoded, entity: string) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? encoded;
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : encoded;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildAiChapterText(
  content: {
    title?: string;
    subTitle?: string;
    draft?: { content: string };
    manuscript?: { content: string };
  },
  fallbackTitle?: string,
) {
  const scripts = [
    ...new Set(
      [toAiText(content.draft?.content), toAiText(content.manuscript?.content)].filter(Boolean),
    ),
  ];
  return [content.title ?? fallbackTitle, content.subTitle, ...scripts]
    .filter(Boolean)
    .join('\n\n');
}
