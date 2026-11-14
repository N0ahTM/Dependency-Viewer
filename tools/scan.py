"""Generate a Dependency Viewer for a CMake/C++ checkout."""

import argparse
import json
from pathlib import Path

from build import build
from scanner.paths import scan_directories
from scanner.report import scan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path, help="checkout or extracted source archive")
    parser.add_argument("--name", help="report name (defaults to the checkout directory)")
    parser.add_argument("--scan-dir", action="append", default=[], metavar="DIR",
                        help="scan only this checkout-relative directory (repeat to include more)")
    parser.add_argument("--output", type=Path, default=Path("dependency-viewer-report/graph.json"))
    parser.add_argument("--html", type=Path, help="also build a standalone HTML report")
    args = parser.parse_args()
    root = args.repo.resolve()
    if not root.is_dir():
        parser.error(f"Checkout is not a directory: {root}")
    if args.html and args.html.resolve() == args.output.resolve():
        parser.error("--output and --html must use different paths")
    try:
        directories = scan_directories(root, args.scan_dir)
    except ValueError as error:
        parser.error(str(error))
    data = scan(root, args.name or root.name, directories)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.html:
        args.html.parent.mkdir(parents=True, exist_ok=True)
        build(args.html, args.output)
    print(f'{data["name"]}: {len(data["libraries"])} targets/roots, {len(data["modules"])} modules/files, '
          f'{data["filesScanned"]} C/C++ source files')
    if not data["filesScanned"] and all(target["type"] == "repository" for target in data["libraries"].values()):
        print("No CMake targets or C/C++ sources found; using the script and documentation inventory.")


if __name__ == "__main__":
    main()
