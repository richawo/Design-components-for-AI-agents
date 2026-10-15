export const root: string;
export const KIT_PATH: string;
export const BLOCK: RegExp;
export function readModules(source?: string): Map<string, string>;
export function renderBlock(names: string[], prefix: string, modules?: Map<string, string>): string;
export function componentFiles(): string[];
export function syncSource(text: string, modules?: Map<string, string>): { text: string; found: { names: string[]; prefix: string }[] };
