export async function check({ page, mount, assert }) {
  const samples = 8000 * 4, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  const route = '**/__handoff_transcript.wav';
  await page.route(route, request => request.fulfill({ contentType: 'audio/wav', body: wav }));
  try {
    await mount(`window.allowTranscriptSeek=false;window.transcriptSeeks=[];window.transcriptCues=[];window.transcriptRates=[];window.transcriptPlayback=[];createRoot(document.getElementById('root')).render(<Subject.MediaTranscriptPlayer media={{id:'fixture',title:'Local transcript fixture',src:'/__handoff_transcript.wav',duration:99,peaks:[.2,.3,.1,.4]}} passages={[{id:'first',start:0,end:1,text:'Keep the first sentence.'},{id:'second',start:1,end:3,text:'Move to the second sentence.'},{id:'invalid',start:NaN,end:2,text:'An untimed note stays readable.'}]} onBeforeSeek={()=>window.allowTranscriptSeek} onSeek={(time,passage)=>window.transcriptSeeks.push({time,id:passage?.id??null})} onCueChange={id=>window.transcriptCues.push(id??null)} onRateChange={rate=>window.transcriptRates.push(rate)} onPlaybackChange={playing=>window.transcriptPlayback.push(playing)}/>);`);
    await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 2);
    assert.equal(await page.locator('audio').evaluate(audio => audio.duration), 4);
    const cue = page.locator('[data-demo="cue-1"]');
    await cue.focus();
    await cue.press('Enter');
    assert.equal(await page.evaluate(() => window.transcriptSeeks.length), 0);
    assert.ok(await page.locator('audio').evaluate(audio => audio.currentTime < 0.05));
    await page.evaluate(() => { window.allowTranscriptSeek = true; });
    await cue.press('Space');
    await page.waitForFunction(() => window.transcriptSeeks.at(-1)?.id === 'second');
    assert.deepEqual(await page.evaluate(() => window.transcriptSeeks.at(-1)), { time: 1, id: 'second' });
    await page.waitForFunction(() => window.transcriptCues.at(-1) === 'second');
    assert.equal(await page.getByText('An untimed note stays readable.', { exact: true }).isVisible(), true);
    assert.equal(await page.locator('[data-demo="cue-2"]:enabled').count(), 0);
    await page.locator('[data-demo="rate"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.transcriptRates.length > 0);
    assert.equal(await page.locator('audio').evaluate(audio => audio.playbackRate), await page.evaluate(() => window.transcriptRates.at(-1)));
    const play = page.locator('[data-demo="play"]');
    await play.focus();
    await play.press('Space');
    await page.waitForFunction(() => window.transcriptPlayback.at(-1) === true && document.querySelector('audio').currentTime > 1.1);
    await play.press('Space');
    await page.waitForFunction(() => window.transcriptPlayback.at(-1) === false);
    await mount(`createRoot(document.getElementById('root')).render(<Subject.MediaTranscriptPlayer media={{id:'empty',title:'No recording'}} passages={[]}/>);`);
    assert.equal(await page.locator('[data-demo="play"]').isDisabled(), true);
    assert.equal(await page.locator('[data-demo^="cue-"]').count(), 0);
  } finally { await page.unroute(route); }
}
