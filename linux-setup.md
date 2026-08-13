# Linux machine setup (Ubuntu)

Instructions for an agent. Run these from the local Mac, inside this dotfiles repo. The human will give the SSH target, usually:

```
ssh user@somemachine.com
```

Use that exact host/user (and any extra SSH flags they provide) for every remote command. Do not invent a host. Do not copy this repo over SSH or rsync it — clone it on the remote from the public HTTPS URL.

Target OS: Ubuntu.

## Goal

On the remote Ubuntu machine:

1. Install `git` if missing.
2. Clone this repo to `~/.config/dotfiles`.
3. Install `zsh` and the plugins this repo's `.zshrc` loads, then make `zsh` the login shell.
4. Make the remote `~/.zshrc` source this project's `zsh/.zshrc`.
5. Apply the same git identity/aliases as `gitinstall`, reading the email from the local Mac.

## Do this on the Mac first

Read the git email from the local machine. Do not hardcode an email into commands, files, or chat.

```sh
GIT_EMAIL="$(git config --global user.email)"
test -n "$GIT_EMAIL"
```

If that is empty, stop and ask the human. The name is `Matej Ukmar` (from `gitinstall`).

Keep `GIT_EMAIL` in the local shell and pass it into remote commands. Quote it so the address cannot break the remote shell.

## Remote command style

Prefer non-interactive SSH one-liners:

```sh
ssh user@host 'command'
```

Use `sudo` for `apt` and for changing the login shell if needed. If `sudo` asks for a password and you cannot provide one non-interactively, stop and tell the human.

Use `DEBIAN_FRONTEND=noninteractive` for apt.

## 1. Confirm the remote is Ubuntu and install packages

```sh
ssh user@host 'set -e
. /etc/os-release
echo "$ID $VERSION_ID"
command -v git || true
command -v zsh || true
sudo DEBIAN_FRONTEND=noninteractive apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git zsh zsh-autosuggestions zsh-syntax-highlighting
'
```

Do not run `zsh/zsh_install.sh` on Linux. That script is Homebrew-only.

Plugins this `.zshrc` expects, and the Ubuntu packages that provide them:

| Plugin in `zsh/.zshrc` | Ubuntu package | Path `.zshrc` already checks |
| --- | --- | --- |
| zsh-autosuggestions | `zsh-autosuggestions` | `/usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh` |
| zsh-syntax-highlighting | `zsh-syntax-highlighting` | `/usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh` |

After install, those two files must exist.

## 2. Clone the repo to `~/.config/dotfiles`

Clone path must be `$HOME/.config/dotfiles`. `zsh/.zshrc` adds `$HOME/.config/dotfiles/bin` and `$HOME/.config/dotfiles/scripts/bin` to `PATH`.

Public clone URL (not the SSH remote):

```
https://github.com/matej-io/dotfiles.git
```

```sh
ssh user@host 'set -e
mkdir -p "$HOME/.config"
if [ -d "$HOME/.config/dotfiles/.git" ]; then
  git -C "$HOME/.config/dotfiles" remote -v
  git -C "$HOME/.config/dotfiles" pull --ff-only
elif [ -e "$HOME/.config/dotfiles" ]; then
  echo "REFUSING: ~/.config/dotfiles exists and is not a git repo" >&2
  exit 1
else
  git clone https://github.com/matej-io/dotfiles.git "$HOME/.config/dotfiles"
fi
'
```

If the directory already exists and is not this repo, stop. Do not delete it.

## 3. Wire `~/.zshrc` — skip `zsh/.zshenv`

On the Mac, `~/.zshrc` is:

```sh
source ~/.config/dotfiles/zsh/.zshrc
```

Do the same on Ubuntu. Create `~/.zshrc` if missing. If it already exists, append that source line only when it is not already present. Do not overwrite an existing `~/.zshrc`.

```sh
ssh user@host 'set -e
line="source ~/.config/dotfiles/zsh/.zshrc"
touch "$HOME/.zshrc"
grep -Fqx "$line" "$HOME/.zshrc" || printf "\n%s\n" "$line" >> "$HOME/.zshrc"
'
```

**Do not copy or source `zsh/.zshenv` on Linux.** That file is macOS-only: Homebrew paths and `PNPM_HOME=/Users/matej/Library/pnpm`. The remote `~/.zshenv` should be left alone. `zsh/.zshrc` already gates macOS paths with `[[ "$OSTYPE" == darwin* ]]` and already looks for the Ubuntu plugin paths.

## 4. Make zsh the default shell

```sh
ssh user@host 'set -e
zsh_path="$(command -v zsh)"
grep -qxF "$zsh_path" /etc/shells || echo "$zsh_path" | sudo tee -a /etc/shells >/dev/null
if [ "$(getent passwd "$USER" | cut -d: -f7)" != "$zsh_path" ]; then
  sudo chsh -s "$zsh_path" "$USER"
fi
getent passwd "$USER" | cut -d: -f7
'
```

The current SSH session will stay on the old shell. That is expected. New logins should start zsh.

## 5. Git identity and aliases (from `gitinstall`)

Run this from the Mac so `$GIT_EMAIL` is the local value, not a hardcoded address:

```sh
ssh user@host "git config --global user.email $(printf %q "$GIT_EMAIL")
git config --global user.name 'Matej Ukmar'
git config --global alias.co checkout
git config --global alias.l \"!git for-each-ref --sort=-committerdate refs/remotes/ --format='%(refname:short)' | grep -v 'HEAD' | head -n 10\"
"
```

Do not run the interactive `gitinstall` script on the remote.

## 6. Verify

```sh
ssh user@host 'set -e
echo "shell=$(getent passwd "$USER" | cut -d: -f7)"
test -f /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh
test -f /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
test -d "$HOME/.config/dotfiles/.git"
grep -Fqx "source ~/.config/dotfiles/zsh/.zshrc" "$HOME/.zshrc"
test ! -f "$HOME/.zshenv" || echo "NOTE: ~/.zshenv exists (left untouched)"
git config --global --get user.email
git config --global --get user.name
git config --global --get alias.co
zsh -ic "command -v zsh; echo PATH_OK; alias l"
'
```

`zsh -ic` should load the sourced config without errors. `alias l` should resolve (`ls -al`). If plugin files are missing, zsh should still start — `.zshrc` sources them only when present — but treat missing plugin packages as a failed setup.

## Done when

- Remote login shell is zsh.
- `~/.config/dotfiles` is a clone of `https://github.com/matej-io/dotfiles.git`.
- `~/.zshrc` sources `~/.config/dotfiles/zsh/.zshrc`.
- `zsh/.zshenv` was not installed.
- `git` `user.name` is `Matej Ukmar` and `user.email` matches the Mac.
- Aliases `co` and `l` are set globally.
- Ubuntu packages `zsh-autosuggestions` and `zsh-syntax-highlighting` are installed.
