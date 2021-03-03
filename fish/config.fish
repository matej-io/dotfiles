set fish_greeting "ready to roll!"

set -g fish_user_paths "/usr/local/opt/python@3.9/bin" $fish_user_paths
set -g fish_user_paths "$HOME/bin" $fish_user_paths

abbr -a l ls -al
abbr -a s git status
abbr -a d cd ~/.config/dotfiles
abbr -a m micro
