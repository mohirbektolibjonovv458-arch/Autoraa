@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title Avtora
cd /d "%~dp0backend"
if not exist venv (
  echo Birinchi ishga tushirish: kerakli kutubxonalar o'rnatilmoqda...
  python -m venv venv || (echo. & echo Python topilmadi. https://www.python.org/downloads/ dan o'rnating ^("Add to PATH" belgisini qo'ying^). & pause & exit /b 1)
)
call venv\Scripts\activate.bat
python -m pip install -q --upgrade pip >nul
pip install -q -r requirements.txt || (echo Kutubxonalarni o'rnatib bo'lmadi. Internetni tekshiring. & pause & exit /b 1)
python manage.py start
pause
