#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/bin:/mingw64/bin:$PATH"
# Run the official packager with all generated deletion targets checked inside outputs.
task_project="$(pwd -P)"
export task_package_root="$task_project/outputs/package-temp"
mkdir -p "$task_package_root"
export TMPDIR="$task_package_root"
mktemp() {
  local task_created task_resolved
  task_created="$(command mktemp "$@")"
  task_resolved="$(cd "$task_created" && pwd -P)"
  case "$task_resolved" in "$task_package_root"/*) printf '%s\n' "$task_resolved";; *) echo 'Unsafe temporary directory' >&2; return 1;; esac
}
rm() {
  local task_arg task_resolved
  for task_arg in "$@"; do
    case "$task_arg" in -*) continue;; esac
    task_resolved="$(cd "$task_arg" && pwd -P)"
    case "$task_resolved" in "$task_package_root"/*) ;; *) echo 'Refusing deletion outside packaging directory' >&2; return 1;; esac
  done
  command rm "$@"
}
export -f mktemp rm
exec bash "$1" "$task_project" "$task_project/outputs/gemtd-site.tar.gz"
