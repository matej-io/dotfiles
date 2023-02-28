set fish_greeting "ready to roll!"

set -g fish_user_paths "/usr/local/opt/python@3.9/bin" $fish_user_paths
set -g fish_user_paths "$HOME/bin" $fish_user_paths
set -g fish_user_paths "/Users/matej/Projects/Preview/depot_tools" $fish_user_paths

abbr -a l ls -al
if test (whoami) = 'root'
    abbr -a s systemctl
else
    abbr -a s sudo systemctl
end
abbr -a d cd ~/.config/dotfiles
abbr -a m micro
abbr -a art cd /Users/matej/Library/Mobile\ Documents/com~apple~CloudDocs/Art
abbr -a g git push -u origin
abbr -a p python3

alias cpb="git branch --show-current | tr -d '\n' | pbcopy"
