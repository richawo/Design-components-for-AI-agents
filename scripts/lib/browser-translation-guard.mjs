/** A visible job marker ties a copied browser result to this exact queue item. */
export function translationBodyForJob(output, marker) {
  const matches = [...output.matchAll(/ZXJOB[A-Z0-9]+QXZ/gi)];
  if (matches.length !== 1 || matches[0][0].toUpperCase() !== marker.toUpperCase()) return null;
  const match = matches[0];
  return (output.slice(0, match.index) + output.slice(match.index + match[0].length)).trim();
}
