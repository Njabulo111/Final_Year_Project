@echo off
echo Starting Build Process...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo NPM Build Failed
    exit /b %ERRORLEVEL%
)
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo Capacitor Sync Failed
    exit /b %ERRORLEVEL%
)
cd android
call gradlew assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Gradle Build Failed
    exit /b %ERRORLEVEL%
)
copy app\build\outputs\apk\debug\app-debug.apk ..\WiFi_Monitor_REPAIRED_FINAL.apk
echo Build Successful! APK saved as WiFi_Monitor_REPAIRED_FINAL.apk
