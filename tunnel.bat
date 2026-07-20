@echo off
echo Starting SSH tunnel to production DB (localhost:5432 -> server:5432)
echo Press Ctrl+C to stop.
ssh -L 15432:localhost:5432 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 info@157.245.207.55 -N
