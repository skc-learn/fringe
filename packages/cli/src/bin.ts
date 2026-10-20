#!/usr/bin/env node
import { runCli } from './index.js';
// Set exitCode (never process.exit) so piped stdout drains before the process ends.
process.exitCode = await runCli(process.argv.slice(2));
