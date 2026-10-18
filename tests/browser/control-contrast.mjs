import assert from "node:assert/strict";

/** Measure the painted boundary, including translucent borders over the actual ancestor surfaces. */
export async function assertCheckboxContrast(page) {
  const checks = await page.locator('input[type="checkbox"]:not(:disabled):not(:checked)').evaluateAll((inputs) => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    const luminance = (rgb) => {
      const channels = rgb.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    return inputs.map((input) => {
      context.clearRect(0, 0, 2, 1);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 2, 1);
      const ancestors = [];
      for (let element = input; element; element = element.parentElement) ancestors.unshift(element);
      for (const element of ancestors) {
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 2, 1);
      }
      context.fillStyle = getComputedStyle(input).borderTopColor;
      context.fillRect(1, 0, 1, 1);
      const pixels = [...context.getImageData(0, 0, 2, 1).data];
      const background = pixels.slice(0, 3);
      const boundary = pixels.slice(4, 7);
      const a = luminance(background),
        b = luminance(boundary);
      return {
        label: input.getAttribute("aria-label"),
        background,
        boundary,
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  });
  assert.ok(checks.length, "The fixture includes an enabled unchecked checkbox");
  for (const check of checks)
    assert.ok(check.contrast >= 3, `${check.label}: boundary contrast ${check.contrast.toFixed(2)}:1`);
  return checks;
}
