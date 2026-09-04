#!/bin/sh

set -u

pane_id="${HERDR_ACTIVE_PANE_ID:?No active Herdr pane}"
herdr_bin="${HERDR_BIN_PATH:-herdr}"

if ! process_info="$(
    "$herdr_bin" pane process-info --pane "$pane_id" 2>/dev/null
)"; then
    exec "$herdr_bin" pane send-keys "$pane_id" ctrl+l
fi

shell_pid="$(
    printf '%s' "$process_info" |
        jq -r '.result.process_info.shell_pid // empty'
)"

foreground_pgid="$(
    printf '%s' "$process_info" |
        jq -r '.result.process_info.foreground_process_group_id // empty'
)"

pane_tty="$(
    printf '%s' "$process_info" |
        jq -r '.result.process_info.tty // empty'
)"

# Herdr may omit `tty` on macOS. Derive it from the pane shell instead.
if [ -z "$pane_tty" ] && [ -n "$shell_pid" ]; then
    pane_tty="$(
        ps -o tty= -p "$shell_pid" 2>/dev/null |
            awk '{$1=$1; print}'
    )"

    case "$pane_tty" in
        ''|'??'|'?') pane_tty='' ;;
    esac
fi

# At an ordinary shell prompt, let the shell redraw itself normally.
if [ -n "$shell_pid" ] && [ "$foreground_pgid" = "$shell_pid" ]; then
    exec "$herdr_bin" pane send-keys "$pane_id" ctrl+l
fi

if [ -n "$pane_tty" ]; then
    case "$pane_tty" in
        /dev/*) ;;
        *) pane_tty="/dev/$pane_tty" ;;
    esac

    # Erase scrollback, erase the visible screen, and move the cursor home.
    if printf '\033[3J\033[2J\033[H' > "$pane_tty"; then
        exit 0
    fi
fi

# Do not inject Ctrl+L into a foreground process: programs such as SSH or
# journalctl can echo it visibly as ^L without clearing anything.
exit 1
