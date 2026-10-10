# Repository showcase assets

Run `node scripts/readme-showcase.mjs` from the repository root after installing
dependencies. It uses the existing public recordings in `public/previews/`,
Chromium and ffmpeg. It does not read private component source or blog content.

The root README selects a matching wordmark for light and dark themes. Every
animation has a PNG alternative selected by `prefers-reduced-motion: reduce`.
`social-preview.png` is the 1280 by 640 sharing image for the repository.

To change the featured components, update the selections and hero layout in the
script, regenerate the assets, and update the root README's links and alt text.
Keep the Free and Pro captions consistent with the component metadata.
