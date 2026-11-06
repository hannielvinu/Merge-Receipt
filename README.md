# Merge Receipt

**Explain why a required check never appeared, then record who owns the next step.**

Merge Receipt is a Flip the Switch **Best Business Workflow** entry for release maintainers. A maintainer asks in a Mattermost channel why CI is waiting. Switch delivers the request to the Merge Receipt agent. Codex can route natural-language requests to a supported case, and a deterministic evaluator compares the changed files with the pinned GitHub Actions trigger. The maintainer decides what happens next in the same thread.

[Public evidence replay](https://hannielvinu.github.io/Merge-Receipt/) · [Original maintainer report](https://github.com/learn-ukrainian/learn-ukrainian.github.io/issues/1641) · [Switch quickstart](https://docs.switchagents.ai/switch-rooms/getting-started)

## Start with the evidence

The Learn Ukrainian project reported that two docs PRs hit a required pytest check that never reported. Its workflow filtered out both sets of changed files. The [maintainer's repair](https://github.com/learn-ukrainian/learn-ukrainian.github.io/pull/1643/files) moved the filtering decision inside the workflow. GitHub [documents this required-check behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

| Case | Input | Expected receipt |
|---|---|---|
| `LU-1640` | First docs-only PR | `FILTERED_OUT`, 0 of 5 paths |
| `LU-1642` | Second docs-only PR | `FILTERED_OUT`, 0 of 4 paths |
| `LU-1638` | Code-change control | `PATH_MATCHED`, 2 of 2 paths |

The archived data includes changed paths, trigger patterns, Git SHAs and a link to the reported requirement. The public replay runs the same evaluator as the agent. It presents evidence for the three historical cases. The Switch room is where the maintainer and agent act on that evidence.

## Quick start

Requires Node.js 22 or later.

```sh
git clone https://github.com/hannielvinu/Merge-Receipt.git
cd Merge-Receipt
npm ci
npm test
npm run replay -- LU-1640
npm run replay -- LU-1638 --json
```

An unknown case produces `INSUFFICIENT_EVIDENCE` and exit code 2. The CLI is useful for validating the evaluator independently of the room.

## Run in a Switch room

1. **Start Switch and Mattermost.** Use an existing authorized instance, the [Switch quickstart](https://docs.switchagents.ai/switch-rooms/getting-started), or run `bash scripts/local-switch.sh` from a Linux or WSL shell with Docker Compose, OpenSSL and curl. The script pins Switch 0.31.0 and creates credentials in the local stack directory. The first pull takes time. The local Gateway is at `http://localhost:3000`, and Mattermost is at `http://localhost:8065`. With the bundled setup, use `GATEWAY_ADMIN_EMAIL` and `GATEWAY_ADMIN_PASSWORD` for Gateway and `MATTERMOST_USER` and `MATTERMOST_USER_PASSWORD` for Mattermost from the stack's private `.env`.
2. **Register the agent as the maintainer.** Copy `.env.example` to `.env` in this project. In Switch Gateway, create a registration key under **API Keys**. Put it in `SWITCH_REGISTRATION_KEY` and run `node --env-file=.env src/register.mjs`. Save the returned ID and agent key in `SWITCH_AGENT_ID` and `SWITCH_AGENT_KEY`, then clear the registration key from the project file. Use the bridge origin in `SWITCH_URL`, normally `http://127.0.0.1:8000` for this stack. Keep both credentials private.
3. **Set up the channel.** In Gateway, create a room named `merge-receipt` on the Mattermost bridge. Add the registered agent and the mapped Mattermost user. Copy the room ID from its Gateway detail URL into `SWITCH_ROOM_ID`. Switch routes mentions based on the agent's addressing policy. The default owner-only rule is appropriate for the solo demo. For a team, explicitly allow the intended maintainers in agent settings.
4. **Start Codex and the room worker.** Install the [Codex CLI](https://developers.openai.com/codex/cli) and sign in for natural-language routing. Run `node --env-file=.env src/agent.mjs`. Wait for the connected-room message before sending a request. `CODEX_BIN` is optional if `codex` is on PATH. The exact replay command can still be used if the model is unavailable.
5. **In Mattermost, run the workflow.** Send `@merge-receipt replay LU-1640`. The agent replies in a thread with the path evidence and provenance. From the same account and thread, reply `@merge-receipt hold LU-1640`. The agent records the hold and ties ownership to the thread's initiating maintainer. Try `@merge-receipt replay LU-1638` as the control. To show Codex, ask `@merge-receipt Why did the first docs-only pull request get stuck?` The response identifies Codex routing when the model classified the request.

```text
Mattermost maintainer
  → Switch room and agent WebSocket
    → Codex intent routing (natural language)
    → pinned path evaluator (all evidence)
  ← Switch threaded diagnosis
  → maintainer hold or investigate command
  ← Switch threaded receipt
```

## Boundaries

- The evaluator models the positive `pull_request.paths` subset in these cases. Unsupported patterns, unknown cases, and file sets at the documented 300-file boundary yield insufficient evidence. A path match shows trigger eligibility only.
- The historical issue establishes the required-check source. The demo does not query current branch protection. The agent does not merge, override protection, create a PR, or need a GitHub token.
- Codex receives the bounded chat request and known case labels/counts. Only an exact allowed case ID is accepted from the model. The evidence and decision are produced by code. Avoid sharing secrets in the room.
- Pending decisions are held for up to 30 minutes in the agent process and scoped to the same sender and thread. The Switch chat stores the posted receipt. After a process restart, replay the case before recording a new decision.
- The public Pages deployment runs the evaluator with the archived fixtures. To run the complete chat workflow, start the Switch room worker on a host that can reach your Switch instance.

## Project layout

- `src/cases.json` pins the public evidence.
- `src/diagnose.mjs` is the shared evaluator.
- `src/agent.mjs`, `src/codex.mjs`, and `src/workflow.mjs` implement the Switch connection, model routing and maintainer decision.
- `web/` is the static public replay, tested and published by GitHub Actions.
- `test/` covers the real fixtures, unsupported evidence, model routing, and decision ownership.

Built by Hanniel Vinu A for Flip the Switch.
