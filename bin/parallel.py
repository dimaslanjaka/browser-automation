import os
import sys
import hashlib
import subprocess
import json

CACHE_FILE = os.path.join("tmp", ".rollup_cache.json")
SRC_DIR = os.path.join(os.getcwd(), "src")
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


def load_cache():
    if not os.path.exists(CACHE_FILE):
        return {}
    with open(CACHE_FILE, "r") as f:
        return json.load(f)


def save_cache(data):
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)


def run_rollup_if_needed():
    cache = load_cache()
    current_hash = calculate_checksum()

    if cache.get("hash") == current_hash:
        print("✅ No changes detected. Skipping Rollup.")
        return 0

    print("🔄 Changes detected. Running Rollup...")
    # Use 'cmd /c npx ...' for better Windows compatibility
    code = subprocess.call(["cmd", "/c", "npx", "rollup", "-c", "rollup.config.js"])

    if code == 0:
        save_cache({"hash": current_hash})

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
        subprocess.Popen(["cmd", "/c", "start"] + node_cmd)
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

    code = run_rollup_if_needed()
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

    code = run_rollup_if_needed()
    if code != 0:
        return code

    script = os.path.join(cwd, "dist", "parallel", "skrin.cjs")
    return run_node(script, args, keep_open=True)


def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    command = sys.argv[1].lower()
    args = sys.argv[2:]

    if command == "launch":
        code = launch(args)
    elif command == "skrin":
        code = skrin(args)
    elif command == "check":
        code = check(args)
    else:
        sys.exit(1)

    sys.exit(code)


if __name__ == "__main__":
    main()
