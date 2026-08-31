#!/usr/bin/env bash
set -e

mkdir -p android/app

if [ -f android/app/google-services.json ]; then
  echo "✅ Found android/app/google-services.json"
elif [ -f google-services.json ]; then
  echo "📋 Copying root google-services.json to android/app/google-services.json"
  cp google-services.json android/app/google-services.json
fi

# Ensure both locations have it
if [ -f android/app/google-services.json ] && [ ! -f google-services.json ]; then
  cp android/app/google-services.json ./google-services.json
fi

ls -la android/app/google-services.json
