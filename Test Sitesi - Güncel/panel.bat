@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Sunucu Yönetim Paneli v3.6
color 0a
mode con cols=90 lines=35

set "logFile=server_log.txt"
set "pluginFolder=plugins"
set "serverFile=server.js"

:: Başlangıç noktası
goto menu

:: ============================================
:: CMD MESAJ FONKSİYONU
:: ============================================
:popup
set "msg=%~1"
if "%msg%"=="" set "msg=Bilgi"
echo.
echo *** !msg! ***
echo.
pause
goto :eof

:: ============================================
:: ANİMASYONLU LOGO
:: ============================================
:logo
cls
set "logo= S U N U C U   Y Ö N E T İ M   P A N E L İ   v3.6"
for /l %%i in (1,1,70) do (
    cls
    echo.
    echo !logo:~0,%%i!
    ping -n 1 127.0.0.1 >nul
)
timeout /t 1 >nul
goto :eof

:: ============================================
:: ANA MENÜ
:: ============================================
:menu
cls
call :logo
call :updateTitle
echo =====================================================
echo                   SUNUCU YÖNETİM PANELİ
echo =====================================================
echo Saat: %time%
echo Log: %logFile%
echo Eklenti Klasörü: %pluginFolder%
echo Sunucu Dosyası: %serverFile%
echo -----------------------------------------------------
echo [1] Modülleri kontrol et ve indir
echo [2] Sunucuyu başlat
echo [3] Watchdog (çökünce oto başlat)
echo [4] Logları görüntüle
echo [5] Logları temizle
echo [6] CPU/RAM monitör
echo [7] Otomatik güncelleme kontrolü
echo [8] Yüklü eklentileri listele
echo [9] Çıkış
echo.
set /p secim="Seçiminiz [1-9]: "

if "%secim%"=="1" goto sec1
if "%secim%"=="2" goto sec2
if "%secim%"=="3" goto sec3
if "%secim%"=="4" goto sec4
if "%secim%"=="5" goto sec5
if "%secim%"=="6" goto sec6
if "%secim%"=="7" goto sec7
if "%secim%"=="8" goto sec8
if "%secim%"=="9" goto sec9

echo Hatalı seçim!
pause
goto menu

:: ============================================
:: 1 — MODÜL KONTROL / İNDİRME
:: ============================================
:sec1
cls
echo Modüller kontrol ediliyor...
call :loading "Kontrol"

if exist node_modules (
    call :popup "Modüller zaten kurulu!"
) else (
    call :loading "Modüller indiriliyor..."
    npm install >> "%logFile%" 2>&1
    call :popup "Modüller başarıyla indirildi!"
)
goto menu

:: ============================================
:: 2 — NORMAL SUNUCU BAŞLATMA
:: ============================================
:sec2
cls
call :popup "Sunucu başlatılıyor..."
echo [%date% %time%] Sunucu başlatıldı >> "%logFile%"

node "%serverFile%"
call :popup "Sunucu kapandı veya hata oluştu."
goto menu

:: ============================================
:: 3 — WATCHDOG MODU
:: ============================================
:sec3
cls
call :popup "Watchdog başlatıldı! Sunucu çökerse tekrar başlatılacak."
timeout /t 2 >nul

:watchdog
node "%serverFile%" >> "%logFile%" 2>&1

echo [%date% %time%] Sunucu çöktü! >> "%logFile%"
call :popup "Sunucu çöktü! Yeniden başlatılıyor..."
timeout /t 3 >nul
goto watchdog

:: ============================================
:: 4 — LOG DOSYASI GÖSTER
:: ============================================
:sec4
cls
if not exist "%logFile%" (
    call :popup "Log dosyası yok."
) else (
    echo ---------------- LOG ----------------
    type "%logFile%"
    echo.
    pause
)
goto menu

:: ============================================
:: 5 — LOG TEMİZLE
:: ============================================
:sec5
echo. > "%logFile%"
call :popup "Log dosyası temizlendi!"
goto menu

:: ============================================
:: 6 — CPU / RAM MONİTÖR (PowerShell ile)
:: ============================================
:sec6
cls
echo Gerçek zamanlı CPU/RAM izleniyor.
echo Çıkmak için CTRL + C
echo.

:monitor
for /f %%i in ('powershell -command "(Get-CimInstance Win32_Processor).LoadPercentage"') do set CPU=%%i
for /f %%r in ('powershell -command "$mem=Get-CimInstance Win32_OperatingSystem; [int]((($mem.TotalVisibleMemorySize-$mem.FreePhysicalMemory)*100)/$mem.TotalVisibleMemorySize)"') do set RAM=%%r

cls
echo CPU Kullanımı: %CPU%%%
echo RAM Kullanımı: %RAM%%%
timeout /t 1 >nul
goto monitor

:: ============================================
:: 7 — GÜNCELLEME KONTROLÜ
:: ============================================
:sec7
cls
call :loading "Güncelleme kontrol ediliyor..."
if exist update.bat (
    call :popup "Güncelleme bulundu! Yükleniyor..."
    call update.bat
    call :popup "Güncelleme tamamlandı!"
) else (
    call :popup "Güncelleme bulunamadı."
)
goto menu

:: ============================================
:: 8 — PLUGIN LİSTELEME
:: ============================================
:sec8
cls
echo ----- Yüklü Eklentiler -----
if not exist "%pluginFolder%" (
    call :popup "Eklenti klasörü bulunamadı!"
) else (
    dir /b "%pluginFolder%"
    echo.
    pause
)
goto menu

:: ============================================
:: 9 — ÇIKIŞ
:: ============================================
:sec9
cls
call :popup "Program kapatılıyor..."
call :loading "Kapanıyor"
echo.
echo Panel kapandı. Çıkmak için bir tuşa basın...
pause
exit /b

:: ============================================
:: ANİMASYON FONKSİYONU
:: ============================================
:loading
set "msg=%~1"
if "%msg%"=="" set "msg=Yükleniyor"
set "chars=\|/-"
for /l %%i in (1,1,25) do (
    for %%c in (!chars!) do (
        <nul set /p ".=!msg! %%c"
        ping -n 1 127.0.0.1 >nul
        <nul set /p ".="
    )
)
echo.
goto :eof

:: ============================================
:: DİNAMİK BAŞLIK (CPU/Saat) – PowerShell ile
:: ============================================
:updateTitle
for /f %%i in ('powershell -command "(Get-CimInstance Win32_Processor).LoadPercentage"') do set CPU=%%i
title CPU: %CPU%%% ^| Saat: %time%
goto :eof
