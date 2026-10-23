# T3 Code server: restarts and updates

T3 runs as a per-user background service installed by T3 itself. Don't hand-write
launchd plists or systemd units for it, and don't run `npx t3@nightly start` from a
service: newer releases refuse to start under a launcher without the ownership
lock (`OlderBootServiceError`, crash loop with exit 78).

| Host | URL | Unit |
| --- | --- | --- |
| scaler (macOS) | https://code2.hilma.net | `~/Library/LaunchAgents/com.t3tools.t3code.service.plist` |
| contabo (Linux) | https://code.hilma.net (nginx → 127.0.0.1:3773) | `~/.config/systemd/user/t3code.service` |

Both run the stable channel (`t3@latest`) from `~/.t3/runtime/versions/<version>/t3`.
Logs: `~/.t3/userdata/logs/boot-service.log`.

`t3` is usually not on PATH (or is a stale global install), so use
`npx --yes t3@latest`. Always pass `--base-dir ~/.t3`.

## Everyday commands

```sh
npx --yes t3@latest service status  --base-dir ~/.t3   # installed version + health
npx --yes t3@latest service restart --base-dir ~/.t3   # restart (drops connected sessions)
npx --yes t3@latest update          --base-dir ~/.t3   # install latest stable and restart
tail -f ~/.t3/userdata/logs/boot-service.log
```

On macOS over plain `ssh scaler '…'`, prefix `PATH=/opt/homebrew/bin:$PATH`.

## When the server is down

1. `service status`. "needs an update or repair" means run
   `npx --yes t3@latest service install --base-dir ~/.t3`.
2. Read the tail of `boot-service.log`; the error usually says exactly what to run.
3. Check the unit itself:
   - macOS: `launchctl print gui/$(id -u)/com.t3tools.t3code.service | grep -E 'runs|last exit|program'`
   - Linux: `systemctl --user status t3code.service`
4. Back up state before reinstalling or switching versions:
   `cp -p ~/.t3/userdata/{state,statev2}.sqlite* ~/.t3/userdata/settings.json ~/.t3/backup-$(date +%F)/`

## Switching channels

`service install` and `update` install the version of the CLI you invoke, so the
channel is picked by the npx tag: `t3@latest` (stable), `t3@preview`, `t3@nightly`.
Moving to an older version (e.g. nightly to stable) may need `--allow-downgrade`
if the installed service is newer. Check tags with `npm view t3 dist-tags`.

## History

- 2026-10-23: both hosts moved from nightly to stable 0.1.2 via `service install`.
  scaler's old plist ran `npx t3@nightly start` directly and crash-looped on
  nightly 0.1.3. On contabo, the hand-written `t3-code.service`,
  `t3-code-daily-restart.{service,timer}` and `~/.config/t3/bootstrap.jsonl`
  (desktop bootstrap token) were retired; backups are in `~/.t3/backup-*` on each host.
- The old `bin/t3-restart` (launchctl kickstart / systemctl restart) was removed in
  favour of `t3 service restart`.
