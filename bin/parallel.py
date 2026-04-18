import os
import sys
import hashlib
import subprocess
import json
import argparse

CWD = os.getcwd()
SRC_DIR = os.path.join(CWD, "src")
CACHE_DIR = os.path.join("tmp", "build")
EXTENSIONS = {".js", ".ts", ".mjs", ".cjs"}

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


def run_rollup_if_needed(cache_file, entry, output_file, same_terminal=False):
    cache = load_cache(cache_file)

    files = get_files_for_bundle(entry)
    current_hash = calculate_checksum(files)

    rel_cache = os.path.relpath(cache_file, CWD)
    output_exists = os.path.exists(output_file)

    if cache.get("hash") == current_hash and output_exists:
        print(f"✅ No changes detected. Skipping Rollup. [cache: {rel_cache}]")
        return 0

    print(f"🔄 Running Rollup... [cache: {rel_cache}]")

    cmd_str = "npx rollup -c rollup.config.js"

    if same_terminal:
        code = subprocess.call(cmd_str, shell=True)
    else:
        if os.name == "nt":
            code = subprocess.call(["cmd", "/c", cmd_str])
        else:
            code = subprocess.call(cmd_str, shell=True)

    if code == 0:
        save_cache({"hash": current_hash}, cache_file)

    return code


def run_node(script_path, args, keep_open=False, same_terminal=False):
    script_path = os.path.abspath(script_path)

    if not os.path.exists(script_path):
        print(f"❌ Script not found: {script_path}")
        return 1

    is_ts = script_path.endswith(".ts")

    node_cmd = ["node", "--no-warnings=ExperimentalWarning"]

    if is_ts:
        node_cmd += ["--loader", "ts-node/esm"]

    node_cmd += ["-r", "./.vscode/js-hook.cjs", script_path] + args

    print(f"[DEBUG] CMD: {' '.join(node_cmd)}")

    # ✅ SAME TERMINAL
    if same_terminal:
        code = subprocess.call(node_cmd)

        if keep_open:
            input("\nPress Enter to exit...")

        return code

    # ❗ NEW TERMINAL
    if os.name == "nt":
        cmd = ["cmd", "/k"] + node_cmd if keep_open else ["cmd", "/c"] + node_cmd
        subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
    else:
        subprocess.Popen(node_cmd)

    return 0


def check(args, keep_open=False, same_terminal=False):
    script = os.path.join(CWD, "src", "puppeteer", "parallel", "check.ts")
    return run_node(script, args, keep_open, same_terminal)


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


def run_bundle(command, args, keep_open=False, same_terminal=False):
    cfg = COMMANDS[command]

    os.environ["BUNDLE_INPUT"] = os.path.join(
        CWD, "src", "puppeteer", "parallel", cfg["input"]
    )
    os.environ["BUNDLE_OUTPUT"] = os.path.join(CWD, "dist", "parallel", cfg["output"])

    script = os.path.join(CWD, "dist", "parallel", cfg["output"])

    # ensure build exists
    if not os.path.exists(script):
        print(f"⚠️ Output missing: {script}")
        code = run_rollup_if_needed(
            cfg["cache"], cfg["entry"], script, same_terminal=True
        )
        if code != 0:
            return code
    else:
        code = run_rollup_if_needed(cfg["cache"], cfg["entry"], script, same_terminal)
        if code != 0:
            return code

    return run_node(script, args, keep_open, same_terminal)


def main():
    # visible/helping parser used only to print nice top-level help
    help_text = (
        "Wrapper to build and run parallel bundles (launcher, skrin, etc.).\n"
        "This script will build the requested bundle if missing and then run it with Node.\n"
    )

    epilog = (
        "Commands:\n"
        "  launch       Build & run the launcher bundle.\n"
        "  skrin        Build & run the skrin bundle.\n"
        "  skrin-check  Build & run the skrin-check-data bundle.\n"
        "  check        Run the local TypeScript check script (no bundling).\n\n"
        "Options:\n"
        "  -k, --keep-open     Keep the launched process console open after it exits.\n"
        "  -s, --same-terminal Run the process in the same terminal (blocking).\n\n"
        "Notes:\n"
        "  Any remaining arguments are forwarded to the underlying script.\n"
        "  Providing `-h` or `--help` after the command will print this top-level help\n"
        "  and still forward the help flag to the bundled script so it can print its own help.\n\n"
        "Examples:\n"
        "  python bin/parallel.py skrin -s -- -h\n"
        "  python bin/parallel.py launch -k\n"
    )

    help_parser = argparse.ArgumentParser(
        prog=os.path.basename(sys.argv[0]),
        description=help_text,
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    help_parser.add_argument(
        "command",
        choices=["launch", "skrin", "check", "skrin-check"],
        help="Which parallel command to build/run (see Commands section).",
    )
    help_parser.add_argument(
        "-k",
        "--keep-open",
        action="store_true",
        help="Keep the launched console open after exit.",
    )
    help_parser.add_argument(
        "-s",
        "--same-terminal",
        action="store_true",
        help="Run the process in the same terminal (blocking).",
    )

    # primary parser: disable automatic -h so we can forward it to the node script
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "command",
        choices=["launch", "skrin", "check", "skrin-check"],
    )
    parser.add_argument("-k", "--keep-open", action="store_true")
    parser.add_argument("-s", "--same-terminal", action="store_true")

    raw = sys.argv[1:]

    if not raw:
        help_parser.print_help()
        sys.exit(0)

    # If user asked top-level help (before any command), show it and exit
    if raw[0] in ("-h", "--help"):
        help_parser.print_help()
        sys.exit(0)

    # parse known args without argparse swallowing -h after command
    parsed, unknown = parser.parse_known_args()

    command = parsed.command
    args = unknown
    keep_open = parsed.keep_open
    same_terminal = parsed.same_terminal

    print(f"[DEBUG] same_terminal={same_terminal}, args={args}")

    # If the user requested help for the subcommand (e.g. `parallel.py skrin-check -h`),
    # print the python help first, add a blank line, and force running the
    # underlying script in the same terminal so its help prints inline.
    forward_help = "-h" in args or "--help" in args
    if forward_help:
        help_parser.print_help()
        print()
        same_terminal = True

    if command == "check":
        code = check(args, keep_open, same_terminal)
    else:
        code = run_bundle(command, args, keep_open, same_terminal)

    sys.exit(code)


if __name__ == "__main__":
    main()
