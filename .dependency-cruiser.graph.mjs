import { builtinModules } from 'node:module';
import base from './.dependency-cruiser.mjs';

export default {
  options: {
    ...base.options,
    exclude: {
      path: [
        '(^|/)(dist|coverage|node_modules|test|e2e)/',
        '\\.test\\.tsx?$',
        '\\.d\\.ts$',
        '(^|/)[^/]*\\.config\\.[cm]?[jt]s$',
        '(^|/)\\.dependency-cruiser[^/]*\\.mjs$',
        `^(node:)?(${builtinModules.join('|')})$`,
      ].join('|'),
    },
    reporterOptions: {
      dot: { collapsePattern: '^packages/adapters/src/[^/]+/|^packages/[^/]+' },
    },
  },
};
