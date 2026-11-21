#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- copied to a file named `gh`, which Node loads as CommonJS */
// Stand-in for the `gh` binary used by the GitHub adapter integration test.
// FAKE_GH_PAGES maps a cursor ("" for the first page) to the JSON response.
// FAKE_GH_FAIL makes it exit 1 with that message on stderr.
const fs = require('node:fs');

const args = process.argv.slice(2);
const field = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';

if (process.env.FAKE_GH_FAIL) {
  process.stderr.write(process.env.FAKE_GH_FAIL);
  process.exit(1);
}
fs.appendFileSync(process.env.FAKE_GH_LOG, `${field('searchQuery')}|${field('cursor')}\n`);
const response = JSON.parse(process.env.FAKE_GH_PAGES)[field('cursor')];
process.stdout.write(typeof response === 'string' ? response : JSON.stringify(response));
