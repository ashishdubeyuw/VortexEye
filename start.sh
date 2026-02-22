#!/bin/bash

# Define the port
PORT=8080

echo "🌀 Starting VortexEye Backend Services..."

# 1. Handle existing process on port 8080
PID=$(lsof -t -i:$PORT)
if [ ! -z "$PID" ]; then
    echo "⚠️  Port $PORT is currently in use by PID $PID. Killing it to free the port..."
    kill -9 $PID
    sleep 1
fi

# 2. Define cleanup function to kill ngrok and server when script exits
cleanup() {
    echo -e "\n🛑 Shutting down backend services..."
    if [ ! -z "$NGROK_PID" ]; then
        kill -9 $NGROK_PID 2>/dev/null
    fi
    if [ ! -z "$PYTHON_PID" ]; then
        kill -9 $PYTHON_PID 2>/dev/null
    fi
    exit 0
}

# Trap SIGINT (Ctrl+C) and EXIT to trigger cleanup
trap cleanup SIGINT EXIT

# 3. Start ngrok in the background
echo "🌍 Starting ngrok tunnel on port $PORT..."
ngrok http https://localhost:$PORT > /dev/null &
NGROK_PID=$!

# Give ngrok a couple of seconds to initialize and register the URL
sleep 2

# 4. Start the Python server in the background so bash can wait and intercept signals
echo "🐍 Starting Python server..."
python3 server.py &
PYTHON_PID=$!

# Wait for the python server to exit or for a signal
# In bash, 'wait' waits until the process terminates before allowing traps to run.
# Running wait in a loop allows bash to catch SIGINT and execute the cleanup.
while kill -0 $PYTHON_PID 2>/dev/null; do
    wait $PYTHON_PID
done
