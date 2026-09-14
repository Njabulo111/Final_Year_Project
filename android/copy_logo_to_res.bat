@echo off
REM Copy wifi_monitor_logo.png from project root into Android res drawable folders.
REM Run this from the android folder: copy_logo_to_res.bat

SETLOCAL ENABLEDELAYEDEXPANSION

REM Source (one level up from android folder)
SET SRC=%~dp0..\wifi_monitor_logo.png
IF NOT EXIST "%SRC%" (
  echo Source not found: %SRC%
  pause
  exit /b 1
)

SET RES_DIR=%~dp0app\src\main\res

echo Copying %SRC% into drawable folders under %RES_DIR%
for %%d in (
  drawable
  drawable-land-hdpi
  drawable-land-mdpi
  drawable-land-xhdpi
  drawable-land-xxhdpi
  drawable-land-xxxhdpi
  drawable-port-hdpi
  drawable-port-mdpi
  drawable-port-xhdpi
  drawable-port-xxhdpi
  drawable-port-xxxhdpi
  drawable-v24
) do (
  if exist "%RES_DIR%\%%d" (
    copy /y "%SRC%" "%RES_DIR%\%%d\wifi_monitor_logo.png" >nul
    echo Copied to %RES_DIR%\\%%d\wifi_monitor_logo.png
  ) else (
    echo Folder not found, skipping: %RES_DIR%\\%%d
  )
)

echo Done.
pause
ENDLOCAL
