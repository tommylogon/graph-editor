@echo off
echo Starting local server for Graph Editor...
:: Open the browser to the local server address
start "" "http://localhost:8000"
:: Start the Python HTTP server on port 8000
py -m http.server 8000
