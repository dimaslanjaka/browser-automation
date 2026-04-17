import os
import sys
import hashlib
import subprocess
import json

# Global variables
SRC_DIR = os.path.join(os.getcwd(), "src")
CACHE_DIR = os.path.join("tmp", "build")
CACHE_FILE_LAUNCHER = os.path.join(CACHE_DIR, ".rollup_cache_launcher.json")
CACHE_FILE_SKRIN = os.path.join(CACHE_DIR, ".rollup_cache_skrin.json")
CACHE_FILE_SKRIN_CHECK = os.path.join(CACHE_DIR, ".rollup_cache_skrin_check.json")
EXTENSIONS = {".js", ".ts", ".mjs", ".cjs"}


def get_all_source_files():
    files = []
    for root, _, filenames in os.walk(SRC_DIR):
        for f in filenames:
            if os.path.splitext(f)[1] in EXTENSIONS:
                files.append(os.path.join(root, f))
    return sorted(files)


def calculate_checksum():
    hasher = hashlib.sha256()

    for filepath in get_all_source_files():
        try:
            with open(filepath, "rb") as f:
                while chunk := f.read(8192):
                    hasher.update(chunk)
        except FileNotFoundError:
            continue

    return hasher.hexdigest()


def load_cache(cache_file):
    if not os.path.exists(cache_file):
        return {}
    with open(cache_file, "r") as f:
        return json.load(f)


def save_cache(data, cache_file):
    os.makedirs(os.path.dirname(cache_file), exist_ok=True)
    with open(cache_file, "w") as f:
        json.dump(data, f)


def run_rollup_if_needed(cache_file):
    cache = load_cache(cache_file)
    current_hash = calculate_checksum()

    rel_cache = os.path.relpath(cache_file, os.getcwd())
    if cache.get("hash") == current_hash:
        print(f"✅ No changes detected. Skipping Rollup. [cache: {rel_cache}]")
        return 0

    print(f"🔄 Changes detected. Running Rollup... [cache: {rel_cache}]")
    # Use 'cmd /c npx ...' for better Windows compatibility
    code = subprocess.call(["cmd", "/c", "npx", "rollup", "-c", "rollup.config.js"])

    if code == 0:
        save_cache({"hash": current_hash}, cache_file)

    return code


def run_node(script_path, args, keep_open=False, same_terminal=False):
    is_ts = script_path.endswith(".ts")
    node_cmd = [
        "node",
        "--no-warnings=ExperimentalWarning",
    ]
    if is_ts:
        node_cmd += ["--loader", "ts-node/esm"]
    node_cmd += ["-r", "./.vscode/js-hook.cjs", script_path, *args]

    if same_terminal:
        return subprocess.call(node_cmd)
    else:
        # Set a custom terminal title based on script name or type
        custom_title = None
        try:
            base = os.path.basename(script_path)
            if base == "skrin-check-data.cjs":
                ps_cmd = [
                    "powershell",
                    "-Command",
                    "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'skrin-check-data.cjs' } | ForEach-Object { try { $p = $_; $t = (Get-Process -Id $p.ProcessId).MainWindowTitle } catch {}; if ($t -like 'Skrin-Check*') { $t } } | Measure-Object).Count",
                ]
                result = subprocess.run(ps_cmd, capture_output=True, text=True)
                try:
                    count = int(result.stdout.strip())
                except Exception:
                    count = 0
                custom_title = f"Skrin-Check {count + 1}"
            elif base.startswith("launcher"):
                ps_cmd = [
                    "powershell",
                    "-Command",
                    "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'launcher.cjs' } | ForEach-Object { try { $p = $_; $t = (Get-Process -Id $p.ProcessId).MainWindowTitle } catch {}; if ($t -like 'Launcher*') { $t } } | Measure-Object).Count",
                ]
                result = subprocess.run(ps_cmd, capture_output=True, text=True)
                try:
                    count = int(result.stdout.strip())
                except Exception:
                    count = 0
                custom_title = f"Launcher {count + 1}"
            elif base.startswith("skrin"):
                ps_cmd = [
                    "powershell",
                    "-Command",
                    "(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'skrin.cjs' } | ForEach-Object { try { $p = $_; $t = (Get-Process -Id $p.ProcessId).MainWindowTitle } catch {}; if ($t -like 'Skrin*') { $t } } | Measure-Object).Count",
                ]
                result = subprocess.run(ps_cmd, capture_output=True, text=True)
                try:
                    count = int(result.stdout.strip())
                except Exception:
                    count = 0
                custom_title = f"Skrin {count + 1}"
            else:
                # Use the script base name as the terminal title for other scripts
                custom_title = base
        except Exception:
            pass
        start_cmd = ["cmd", "/c", "start"]
        if custom_title:
            start_cmd.append(custom_title)
        subprocess.Popen(start_cmd + node_cmd)
        return 0


