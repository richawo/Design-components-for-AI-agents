// Web previews only: react-native-svg's web build asks React Native's asset
// registry for bundled image assets. Components here never bundle assets, so
// there is nothing to look up.
export function getAssetByID() {
  return null;
}
export function registerAsset() {
  return 0;
}
