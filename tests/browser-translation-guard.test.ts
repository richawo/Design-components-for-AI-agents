import { describe, expect, it } from 'vitest';
import { translationBodyForJob } from '../scripts/lib/browser-translation-guard.mjs';

describe('browser translation job identity', () => {
  it('removes only the current marker and preserves translated markup and tokens', () => {
    const body = 'ZXQ000QXZ\nTexte [[[1]]][[[T0]]][[[/1]]] 日本語';
    expect(translationBodyForJob('ZXJOBABC1230QXZ\n\n' + body, 'ZXJOBABC1230QXZ')).toBe(body);
  });
  it('rejects a result from another job or another bridge run', () => {
    expect(translationBodyForJob('ZXJOBABC1231QXZ\nTexte', 'ZXJOBABC1230QXZ')).toBeNull();
    expect(translationBodyForJob('ZXJOBDEF4560QXZ\nTexte', 'ZXJOBABC1230QXZ')).toBeNull();
  });
  it('rejects missing or duplicated markers', () => {
    expect(translationBodyForJob('Texte', 'ZXJOBABC1230QXZ')).toBeNull();
    expect(translationBodyForJob('ZXJOBABC1230QXZ Texte ZXJOBABC1230QXZ', 'ZXJOBABC1230QXZ')).toBeNull();
  });
});
