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
  const alertSnippet = alert.slice(0, 120).replace(/\n/g, ' ');
  const start = Date.now();

  console.log(`[aye-captain] Starting investigation — alert: ${alertSnippet}`);

  const proc = Bun.spawn(
    ['claude', '-p', prompt, '--output-format', 'stream-json', '--max-turns', '20'],
    {
      cwd: PROJECT_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );

  const killTimer = setTimeout(() => {
    proc.kill('SIGTERM');
    console.error('[aye-captain] Investigation timed out after 4 minutes');
  }, TIMEOUT_MS);

  // Drain stderr and surface it so startup/auth errors are visible
  const stderrChunks: Buffer[] = [];
  const stderrDone = (async () => {
    for await (const chunk of proc.stderr) {
      const buf = Buffer.from(chunk);
      stderrChunks.push(buf);
      process.stderr.write(buf);
    }
  })();

  // Parse stream-json events from stdout, logging tool calls as they happen
  let finalOutput = '';
  const stdoutDone = (async () => {
    const decoder = new TextDecoder();
    let lineBuffer = '';
    for await (const chunk of proc.stdout) {
      lineBuffer += decoder.decode(chunk, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          logEvent(event);
          if (event.type === 'result' && event.subtype === 'success') {
            finalOutput = event.result ?? '';
          }
        } catch {}
      }
    }
  })();

  try {
    await Promise.all([stdoutDone, stderrDone]);
    const exitCode = await proc.exited;
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (exitCode !== 0) {
      const errText = Buffer.concat(stderrChunks).toString().slice(0, 500);
      throw new Error(`claude exited ${exitCode}: ${errText}`);
    }

    console.log(`[aye-captain] Investigation complete in ${elapsed}s — ${finalOutput.trim().length} chars`);
    return finalOutput.trim() || 'Investigation complete — no output produced.';
  } finally {
    clearTimeout(killTimer);
  }
}

function logEvent(event: Record<string, any>) {
  if (event.type === 'assistant') {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use') {
        const input = JSON.stringify(block.input ?? {}).slice(0, 200);
        console.log(`[tool] ${block.name} ${input}`);
      }
    }
  } else if (event.type === 'result' && event.subtype !== 'success') {
    console.error(`[aye-captain] claude result: ${event.subtype} — ${event.error ?? ''}`);
  }
}

function buildPrompt({ alert, threadHistory, userMessage }: Params): string {
  return `You are aye-captain, an alert investigator for a production setup.
You were tagged in a Discord alert thread. Investigate and report back concisely.
Be friendly and start your response with "Aye aye!".

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
