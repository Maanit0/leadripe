#!/bin/bash
npm run dev &
DEV_PID=$!
echo "Waiting for dev server to be ready..."
for i in {1..60}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "Dev server ready, pre-warming common routes..."
    sleep 2
    curl -s http://localhost:3000/handler/sign-in > /dev/null 2>&1 &
    curl -s http://localhost:3000/handler/sign-up > /dev/null 2>&1 &
    break
  fi
  sleep 1
done
wait $DEV_PID
