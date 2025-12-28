#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
sync-unstaged-changes.sh

Copy *unstaged* and *untracked* git working-tree changes from a source repo into a destination directory,
preserving relative paths. Deletions are mirrored as file deletions in destination.

This script never deletes directories (so it will not "wipe" folder contents).

Usage:
  scripts/sync-unstaged-changes.sh --source /path/to/repo --dest /path/to/other/tree [--dry-run] [--path-prefix sub/dir]

Options:
  --source        Path inside the source git working tree (repo root or any subdir)
  --dest          Destination directory root to apply changes into
  --dry-run       Print actions but do not copy/delete
  --path-prefix   Only include paths under this prefix (relative to repo root), e.g. "app/post_types"
  -h, --help      Show help

Notes:
  - Unstaged changes are computed via: git diff (working tree vs index)
  - Untracked files are computed via: git ls-files --others --exclude-standard
  - Staged changes are ignored.
EOF
}

SOURCE=""
DEST=""
DRY_RUN="0"
PATH_PREFIX=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE="${2:-}"; shift 2 ;;
    --dest)
      DEST="${2:-}"; shift 2 ;;
    --dry-run)
      DRY_RUN="1"; shift ;;
    --path-prefix)
      PATH_PREFIX="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$SOURCE" || -z "$DEST" ]]; then
  echo "Error: --source and --dest are required" >&2
  usage
  exit 2
fi

if [[ ! -d "$SOURCE" ]]; then
  echo "Error: --source is not a directory: $SOURCE" >&2
  exit 2
fi
if [[ ! -d "$DEST" ]]; then
  echo "Error: --dest is not a directory: $DEST" >&2
  exit 2
fi

SOURCE_REAL="$(realpath "$SOURCE")"
DEST_REAL="$(realpath "$DEST")"
if [[ "$SOURCE_REAL" == "$DEST_REAL" ]]; then
  echo "Error: source and dest resolve to the same directory" >&2
  exit 2
fi

REPO_ROOT="$(git -C "$SOURCE" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" || ! -d "$REPO_ROOT/.git" ]]; then
  echo "Error: --source must be inside a git working tree" >&2
  exit 2
fi
REPO_ROOT="$(realpath "$REPO_ROOT")"

log() {
  echo "$@" >&2
}

do_run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] $*"
    return 0
  fi
  "$@"
}

assert_not_dir_when_copying() {
  local dst="$1"
  if [[ -e "$dst" && -d "$dst" ]]; then
    echo "Error: destination path is a directory, expected file: $dst" >&2
    exit 3
  fi
}

copy_file() {
  local rel="$1"
  local src="$REPO_ROOT/$rel"
  local dst="$DEST_REAL/$rel"

  if [[ ! -e "$src" ]]; then
    echo "Warning: source path missing (skipping): $src" >&2
    return 0
  fi

  assert_not_dir_when_copying "$dst"
  do_run mkdir -p -- "$(dirname "$dst")"

  # Preserve permissions/timestamps; keep symlinks as symlinks.
  do_run cp -a -- "$src" "$dst"
}

delete_file() {
  local rel="$1"
  local dst="$DEST_REAL/$rel"

  # Never delete directories (safety).
  if [[ -d "$dst" && ! -L "$dst" ]]; then
    log "Skipping delete (destination is a directory): $dst"
    return 0
  fi

  if [[ -e "$dst" || -L "$dst" ]]; then
    do_run rm -f -- "$dst"
  else
    # Nothing to do.
    :
  fi
}

path_allowed() {
  local rel="$1"
  if [[ -z "$PATH_PREFIX" ]]; then
    return 0
  fi
  # Normalize prefix (strip leading ./ and leading /)
  local p="${PATH_PREFIX#./}"
  p="${p#/}"
  [[ "$rel" == "$p"* ]]
}

log "Repo root: $REPO_ROOT"
log "Dest root: $DEST_REAL"
if [[ -n "$PATH_PREFIX" ]]; then
  log "Path prefix filter: $PATH_PREFIX"
fi
if [[ "$DRY_RUN" == "1" ]]; then
  log "Mode: dry-run"
fi

# Unstaged changes only (working tree vs index), null-delimited to handle weird paths safely.
# Format:
#  - M\0path\0
#  - A\0path\0
#  - D\0path\0
#  - R100\0old\0new\0
#  - C100\0old\0new\0
DIFF_STREAM=(git -C "$REPO_ROOT" diff --name-status -z)
DIFF_QUIET=(git -C "$REPO_ROOT" diff --quiet)

# Untracked files (working tree vs index), null-delimited.
UNTRACKED_STREAM=(git -C "$REPO_ROOT" ls-files --others --exclude-standard -z)
# Check if there are any untracked files
UNTRACKED_COUNT=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard | wc -l)

if [[ -n "$PATH_PREFIX" ]]; then
  # git pathspec is relative to repo root
  DIFF_STREAM+=(-- "$PATH_PREFIX")
  DIFF_QUIET+=(-- "$PATH_PREFIX")
  UNTRACKED_STREAM+=(-- "$PATH_PREFIX")
  UNTRACKED_COUNT=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard -- "$PATH_PREFIX" | wc -l)
fi

# Fast path: no unstaged changes and no untracked files
if "${DIFF_QUIET[@]}" && [[ "$UNTRACKED_COUNT" -eq 0 ]]; then
  log "No unstaged or untracked changes found."
  exit 0
fi

log "Applying unstaged and untracked changes..."

# Read NUL-delimited entries by streaming git output (avoid storing NULs in bash vars).
while IFS= read -r -d '' status; do
  # status may include a score (e.g. R100)
  code="${status:0:1}"

  if [[ "$code" == "R" || "$code" == "C" ]]; then
    IFS= read -r -d '' old_path
    IFS= read -r -d '' new_path

    # Respect filter in addition to git's own pathspec (defensive)
    if ! path_allowed "$old_path" && ! path_allowed "$new_path"; then
      continue
    fi

    # Mirror rename/copy as "delete old, copy new" (rename) or "copy new" (copy).
    if [[ "$code" == "R" ]]; then
      log "RENAME: $old_path -> $new_path"
      delete_file "$old_path"
      copy_file "$new_path"
    else
      log "COPY: $old_path -> $new_path"
      copy_file "$new_path"
    fi
    continue
  fi

  IFS= read -r -d '' rel_path
  if ! path_allowed "$rel_path"; then
    continue
  fi

  case "$code" in
    M|A|T)
      log "COPY ($code): $rel_path"
      copy_file "$rel_path"
      ;;
    D)
      log "DELETE: $rel_path"
      delete_file "$rel_path"
      ;;
    *)
      # Unknown status (e.g. U conflicts). Skip safely.
      log "SKIP ($status): $rel_path"
      ;;
  esac
done < <("${DIFF_STREAM[@]}")

# Process untracked files
while IFS= read -r -d '' rel_path; do
  if ! path_allowed "$rel_path"; then
    continue
  fi
  log "COPY (??): $rel_path"
  copy_file "$rel_path"
done < <("${UNTRACKED_STREAM[@]}")

log "Done."


