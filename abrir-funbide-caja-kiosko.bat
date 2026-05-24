@echo off

set "URL=http://localhost:8045/caja-kiosko"

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --no-first-run --disable-session-crashed-bubble --disable-infobars "%URL%"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --no-first-run --disable-session-crashed-bubble --disable-infobars "%URL%"
)

if errorlevel 1 (
  echo No se encontro Google Chrome.
  pause
)

exit
