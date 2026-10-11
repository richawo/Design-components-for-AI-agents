export type SourceMap = { sources?: (string | null)[]; sourcesContent?: (string | null)[]; [key: string]: unknown };
export function compactGeneratedSourceMap<T extends SourceMap>(map: T): { map: Omit<T, "sourcesContent"> & { sourcesContent?: (string | null)[] }; omitted: number };
