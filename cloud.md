# cloud

Small wrapper around `rclone bisync`. Requires Python 3, a recent rclone, and an
already authenticated rclone remote (for example `icloud`). Put this repository's
`bin` directory on your `PATH`.

## Clone once

```sh
cloud clone 'icloud:ZEN+/Miranda/lah-foundation' ~/projects/lah-foundation
```

The destination must be new or empty. Omit it to create a folder named
`lah-foundation` in the current directory. Clone downloads the folder and initializes
bisync with `--resync`. It does not adopt an existing manual bisync folder.

## Sync afterward

```sh
cd ~/projects/lah-foundation
cloud sync --dry-run   # preview
cloud sync            # apply changes in both directions
```

Works from subfolders too. Each run finishes and exits; use a timer if you want
periodic syncing. Deletions propagate both ways. Keep backups and avoid editing
the same file on both devices between runs; bisync preserves conflicting versions
for manual resolution rather than merging their contents.

The local `.cloud.json` records the remote and original local path. The wrapper
excludes it (and its temporary files) from transfers. Bisync state lives under
`${XDG_STATE_HOME:-~/.local/state}/cloud`, outside the project. Don't remove this
state or move the local folder. Don't run raw bisync on this pair without the same
filters and state directory. `.cloud.json` is excluded from cloud sync, not Git;
add it to your Git ignores if the folder is also a repository.

## Authentication and recovery

```sh
rclone config reconnect icloud:
cloud sync
```

If rclone explicitly requires rebuilding its state, first inspect and back up both
sides, then run `cloud sync --resync --dry-run` followed by `cloud sync --resync`.
A resync merges the current trees, can restore previously deleted files, and uses
rclone's resync rules for differing files. Never use it for routine syncs. A failed
initial clone leaves its configuration in place; use the same recovery steps.
