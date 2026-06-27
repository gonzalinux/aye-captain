# aye-captain

Discord bot that automatically investigates Grafana alerts using Claude Code. When tagged in a Discord thread, it queries VictoriaLogs, Prometheus, and your source code to explain what's wrong and why.

## How it works

```
Grafana fires alert → posts to Discord channel
     ↓
Someone starts a thread on the alert and types @aye-captain investigate
     ↓
Bot reads the thread (alert details + any prior messages)
     ↓
Runs `claude -p` with the full context as a prompt
     ↓
Claude queries VictoriaLogs, Grafana (via MCP), and GitHub (via MCP)
     ↓
Posts findings back to the Discord thread
```

The bot reacts with 🔍 while investigating, then ✅ on success or ❌ on failure.

If tagged outside a thread, it asks you to start one on the alert message first — it needs the alert as the thread starter to have context.

## Prerequisites

### On the server (Raspberry Pi or wherever the bot runs)

**1. Bun** — https://bun.sh/docs/installation
```bash
curl -fsSL https://bun.sh/install | bash
```
Requires 64-bit OS (`uname -m` should return `aarch64`).

**2. Claude Code**
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

**3. VictoriaLogs MCP** — install following the instructions at https://github.com/victoriametrics/mcp-victorialogs, then add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "victorialogs": {
      "command": "mcp-victorialogs",
      "env": {
        "VL_INSTANCE_ENTRYPOINT": "http://localhost:3100"
      }
    }
  }
}
```

**4. Grafana MCP** — add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "grafana": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-grafana"],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_API_KEY": "your_grafana_api_key"
      }
    }
  }
}
```

**5. GitHub MCP** — add to `~/.claude/settings.json` alongside Grafana:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_pat"
      }
    }
  }
}
```
Token needs `repo` scope (read access to private repos).

### Discord bot

1. Go to https://discord.com/developers/applications and create a new application
2. Under **Bot**, create a bot and copy the token
3. Enable the **Message Content** privileged intent (required to read messages)
4. Generate an invite URL under **OAuth2 → URL Generator** with scopes `bot` and permissions:
   - Read Messages / View Channels
   - Send Messages
   - Read Message History
   - Add Reactions
   - Create Public Threads
5. Invite the bot to your server

## Setup

```bash
git clone https://github.com/gonzalinux/aye-captain.git
cd aye-captain
cp .env.example .env
nano .env                              # paste your Discord bot token
cp services.example.md services.md
nano services.md                       # fill in your apps, repos, and deploy labels
bun install
bun run start
```

**Option A — tmux** (simple):
```bash
tmux new-session -d -s aye-captain 'bun run start'
# reattach to check logs
tmux attach -t aye-captain
```

**Option B — systemd** (runs on boot):

Create `/etc/systemd/system/aye-captain.service`, replacing `YOUR_USER` and `YOUR_PATH` with your actual user and install path:

```ini
[Unit]
Description=aye-captain Discord bot
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=YOUR_PATH/aye-captain
EnvironmentFile=YOUR_PATH/aye-captain/.env
ExecStart=YOUR_PATH/.bun/bin/bun run index.ts
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable aye-captain
sudo systemctl start aye-captain
```

## Usage

1. Grafana posts an alert to your Discord alerts channel
2. Start a thread on that alert message
3. In the thread, type `@aye-captain investigate` (or ask anything — it has the alert context)
4. Wait ~30–60 seconds for the investigation report
5. You can tag it again after a fix to confirm: `@aye-captain is this resolved?`

## Project structure

```
aye-captain/
├── .claude/
│   └── settings.json      # permissions for the headless claude -p instance
├── src/
│   └── investigator.ts    # runs claude -p, handles timeout
├── index.ts               # Discord bot
├── CLAUDE.md              # context Claude sees on every invocation
├── services.example.md    # template — copy to services.md and fill in your apps
└── .env.example
```
