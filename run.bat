@echo off
echo ====================================================
echo Starting Protein Solubility Predictor Web Server...
echo ====================================================
cd /d "%~dp0MST-Project\protein_solubility"
python backend\server.py
pause
