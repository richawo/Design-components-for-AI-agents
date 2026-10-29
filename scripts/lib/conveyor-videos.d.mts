export function conveyorVideoHash(bytes: Uint8Array, options?: { visualStyle?: string }): string;
export function conveyorVideoManifest(root: string, slugs: string[], options?: { visualStyle?: string; theme?: "light" | "dark"; previewVersion?:number }): Record<string, string>;
