function fish_prompt
    echo -n (set_color blue)"$USER"(set_color white)'@'(set_color yellow)(prompt_hostname)' '

    echo -n (set_color blue)(prompt_pwd)

    set_color -o
    if test "$USER" = 'root'
        echo -n (set_color red)'# '
    end
    fish_git_prompt
#    echo -n ' '(set_color red)'❯'(set_color yellow)'❯'(set_color green)'❯ '
    echo -n ' '(set_color green)'❯ '
    set_color normal
end
