# Signature pad

A Harbor mutual NDA that is already signed. Two warm paper plates sit on a near-black shell. Mira Chen's mark is finished. Jordan Hale's is the live plate: the same ink, and it still accepts a pen. The ink is a run of short round-capped segments along a curve through the pen points, not a stroke of constant width. Slow curves stay thick. The exit tail, drawn faster, thins out. The ends taper. The mark sits on the baseline.

The shell matches the rest of the library: radius 18, an inset hairline, mono eyebrows, one serif clause. The paper is `#f4f0e6` in the dark theme and `#fffdf8` in the light, with a faint grain and a baseline. Printed names sit under the rule in the UI sans, roles in mono. Nothing else is on the paper.

## Behaviour

- Pointer down on Jordan's plate starts a stroke. Points are normalized 0–1 with timestamps, so the same mark survives a resize. A fast move stores fewer, wider-spaced points and the ribbon thins.
- Undo drops the last stroke. Clear empties the plate and shows "Sign here". ⌘Z undoes while the shell is focused.
- Replay draws Jordan's mark again over 2.3s, name first, then the underline after a short gap. Reduced motion shows the finished mark.
- Export downloads an SVG of the current strokes, filled with the pen colour, named from the signatory.
- The header counts how many plates still have ink.

## Layout

Max width 960. The clause is serif, about 68 characters wide. Plates sit side by side from the `@3xl` container and stack below it. Each plate's drawing surface is 148px tall, 168px from `@md`. Tool buttons under the open plate are 44px tall, 36px from `@md`: Undo, Clear, Replay, Export. Replay is the filled button.

## Colour and type

Dark shell `#0c0c0e`, ink `#f4f4f5`, muted `#a1a1aa`, faint `#9a9aa3`, raised `#16161a`. Pen `#1c1917` on the paper. The accent control replaces the pen; the chrome stays on the theme ink. Instrument Serif for the clause and the empty-state prompt. Geist for names and buttons. Geist Mono for eyebrows, dates and the footer.

## Motion

Plates rise 10px out of a 6px blur, 60ms apart, ease `[0.22, 1, 0.36, 1]`. Replay is a hand-timed reveal of the stored points, not a CSS stroke-dash. Buttons press to 0.97. Reduced motion fades the plates in and skips the replay.

## Avoid

A constant-width stroke, a row of dots, an empty canvas as the default, a rainbow pen, stock handwriting fonts, or a signature that is just a sine wave. Do not put the tools on the paper.
