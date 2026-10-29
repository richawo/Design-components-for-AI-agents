type StyleMedia = { thumb: string; video: { mp4: string; webm: null } | null; conveyorVideo?: { mp4: string; webm: null } };
export function stylePreviewManifest(root: string, variants: Record<string, string[]>, options?: { required?: boolean; themes?: ("light" | "dark")[]; previewVersion?:number }): Record<string, Record<string, StyleMedia & {themes?: {dark?:StyleMedia}}>>;
