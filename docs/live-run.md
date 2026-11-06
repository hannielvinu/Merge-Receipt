# Verified Switch run

The workflow ran through Switch Core 0.31.0 and the bundled Mattermost bridge. The test sent commands as a local demo maintainer through the Mattermost API. Codex handled the first request. The comparison and the maintainer decision were implemented in the room worker. All three agent replies appeared in the same Mattermost thread.

| Step | Observed result |
|---|---|
| `@merge-receipt Why did the first docs-only pull request get stuck?` | Codex selected `LU-1640`. The agent posted `FILTERED_OUT`, **0 of 5** paths, and links to the changed files, pinned YAML and policy report. |
| `@merge-receipt replay LU-1638` | The agent posted `PATH_MATCHED`, **2 of 2** paths. It explained that eligibility and execution are separate. |
| `@merge-receipt hold LU-1640` | The agent posted `HOLD AND HAND OFF` and recorded the initiating maintainer as the owner of the next action. |

The transcript is a replay of a resolved GitHub incident. The agent ran live in the Switch room and no GitHub write credentials were used.

- [Reported required check and blocker](https://github.com/learn-ukrainian/learn-ukrainian.github.io/issues/1641)
- [Blocked PR](https://github.com/learn-ukrainian/learn-ukrainian.github.io/pull/1640/files)
- [Control PR](https://github.com/learn-ukrainian/learn-ukrainian.github.io/pull/1638/files)
