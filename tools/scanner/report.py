"""Assemble a viewer report from one checkout."""

from pathlib import PurePosixPath

from .cmake import cmake_commands, collect_targets, target_links
from .cpp import SUFFIXES, source_text
from .inventory_report import inventory_report
from .ownership import assign_remaining_sources, source_owners
from .paths import cmake_file, inventory
from .source_graph import index_sources, read_dependencies


def scan(root, name):
    paths = inventory(root)
    scripts = {path: list(cmake_commands((root / path).read_text(encoding="utf-8-sig", errors="replace")))
               for path in paths if cmake_file(path)}
    files = {path: source_text(root / path) for path in paths if PurePosixPath(path).suffix.lower() in SUFFIXES}
    targets, aliases, declarations = collect_targets(scripts)
    owners = source_owners(scripts, declarations, targets, files)
    if not targets and not files:
        return inventory_report(name, paths, scripts)
    assign_remaining_sources(targets, owners, files, name, (root / "CMakeLists.txt").is_file())

    links = [link for path, commands in scripts.items() for link in target_links(commands, path, targets, aliases)]
    modules, items_by_file, providers, module_declarations = index_sources(files, owners)
    imports, includes = read_dependencies(files, modules, items_by_file, providers, module_declarations)
    return {"version": 1, "name": name, "filesScanned": len(files), "libraries": targets,
            "modules": modules, "links": links, "imports": imports, "includes": includes}
