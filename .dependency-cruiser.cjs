/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'core-imports-nothing-outward',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { pathNot: '^packages/core/' },
    },
    {
      name: 'core-no-node-builtins',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'adapters-import-only-core',
      severity: 'error',
      from: { path: '^packages/adapters/' },
      to: { path: '^packages/(web|cli)/' },
    },
    {
      name: 'adapter-folders-isolated',
      severity: 'error',
      from: { path: '^packages/adapters/src/([^/]+)/' },
      to: { path: '^packages/adapters/src/([^/]+)/', pathNot: '^packages/adapters/src/$1/' },
    },
    {
      name: 'only-cli-imports-adapters',
      severity: 'error',
      from: { path: '^packages/(core|web)/' },
      to: { path: '^packages/adapters/' },
    },
    {
      name: 'web-imports-only-types-from-core',
      severity: 'error',
      from: { path: '^packages/web/' },
      to: { path: '^packages/core/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'web-no-other-packages',
      severity: 'error',
      from: { path: '^packages/web/' },
      to: { path: '^packages/(adapters|cli)/' },
    },
    {
      name: 'chart-module-only-via-index',
      severity: 'error',
      from: { path: '^packages/web/', pathNot: '^packages/web/src/chart/' },
      to: { path: '^packages/web/src/chart/', pathNot: '^packages/web/src/chart/index\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '(^|/)(dist|coverage|node_modules)/' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'], extensions: ['.ts', '.js'] },
  },
};
