@echo off

npx nodemon --delay 5 --watch src --watch %1 --exec "node %*" --ext js --ignore .gitignore --ignore .vscode --ignore node_modules --ignore package-lock.json --ignore package.json --ignore README.md --ignore LICENSE
