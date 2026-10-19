import { VERSION } from './version.js';

export interface CliOpts { log?: (s: string) => void }
const log = (o: CliOpts) => o.log ?? ((s: string) => console.log(s));

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') { log(opts)(VERSION); return 0; }
  if (cmd === 'check') return 0; // wired up in Task 10
  log(opts)(`fringe: unknown command '${cmd ?? ''}' — try 'fringe check --help'`);
  return 2;
}
