@echo off
setlocal enabledelayedexpansion

set /p USERNAME=Please enter your USERNAME: 
set /p GITHUB_TOKEN=Please enter your GITHUB_TOKEN: 
set /p REPO_OWNER=Please enter your REPO_OWNER: 
set /p REPO_NAME=Please enter your REPO_NAME: 
set /p REPOSITORY=Please enter your REPOSITORY: 
set /p DELETE_PASSWORD=Please enter your DELETE_PASSWORD: 

set HEX_TOKEN=
for /L %%i in (0,1,255) do (
    set "char=!GITHUB_TOKEN:~%%i,1!"
    if defined char (
        for /F "tokens=*" %%a in ('powershell -Command "[System.Convert]::ToString([System.Convert]::ToByte([char]'!char!'), 16).PadLeft(2, '0')"') do (
            if "!HEX_TOKEN!"=="" (
                set HEX_TOKEN=%%a
            ) else (
                set HEX_TOKEN=!HEX_TOKEN! %%a
            )
        )
    )
)

(
    echo {
    echo     "USERNAME": "%USERNAME%",
    echo     "GITHUB_TOKEN": "%HEX_TOKEN%",
    echo     "REPO_OWNER": "%REPO_OWNER%",
    echo     "REPO_NAME": "%REPO_NAME%",
    echo     "REPOSITORY": "%REPOSITORY%",
    echo     "DELETE_PASSWORD": "%DELETE_PASSWORD%"
    echo }
) > config.json

echo Files are being packaged...
@echo off
pyinstaller --onefile --noconsole --add-data "index.html;." --add-data "help.html;." --add-data "download.html;." --add-data "contact.html;." --add-data "script.js;." --add-data "styles.css;." --add-data "xiangyingshi.css;." --add-data "config.json;." --icon=Cloud-icon.ico Cloud-Disk.py
echo Packaging completed. The program will now close.