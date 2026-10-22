export const PUBLIC_CONTENT_PACKAGE: string;
export function writePublicContentRuntime(root: string, packed: { encoding: string; data: string }): string;
export function assertSinglePublicContentCopy(serverSource: string, packed: { data: string }): number;
