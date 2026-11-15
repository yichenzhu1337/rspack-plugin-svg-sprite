# Changesets

Every pull request that changes the published package needs a changeset: a short note that says
what changed for users and whether it is a `patch`, `minor` or `major` change.

```bash
pnpm changeset
```

Commit the generated `.changeset/*.md` file with your change. When changesets land on `main`, a
bot keeps a "chore: version packages" pull request up to date; merging it bumps the version and
writes `CHANGELOG.md`. Publishing is a separate, manual step (see `CONTRIBUTING.md`).
