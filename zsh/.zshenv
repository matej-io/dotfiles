# ~/.zshenv
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# pnpm
export PNPM_HOME="/Users/matej/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
