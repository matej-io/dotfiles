set fish_greeting "ready to roll!"

set -g fish_user_paths "/usr/local/opt/python@3.9/bin" $fish_user_paths
set -g fish_user_paths "$HOME/bin" $fish_user_paths

fish_vi_key_bindings
for mode in insert default visual
	bind -M $mode \cf forward-char
end
bind -M insert \; forward-char
bind -M insert \cj "if commandline -P; commandline -f cancel; else; set fish_bind_mode default; commandline -f backward-char force-repaint; end"

abbr -a l ls -al
abbr -a po git push -u origin
abbr -a p git pull

