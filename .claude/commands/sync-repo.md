Sync a GitHub repo to the local repos/ folder for code search.

Usage: /sync-repo <owner/repo>  (e.g. /sync-repo gonzalinux/elixir-gateway)

Steps:
1. The repos live in `repos/` under the project root.
2. If the repo folder does not exist, run: `git clone https://github.com/$ARGUMENTS repos/<repo-name>`
3. If it already exists, cd into it and run: `git fetch origin && git checkout main && git pull origin main`
4. Confirm the folder is ready and state the latest commit hash and message.
