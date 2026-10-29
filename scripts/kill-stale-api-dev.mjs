import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const port = Number(process.env.PORT) || 3000;
const ribatApiPath = 'apps/api/dist';

function pidsListeningOnPort(targetPort) {
  try {
    const out = execSync(`ss -tlnp 'sport = :${targetPort}'`, { encoding: 'utf8' });
    const pids = new Set();
    for (const match of out.matchAll(/pid=(\d+)/g)) {
      pids.add(Number(match[1]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

function processCmdline(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ');
  } catch {
    return '';
  }
}

for (const pid of pidsListeningOnPort(port)) {
  if (pid === process.pid) continue;
  const cmd = processCmdline(pid);
  if (!cmd.includes(ribatApiPath)) continue;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already exited.
  }
}
