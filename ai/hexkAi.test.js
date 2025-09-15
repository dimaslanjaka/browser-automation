import { spawnAsync } from 'cross-spawn';
import path from 'upath';
import { getOrCreateSession, sendMessage } from './heckAi.js';

async function gitDiff(filePath) {
  filePath = path.toUnix(filePath);
  const stagedFiles = await spawnAsync("git", ["diff", "--name-only", "--cached"]);
  const isStaged = stagedFiles.output.split("\n").includes(filePath);
  const diffArgs = isStaged ? ["--no-pager", "diff", "--cached", filePath] : ["--no-pager", "diff", filePath];
  const diff = await spawnAsync("git", diffArgs);
  return diff.output;
}
async function gitCommitCreation() {
  const diff = await gitDiff("skrin.js");
  const session = await getOrCreateSession("commit message creation");
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
//# sourceMappingURL=hexkAi.test.js.map
//# sourceMappingURL=hexkAi.test.js.map