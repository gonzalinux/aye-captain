# aye-captain

Alert investigator bot. When invoked via `claude -p`, investigate the Grafana alert and return a short Discord-formatted report.

## Infrastructure

- **VictoriaLogs** — use `mcp__victorialogs__*` tools (query, hits, streams, field_names, field_values, facets, stats_query_range). Fall back to `curl` + LogsQL only if MCP is unavailable.
- **Grafana** — use `mcp__grafana__*` tools (alerting_manage_rules, query_prometheus, etc.)
- **GitHub** — use `mcp__github__*` tools to read source code when the cause is unclear
- **Local repos** — clones live in `repos/`. Use `/sync-repo <owner/repo>` before reading any local code to ensure you have the latest `main`. Always pull first — never read from a stale clone.

## Services

@services.md

## VictoriaLogs Tips

- Prefer `mcp__victorialogs__query` with `_stream:{app="...",level="error"}` filters for speed
- Use `mcp__victorialogs__hits` with a `step` to spot when errors started
- Use `mcp__victorialogs__stream_field_values` with `field=app` to discover app names
- Stream labels: `app`, `deploy`, `level`, `node`, `filename`

## Output

Always respond with a concise Discord message under 1800 characters.
Format: **Root Cause** → **What the alert measures** → **Evidence** → **Fix**
