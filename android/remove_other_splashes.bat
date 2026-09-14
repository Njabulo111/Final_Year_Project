@echo off
REM Delete redundant splash PNGs so only the custom logo is used.
REM Run this from the android folder: remove_other_splashes.bat

SET RES_DIR=%~dp0\app\src\main\res

echo Removing splash.png files from resource folders...

setlocal enabledelayedexpansion
for %%d in (drawable drawable-land-hdpi drawable-land-mdpi drawable-land-xhdpi drawable-land-xxhdpi drawable-land-xxxhdpi drawable-port-hdpi drawable-port-mdpi drawable-port-xhdpi drawable-port-xxhdpi drawable-port-xxxhdpi) do (
    set FILEPATH=%RES_DIR%\%%d\splash.png
    if exist "!FILEPATH!" (
        echo Deleting !FILEPATH!
        del /f /q "!FILEPATH!"
    ) else (
        echo Not found: !FILEPATH!
    )
)

echo Done. Remaining splash XML uses wifi_monitor_logo as configured.
pause
