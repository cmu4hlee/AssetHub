@echo off
cd "c:/Users/Administrator/Nutstore/1/Mac_Win_share/资产管理系统/资产管理vite/backend"
start "Backend" node server.js
cd "c:/Users/Administrator/Nutstore/1/Mac_Win_share/资产管理系统/资产管理vite/frontend"
start "Frontend" npm run dev
