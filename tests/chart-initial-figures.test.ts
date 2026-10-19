import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SlopeComparison } from "@/registry/free/chart-slope-comparison/chart-slope-comparison";

function figureValues(markup: string) {
  return [...markup.matchAll(/data-demo="(?:bullet-value-\d+|slope-(?:before|after)-value)"[^>]*>([^<]*)<\/span>/g)]
    .map(match => match[1]);
}

describe("first chart observations", () => {
  it("renders actual slope observations before client effects run", () => {
    expect(figureValues(renderToStaticMarkup(createElement(SlopeComparison)))).toEqual(["46", "64"]);
  });
});
