#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"

cd "${project_dir}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run this app. Please install Node.js and npm." >&2
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building the app..."
npm run build

echo "Starting the local server..."
npm run preview -- --open
