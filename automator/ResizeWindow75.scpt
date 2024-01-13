tell application "Finder"
	set screenSize to bounds of window of desktop
end tell

tell application "System Events"
	set frontApp to name of first application process whose frontmost is true
	set frontAppWindow to window 1 of application process frontApp
	
	set screenWidth to item 3 of screenSize
	set screenHeight to item 4 of screenSize
	
	set newWidth to screenWidth * 0.75
	set newHeight to screenHeight * 0.75
	set newPositionX to (screenWidth - newWidth) / 2
	set newPositionY to (screenHeight - newHeight) / 2
	
	set position of frontAppWindow to {newPositionX, newPositionY}
	set size of frontAppWindow to {newWidth, newHeight}
end tell