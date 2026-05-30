const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function getImports(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });

  const imports = [];

  traverse(ast, {
    ImportDeclaration(p) {
      imports.push(p.node.source.value);
    },

    CallExpression(p) {
      const callee = p.node.callee;

      if (callee.type === 'Identifier' && callee.name === 'require' && p.node.arguments[0]?.type === 'StringLiteral') {
        imports.push(p.node.arguments[0].value);
      }
    },

    Import(p) {
      const parent = p.parent;
      if (parent.arguments?.[0]?.type === 'StringLiteral') {
        imports.push(parent.arguments[0].value);
      }
    }
  });

  return imports;
}

function categorize(imports, filePath) {
  const result = {
    local: [],
    dependencies: [],
    builtin: []
  };

  for (const imp of imports) {
    if (imp.startsWith('.') || imp.startsWith('/')) {
      const full = path.normalize(path.resolve(path.dirname(filePath), imp));
      result.local.push(full);
    } else if (builtinModules.includes(imp) || builtinModules.includes(imp.replace(/^node:/, ''))) {
      result.builtin.push(imp);
    } else {
      result.dependencies.push(imp);
    }
  }

  return result;
}

function fileChecksum(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    const data = fs.readFileSync(file);
    return require('crypto').createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

function getImportList(filePath) {
  if (!filePath) {
    console.error('Usage: node script.js <file>');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);

  const imports = getImports(absPath);
  const result = categorize(imports, absPath);

  // For local files, add checksum
  if (Array.isArray(result.local)) {
    result.local = result.local.map((f) => ({
      path: f,
      checksum: fileChecksum(f)
    }));
  }

  return result;
}

const targetFile = process.argv[2] || path.join(process.cwd(), 'src/runner/skrin.js');
console.log(JSON.stringify(getImportList(targetFile), null, 2));
