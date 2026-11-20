@echo off
setlocal
cd /d "%~dp0"
title IntegrityOS - Start

echo ==============================================
echo           IntegrityOS - Local Demo
echo ==============================================
echo.
echo Checking Python 3.10 or newer...
set "PYCMD="

py -3 -c "import sys; assert sys.version_info >= (3,10)" >nul 2>&1
if not errorlevel 1 set "PYCMD=py -3"

if not defined PYCMD (
    python -c "import sys; assert sys.version_info >= (3,10)" >nul 2>&1
    if not errorlevel 1 set "PYCMD=python"
)

if not defined PYCMD (
    echo.
    echo ERROR: Python 3.10+ was not found or cannot start.
    echo Install it from: https://www.python.org/downloads/windows/
    echo During install, select "Add python.exe to PATH".
    echo If Python is installed, reopen this folder after installing.
    echo On some Windows computers, disable Python app execution aliases
    echo in Settings - Apps - Advanced app settings - App execution aliases.
    echo.
    echo You can test Python manually: py --version
    pause
    exit /b 1
)

echo Found Python using: %PYCMD%
echo Starting server...
echo.
echo Open in your browser: http://127.0.0.1:8000
 echo Login: admin
 echo Password: Demo2026!
echo.
echo Keep this window OPEN while using the app.
echo Press Ctrl+C to stop the server.
echo.
%PYCMD% server.py
set "STATUS=%errorlevel%"
echo.
echo Server has stopped (exit code %STATUS%).
echo If the app did not open, please send a screenshot of this window.
pause
exit /b %STATUS%
