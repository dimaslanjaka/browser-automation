import { spawnAsync } from 'cross-spawn';
import path from 'upath';
import { getOrCreateSession, sendMessage } from './heckAi.js';

/**
 * Entry point to test session creation and message sending.
 */
async function _sample() {
  const session = await getOrCreateSession('hello');
  await sendMessage(session.id, 'hello', true);
}

async function gitDiff(filePath) {
  filePath = path.toUnix(filePath);

  // Check if the file is staged
  const stagedFiles = await spawnAsync('git', ['diff', '--name-only', '--cached']);
  const isStaged = stagedFiles.output.split('\n').includes(filePath);

  // Pick the right diff command
  const diffArgs = isStaged ? ['--no-pager', 'diff', '--cached', filePath] : ['--no-pager', 'diff', filePath];

  const diff = await spawnAsync('git', diffArgs);
  return diff.output;
}

async function gitCommitCreation() {
  const diff = await gitDiff('skrin.js');
  const session = await getOrCreateSession('commit message creation');
  const _response = await sendMessage(
    session.id,
    `
Create commit message for this diff:

\`\`\`
${diff}
\`\`\`
    `
  );
  console.log(_response.data.answer);
}

gitCommitCreation().catch(console.log);
