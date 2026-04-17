import os
import sys
import hashlib
import subprocess
import json
import argparse

# Global variables
CWD = os.getcwd()
SRC_DIR = os.path.join(CWD, "src")
CACHE_DIR = os.path.join("tmp", "build")
EXTENSIONS = {".js", ".ts", ".mjs", ".cjs"}

# Cache file list (avoid repeated os.walk)
_SOURCE_FILES = None


def get_all_source_files():
    global _SOURCE_FILES
    if _SOURCE_FILES is not None:
        return _SOURCE_FILES

    files = []
    for root, _, filenames in os.walk(SRC_DIR):
        for f in filenames:
            if os.path.splitext(f)[1] in EXTENSIONS:
                files.append(os.path.join(root, f))

    _SOURCE_FILES = sorted(files)
    return _SOURCE_FILES


def get_files_for_bundle(entry):
    return [f for f in get_all_source_files() if entry in f]


def calculate_checksum(files):
    hasher = hashlib.sha256()

    for filepath in files:
        try:
            stat = os.stat(filepath)
            hasher.update(str(stat.st_mtime_ns).encode())
            hasher.update(str(stat.st_size).encode())
        except FileNotFoundError:
            continue

    return hasher.hexdigest()


def load_cache(cache_file):
    if not os.path.exists(cache_file):
        return {}
    try:
        with open(cache_file, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def save_cache(data, cache_file):
    os.makedirs(os.path.dirname(cache_file), exist_ok=True)
    with open(cache_file, "w") as f:
        json.dump(data, f, separators=(",", ":"))


def run_rollup_if_needed(cache_file, entry, output_file):
    cache = load_cache(cache_file)

    files = get_files_for_bundle(entry)
    current_hash = calculate_checksum(files)

    rel_cache = os.path.relpath(cache_file, CWD)
    output_exists = os.path.exists(output_file)

    if cache.get("hash") == current_hash and output_exists:
        print(f"✅ No changes detected. Skipping Rollup. [cache: {rel_cache}]")
        return 0

    if not output_exists:
        print(f"⚠️ Output missing. Forcing rebuild: {output_file}")

    print(f"🔄 Changes detected. Running Rollup... [cache: {rel_cache}]")

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

    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_CONSOLE

    subprocess.Popen(node_cmd, creationflags=creationflags)

    return 0


def check(args, keep_open=False):
    script = os.path.join(CWD, "src", "puppeteer", "parallel", "check.ts")
    return run_node(script, args, keep_open=keep_open, same_terminal=True)


COMMANDS = {
    "launch": {
        "input": "launcher.ts",
        "output": "launcher.cjs",
        "entry": "launcher",
        "cache": os.path.join(CACHE_DIR, ".rollup_cache_launcher.json"),
    },
    "skrin": {
        "input": "skrin.ts",
        "output": "skrin.cjs",
        "entry": "skrin",
        "cache": os.path.join(CACHE_DIR, ".rollup_cache_skrin.json"),
    },
    "skrin-check": {
        "input": "skrin-check-data.ts",
        "output": "skrin-check-data.cjs",
        "entry": "skrin-check-data",
        "cache": os.path.join(CACHE_DIR, ".rollup_cache_skrin_check.json"),
    },
}


def run_bundle(command, args, keep_open=False):
    cfg = COMMANDS[command]

    os.environ["BUNDLE_INPUT"] = os.path.join(
        CWD, "src", "puppeteer", "parallel", cfg["input"]
    )
    os.environ["BUNDLE_OUTPUT"] = os.path.join(CWD, "dist", "parallel", cfg["output"])

    script = os.path.join(CWD, "dist", "parallel", cfg["output"])

    code = run_rollup_if_needed(cfg["cache"], cfg["entry"], script)
    if code != 0:
        return code

    return run_node(script, args, keep_open=keep_open)


def main():
    parser = argparse.ArgumentParser(
        description="Parallel script runner for browser-automation project.\n\n"
        "Usage: parallel.py <command> [args...] [-k|--keep-open]"
    )

    parser.add_argument(
        "command",
        choices=["launch", "skrin", "check", "skrin-check"],
        help="Command to run",
    )

    parser.add_argument(
        "args",
        nargs=argparse.REMAINDER,
        help="Arguments to forward to the JS/TS script",
    )

    parser.add_argument(
        "-k",
        "--keep-open",
        action="store_true",
        help="Keep the terminal open after running the script",
    )

    if "-h" in sys.argv or "--help" in sys.argv:
        parser.print_help()
        print("\n\nForwarding help to the selected command's script...\n\n")

        if len(sys.argv) > 1:
            cmd = sys.argv[1]

            if cmd in COMMANDS or cmd == "check":
                args = [a for a in sys.argv[2:] if a not in ["-h", "--help"]]
                args.append("--help")

                if cmd == "check":
                    script = os.path.join(
                        CWD, "src", "puppeteer", "parallel", "check.ts"
                    )
                else:
                    script = os.path.join(
                        CWD, "dist", "parallel", COMMANDS[cmd]["output"]
                    )

                run_node(script, args, same_terminal=True)

        sys.exit(0)

    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    parsed = parser.parse_args()
    command = parsed.command
    args = parsed.args or []
    keep_open = parsed.keep_open

    if command == "check":
        code = check(args, keep_open=keep_open)
    else:
        code = run_bundle(command, args, keep_open=keep_open)

    sys.exit(code)


if __name__ == "__main__":
    main()
