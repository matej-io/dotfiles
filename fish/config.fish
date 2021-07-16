set fish_greeting "ready to roll!"

set -g fish_user_paths "/usr/local/opt/python@3.9/bin" $fish_user_paths
set -g fish_user_paths "$HOME/bin" $fish_user_paths
set -g fish_user_paths "/Applications/Daedalus Mainnet.app/Contents/MacOS" $fish_user_paths
set -g fish_user_paths "/Users/matej/Projects/Preview/depot_tools" $fish_user_paths

set -x CARDANO_NODE_SOCKET_PATH /Users/matej/Library/Application Support/Daedalus Mainnet/cardano-node.socket

abbr -a l ls -al
abbr -a s sudo systemctl
abbr -a d cd ~/.config/dotfiles
abbr -a m micro
abbr -a art cd /Users/matej/Library/Mobile\ Documents/com~apple~CloudDocs/Art
