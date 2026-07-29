"""
Git Sync Service — Auto-push database changes to GitHub.
Called every time trigger_auto_backup() runs (on every user write action + every 30 minutes).
Uses a debounce / throttle mechanism so rapid successive changes only trigger one push.
"""
import os
import subprocess
import threading
from datetime import datetime

# Absolute path to the git repository root (two levels above this file: services/ -> app/ -> backend/ -> erp/)
GIT_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)

# Throttle: only allow one git push every N seconds to avoid hammering GitHub on rapid sequential writes
_PUSH_THROTTLE_SECONDS = 60  # minimum 60 seconds between pushes
_last_push_time: float = 0.0
_push_lock = threading.Lock()
_pending_timer: threading.Timer | None = None


def _run_git(args: list[str], cwd: str) -> tuple[int, str, str]:
    """Run a git command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return 1, "", "git command timed out"
    except FileNotFoundError:
        return 1, "", "git not found in PATH"
    except Exception as e:
        return 1, "", str(e)


def _do_git_push(db_path: str):
    """Perform the actual git add + commit + push for the database file."""
    global _last_push_time

    with _push_lock:
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M")
        short_path = os.path.relpath(db_path, GIT_REPO_ROOT)

        # Stage the database file
        rc, _, err = _run_git(["add", short_path, ".gitignore"], GIT_REPO_ROOT)
        if rc != 0:
            print(f"[GitHub Sync] git add failed: {err}")
            return

        # Check if there is anything to commit
        rc, status_out, _ = _run_git(["status", "--porcelain"], GIT_REPO_ROOT)
        if not status_out.strip():
            print(f"[GitHub Sync] No changes to push.")
            return

        # Commit with a timestamped auto-message
        commit_msg = f"chore: auto-sync db [{timestamp}]"
        rc, _, err = _run_git(["commit", "-m", commit_msg], GIT_REPO_ROOT)
        if rc != 0:
            print(f"[GitHub Sync] git commit failed: {err}")
            return

        # Push to origin/main
        rc, out, err = _run_git(["push", "origin", "main"], GIT_REPO_ROOT)
        if rc == 0:
            print(f"[GitHub Sync] Successfully pushed database to GitHub at {timestamp}")
            _last_push_time = datetime.now().timestamp()
        else:
            print(f"[GitHub Sync] git push failed: {err}")


def schedule_git_push(db_path: str):
    """
    Schedule a git push after a short delay.
    Uses a debounce timer so rapid consecutive writes result in only one push.
    The push is always run in a background thread so it never blocks API responses.
    """
    global _pending_timer, _last_push_time

    import time
    now = time.time()

    # Cancel any pending debounce timer
    if _pending_timer is not None and _pending_timer.is_alive():
        _pending_timer.cancel()

    # Calculate delay: respect throttle window
    elapsed = now - _last_push_time
    delay = max(0, _PUSH_THROTTLE_SECONDS - elapsed)
    # Always wait at least 5 seconds after last write to batch rapid changes
    delay = max(delay, 5)

    def _push_task():
        try:
            _do_git_push(db_path)
        except Exception as e:
            print(f"[GitHub Sync] Unexpected error: {e}")

    _pending_timer = threading.Timer(delay, _push_task)
    _pending_timer.daemon = True  # won't block server shutdown
    _pending_timer.start()
