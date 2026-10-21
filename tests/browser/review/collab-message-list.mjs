// Known punctuated handles, exact notifications and retained failed messages.
export async function check({ page, mount, assert }) {
  await mount(`window.messageReactions=[];window.messageReplies=[];window.messageRetries=[];const people=[{id:'noor',name:'Noor Ali',handle:'noor'},{id:'sam',name:'Sam Chen',handle:'sam.s'}];function Host(){const[messages,setMessages]=React.useState([{id:'msg',authorId:'sam',body:'Ready, @noor.',time:'09:42',replyCount:1,replyAuthorIds:['noor'],reactions:[{id:'like',count:1,active:false}]},{id:'own',authorId:'noor',body:'Keep this failed post.',time:'09:43',status:'failed'}]);return <Subject.MessageList messages={messages} people={people} currentUserId="noor" onReaction={(id,kind)=>{window.messageReactions.push({id,kind});setMessages(old=>old.map(message=>message.id===id?{...message,reactions:[{id:kind,count:2,active:true}]}:message))}} onReply={id=>window.messageReplies.push(id)} onRetry={id=>{window.messageRetries.push(id);if(window.messageRetries.length===2)setMessages(old=>old.map(message=>message.id===id?{...message,status:undefined}:message))}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const paragraph = page.locator('p').filter({ hasText: /^Ready,/ });
  assert.equal(await paragraph.getByText('@Noor', { exact: true }).count(), 1, 'A terminal period does not become part of a known handle');
  assert.equal(await paragraph.innerText(), 'Ready, @Noor.');
  assert.equal(await paragraph.locator('xpath=../..').locator(':scope > span[aria-hidden="true"]').count(), 1, 'A punctuated mention of the current person retains its row marker');
  const reaction = page.locator('[data-demo="react-msg-like"]');
  await reaction.focus();
  await reaction.press('Space');
  await page.waitForFunction(() => window.messageReactions.length === 1);
  assert.deepEqual(await page.evaluate(() => window.messageReactions), [{ id: 'msg', kind: 'like' }]);
  assert.equal(await reaction.getAttribute('aria-pressed'), 'true');
  const reply = page.locator('[data-demo="reply-msg"]');
  await reply.focus();
  await reply.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.messageReplies), ['msg']);
  const retry = page.getByRole('button', { name: 'Retry', exact: true });
  await retry.focus();
  await retry.press('Enter');
  await page.waitForFunction(() => window.messageRetries.length === 1);
  assert.equal(await page.getByRole('alert').filter({ hasText: 'Not delivered.' }).count(), 1);
  assert.equal(await page.getByText('Keep this failed post.', { exact: true }).count(), 1);
  await retry.focus();
  await retry.press('Space');
  await page.waitForFunction(() => window.messageRetries.length === 2);
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.messageRetries), ['own', 'own']);
  assert.equal(await page.getByText('Keep this failed post.', { exact: true }).count(), 1);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MessageList messages={[]} people={[]} typing={[]}/>);`);
  assert.equal(await page.getByRole('button').count(), 0);
  assert.match(await page.locator('#root').innerText(), /Start with what you need/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MessageList people={[{id:'noor',name:'Noor Ali',handle:'noor'},{id:'sam',name:'Sam Chen',handle:'sam.s'}]} currentUserId="sam" messages={[{id:'dots',authorId:'noor',time:'10:00',body:'Ask @sam.s. Keep @sam.someone and @noor.more. Unknown @guest stays plain.'}]}/>);`);
  const dotted = page.locator('p').filter({ hasText: /^Ask / });
  assert.equal(await dotted.getByText('@Sam', { exact: true }).count(), 1, 'A handle retains its internal dot and excludes sentence punctuation');
  assert.equal(await dotted.innerText(), 'Ask @Sam. Keep @sam.someone and @noor.more. Unknown @guest stays plain.');
  assert.equal(await dotted.getByText('@Noor', { exact: true }).count(), 0, 'An unknown longer handle cannot match a known prefix');
  assert.equal(await dotted.locator('xpath=../..').locator(':scope > span[aria-hidden="true"]').count(), 1);

}
