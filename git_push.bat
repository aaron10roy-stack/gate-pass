@echo off
set GIT="C:\Program Files\Git\cmd\git.exe"
%GIT% init
%GIT% config user.email "gatepass@example.com"
%GIT% config user.name "GatePass Admin"
%GIT% add .
%GIT% commit -m "Initial commit of GatePass Pro"
%GIT% branch -M main
%GIT% remote add origin https://github.com/aaron10roy-stack/gate-pass.git
%GIT% push -u origin main
