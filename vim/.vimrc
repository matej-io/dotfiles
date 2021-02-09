"Plug stuff
call plug#begin('~/.vim/plugged')
	Plug 'neoclide/coc.nvim', {'branch': 'release'}
	Plug 'morhetz/gruvbox'
	Plug 'HerringtonDarkholme/yats.vim'
	Plug 'preservim/nerdcommenter'
	Plug 'airblade/vim-gitgutter'
	Plug 'justinmk/vim-sneak'
	Plug 'unblevable/quick-scope'
call plug#end()

set termguicolors
set nocompatible
set wildmenu

set background=dark
colorscheme gruvbox

set path+=**

let g:sneak#label = 1

autocmd FileType swift setlocal equalprg=swift-format\ --configuration\ ./.swift-format noexpandtab tabstop=3 shiftwidth=0 softtabstop=0 smartindent

autocmd FileType typescript setlocal formatprg=prettier\ --parser\ typescript

nmap <space>e :CocCommand explorer<CR>

vmap ++ <plug>NERDCommenterToggle
nmap ++ <plug>NERDCommenterToggle

nnoremap ,s <esc>:set spelllang=sl \| :set spell<cr>
nnoremap ,e <esc>:set spelllang=en \| :set spell<cr>

nnoremap <silent> [oh :call gruvbox#hls_show()<CR>
nnoremap <silent> ]oh :call gruvbox#hls_hide()<CR>
nnoremap <silent> coh :call gruvbox#hls_toggle()<CR>

nnoremap * :let @/ = ""<CR>:call gruvbox#hls_show()<CR>*
nnoremap / :let @/ = ""<CR>:call gruvbox#hls_show()<CR>/
nnoremap ? :let @/ = ""<CR>:call gruvbox#hls_show()<CR>?

nmap <c-s> :update<cr>
imap <c-s> <Esc>:update<cr>gi

source ~/.config/dotfiles/vim/.xvimrc