def check(args):
    cwd = os.getcwd()
    script = os.path.join(cwd, "src", "puppeteer", "parallel", "check.ts")
    return run_node(script, args, keep_open=False, same_terminal=True)


def launch(args):
    cwd = os.getcwd()

    os.environ["BUNDLE_INPUT"] = os.path.join(
        cwd, "src", "puppeteer", "parallel", "launcher.ts"
    )
    os.environ["BUNDLE_OUTPUT"] = os.path.join(cwd, "dist", "parallel", "launcher.cjs")

    code = run_rollup_if_needed(CACHE_FILE_LAUNCHER)
    if code != 0:
        return code

    script = os.path.join(cwd, "dist", "parallel", "launcher.cjs")
    return run_node(script, args, keep_open=False)


def skrin(args):
    cwd = os.getcwd()

    os.environ["BUNDLE_INPUT"] = os.path.join(
        cwd, "src", "puppeteer", "parallel", "skrin.ts"
    )
    os.environ["BUNDLE_OUTPUT"] = os.path.join(cwd, "dist", "parallel", "skrin.cjs")

    code = run_rollup_if_needed(CACHE_FILE_SKRIN)
    if code != 0:
        return code

    script = os.path.join(cwd, "dist", "parallel", "skrin.cjs")
    return run_node(script, args, keep_open=True)


def skrin_check(args):
    cwd = os.getcwd()

    os.environ["BUNDLE_INPUT"] = os.path.join(
        cwd, "src", "puppeteer", "parallel", "skrin-check-data.ts"
    )
    os.environ["BUNDLE_OUTPUT"] = os.path.join(
        cwd, "dist", "parallel", "skrin-check-data.cjs"
    )

    code = run_rollup_if_needed(CACHE_FILE_SKRIN_CHECK)
    if code != 0:
        return code

    script = os.path.join(cwd, "dist", "parallel", "skrin-check-data.cjs")
    return run_node(script, args, keep_open=True)


def main():
    def print_help():
        print("""
Usage: parallel.py <command> [args...]

Commands:
  launch         Build and run the parallel launcher
  skrin          Build and run the skrin script
  check          Run the check script
  skrin-check    Build and run the skrin-check-data script

Options:
  -h, --help     Show this help message and exit
        """.strip())

    if (
        len(sys.argv) < 2
        or sys.argv[1] in ("-h", "--help")
        or (len(sys.argv) > 2 and sys.argv[2] in ("-h", "--help"))
    ):
        print_help()
        sys.exit(0)

    command = sys.argv[1].lower()
    args = sys.argv[2:]

    if command == "launch":
        code = launch(args)
    elif command == "skrin":
        code = skrin(args)
    elif command == "check":
        code = check(args)
    elif command == "skrin-check":
        code = skrin_check(args)
    else:
        print(f"Unknown command: {command}\n")
        print_help()
        sys.exit(1)

    sys.exit(code)


if __name__ == "__main__":
    main()
