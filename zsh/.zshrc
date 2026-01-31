export PATH="/opt/homebrew/bin:$PATH"
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
export PATH="/Users/matej/Library/Python/2.7/bin:$PATH"
export PATH="/Users/matej/.config/dotfiles/bin:$PATH"
export PATH="/Users/matej/.config/dotfiles/scripts/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

if [ -f '/Users/matej/lib/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/matej/lib/google-cloud-sdk/path.zsh.inc'; fi
# bun completions
[ -s "/Users/matej/.bun/_bun" ] && source "/Users/matej/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"                                       # This loads nvm
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" # This loads nvm bash_completion

export EDITOR=nano

alias l='ls -al'
alias g="git push -u origin"
alias s="systemctl "

source /Users/matej/.config/dotfiles/zsh/secrets.sh

fish
