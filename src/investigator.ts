import path from 'path';

const PROJECT_ROOT = path.resolve(import.meta.dir, '..');
const TIMEOUT_MS = 4 * 60 * 1000;

interface Params {
  alert: string;
  threadHistory: string;
  userMessage: string;
}

export async function investigate({ alert, threadHistory, userMessage }: Params): Promise<string> {
  const prompt = buildPrompt({ alert, threadHistory, userMessage });

  const proc = Bun.spawn(
    ['claude', '-p', prompt, '--output-format', 'text', '--max-turns', '20'],
    {
      cwd: PROJECT_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );

  const killTimer = setTimeout(() => {
    proc.kill('SIGTERM');
    console.error('Investigation timed out after 4 minutes');
  }, TIMEOUT_MS);

  try {
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const errText = await new Response(proc.stderr).text();
      throw new Error(`claude exited ${exitCode}: ${errText.slice(0, 300)}`);
    }

    return output.trim() || 'Investigation complete — no output produced.';
  } finally {
    clearTimeout(killTimer);
  }
}

function buildPrompt({ alert, threadHistory, userMessage }: Params): string {
  return `You are aye-captain, an alert investigator for a production setup.
You were tagged in a Discord alert thread. Investigate and report back concisely.

## Original Alert
${alert}

## Thread History
${threadHistory || 'No previous messages.'}

## User Request
${userMessage}

## Investigation Steps
1. Look up the Grafana alert rule (alerting_manage_rules) to see what metric it measures
2. Query Prometheus via Grafana MCP for current metric values and recent trends
3. Query VictoriaLogs for relevant logs from the affected app/deploy (URL configured in the victorialogs skill)
4. If the cause is unclear, check source code via GitHub MCP

## Known Stack
- Apps: elixir-gateway, seveneat, en2feWeb, day20, gonemail, writeinone
- VictoriaLogs stream labels: app, deploy, filename, level, node
- Deploys: home, remote

## Output Format
Write a Discord message (under 1800 chars) with:
**Root Cause:** one sentence
**What the alert measures:** one sentence
**Evidence:** 2-3 bullet points from logs/metrics
**Fix:** what to do

No preamble, no "I will now...", just the report.`;
}
