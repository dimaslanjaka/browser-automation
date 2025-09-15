'use strict';

var crossSpawn = require('cross-spawn');
var path = require('upath');
var heckAi_js = require('./heckAi.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefault(path);

async function gitDiff(filePath) {
  filePath = path__default.default.toUnix(filePath);
  const stagedFiles = await crossSpawn.spawnAsync("git", ["diff", "--name-only", "--cached"]);
  const isStaged = stagedFiles.output.split("\n").includes(filePath);
  const diffArgs = isStaged ? ["--no-pager", "diff", "--cached", filePath] : ["--no-pager", "diff", filePath];
  const diff = await crossSpawn.spawnAsync("git", diffArgs);
  return diff.output;
}
async function gitCommitCreation() {
  const diff = await gitDiff("skrin.js");
  const session = await heckAi_js.getOrCreateSession("commit message creation");
  const _response = await heckAi_js.sendMessage(
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
//# sourceMappingURL=hexkAi.test.cjs.map
//# sourceMappingURL=hexkAi.test.cjs.map