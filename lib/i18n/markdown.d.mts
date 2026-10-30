export function inlineUnit(text: string): { key: string; opaque: string[] };
export function mapMarkdown(content: string, map: (key: string, sourceText?: string) => string): string;
