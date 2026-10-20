export function copyPreparedServerAssets(input: {
  preparedDirectory: string;
  destination: string;
  serverEntry: string;
  serverSource: string;
  sharedManifest: string;
}): { omittedManifest: boolean };
