#!/bin/sh
# Scout › Open in Terminal → a new tab in the matching cmux workspace:
# "mac" for folders on this Mac, the workspace named after the host for SSH folders.
# Falls back to a new workspace when there's no such workspace.
#
# cmux only lets processes it started use its socket. Allow Scout in cmux.json:
#   "automation": { "socketControlMode": "password", "socketPassword": "…" }
# (the cmux CLI picks up the saved password), or "allowAll".

cmux=/Applications/cmux.app/Contents/Resources/bin/cmux
export CMUX_QUIET=1
name=${SCOUT_HOST:-mac}

# The workspace:N ref on the line whose title is $name.
list=$("$cmux" workspace list) || exit 1
ws=$(printf '%s\n' "$list" | awk -v name="$name" '
  { ref = ""; hit = 0
    for (i = 1; i <= NF; i++) { if ($i ~ /^workspace:[0-9]+$/) ref = $i; if ($i == name) hit = 1 }
    if (hit && ref != "") { print ref; exit } }')

if [ -z "$ws" ]; then
  if [ -n "$SCOUT_HOST" ]; then
    "$cmux" new-workspace --name "$SCOUT_HOST" --command "$SCOUT_COMMAND" --focus true
  else
    "$cmux" "$SCOUT_DIR"
  fi
elif [ -z "$SCOUT_HOST" ]; then
  "$cmux" new-surface --workspace "$ws" --working-directory "$SCOUT_DIR" --focus true &&
    "$cmux" workspace select "$ws"
else
  # An SSH workspace's tabs already run on the host, so cd once the tab is up.
  surface=$("$cmux" new-surface --workspace "$ws" --focus true | grep -o 'surface:[0-9]*' | head -n 1) &&
    "$cmux" workspace select "$ws" &&
    "$cmux" send --workspace "$ws" --surface "$surface" "cd '$(printf %s "$SCOUT_PATH" | sed "s/'/'\\\\''/g")'" &&
    "$cmux" send-key --workspace "$ws" --surface "$surface" enter
fi && open -a cmux
