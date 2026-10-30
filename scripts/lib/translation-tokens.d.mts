export const PROTECTED: RegExp;
export const SEPARATOR: string;
export function decodeEntities(value: string): string;
export function escapeText(value: string): string;
export function encode(html: string, options?: { names?: boolean }): {
  text: string;
  restore(translated: string): string | null;
  runs(): { texts: string[]; rebuild(translated: string[]): string };
};
export function splitBatch(translated: string, expected: number): string[] | null;
