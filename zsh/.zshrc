# common paths
export PATH="$HOME/.config/dotfiles/bin:$PATH"
export PATH="$HOME/.config/dotfiles/scripts/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.config/dotfiles/bin:$PATH"

# homebrew/macos paths
if [[ "$OSTYPE" == darwin* ]]; then
  export PATH="/opt/homebrew/bin:$PATH"
  export PATH="/opt/homebrew/opt/mysql@8.4/bin:$PATH"
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
fi

# pnpm path
if [ -z "$PNPM_HOME" ]; then
  case "$OSTYPE" in
    darwin*) PNPM_HOME="$HOME/Library/pnpm" ;;
    linux*) PNPM_HOME="$HOME/.local/share/pnpm" ;;
    *) PNPM_HOME="$HOME/.local/share/pnpm" ;;
  esac
fi
export PNPM_HOME
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

export EDITOR=nano

alias l='ls -al'
alias g="git push -u origin"
if [[ $EUID -eq 0 ]]; then
  alias s="systemctl "
  alias j="journalctl -u"
else
  alias s="sudo systemctl "
  alias j="sudo journalctl -u"
fi

# Expand aliases immediately when pressing Space.
expand-alias-on-space() {
  zle _expand_alias
  zle self-insert
}
zle -N expand-alias-on-space
bindkey ' ' expand-alias-on-space

# ---- history ----
HISTSIZE=50000
SAVEHIST=50000
HISTFILE=$HOME/.zsh_history
setopt HIST_IGNORE_DUPS
setopt SHARE_HISTORY
setopt HIST_FIND_NO_DUPS
setopt INC_APPEND_HISTORY

# ---- completion ----
autoload -Uz compinit
compinit
zmodload zsh/complist

zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list \
  'm:{a-zA-Z}={A-Za-z}' \
  'r:|[._-]=* r:|=*' \
  'l:|=* r:|=*'

zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' group-name ''
zstyle ':completion:*' squeeze-slashes true
zstyle ':completion:*' special-dirs true
zstyle ':completion:*' completer _extensions _complete _approximate
zstyle ':completion:*:approximate:*' max-errors 2 numeric

# Tab completion
bindkey '^I' menu-complete
# bindkey '^I' menu-complete


# ---- prompt ----
autoload -Uz colors && colors
autoload -Uz vcs_info
precmd() {
  local last_status=$?
  vcs_info
  if (( last_status != 0 )); then
    print -P "%F{red}%B>>> failed [$last_status]%b%f"
  fi
}

# Configure git branch display
zstyle ':vcs_info:git:*' formats ' (%b)'
zstyle ':vcs_info:*' enable git

setopt PROMPT_SUBST
PROMPT='%F{cyan}%n@%m%f %F{yellow}%1~%f%F{green}${vcs_info_msg_0_}%f %# '

# ---- autosuggestions ----
if [ -f /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]; then
  source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh
elif [ -f /usr/local/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]; then
  source /usr/local/share/zsh-autosuggestions/zsh-autosuggestions.zsh
elif [ -f /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]; then
  source /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh
fi
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'
ZSH_AUTOSUGGEST_STRATEGY=(history completion)

# ---- syntax highlighting ----
if [ -f /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
  source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
elif [ -f /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
  source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
elif [ -f /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
  source /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi
