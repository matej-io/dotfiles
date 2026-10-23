# T3 Code server

T3 runs as a background service that T3 installs and manages itself.

| Host | URL |
| --- | --- |
| scaler (macOS) | https://code2.hilma.net |
| contabo (Linux) | https://code.hilma.net (nginx → 127.0.0.1:3773) |

`t3` is `bin/t3`, which runs the version the service uses (falls back to `npx t3@latest`).

```sh
t3 service status     # version + health
t3 service restart    # restart (drops connected sessions)
t3 update             # update to latest stable and restart
t3 doctor             # diagnose and repair
tail -f ~/.t3/userdata/logs/boot-service.log
```

## If it's down

1. Run `t3 service status` and follow what it says (usually `t3 service install`).
2. Read the end of `~/.t3/userdata/logs/boot-service.log`.
3. Before reinstalling, back up `~/.t3/userdata/{state,statev2}.sqlite*`.

Don't hand-write launchd/systemd units or run `npx t3@nightly start` from one:
newer releases refuse to start under such a launcher (`OlderBootServiceError`).

## Switch channel

`npx --yes t3@<tag> service install`, where the tag is `latest` (stable), `preview`
or `nightly`. Add `--allow-downgrade` if it complains. To list tags, run
`npm view t3 dist-tags`.
