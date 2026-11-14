"""Report files from repositories without conventional C++ targets."""

from pathlib import PurePosixPath

from .paths import normalize_path


def inventory_report(name, paths, scripts):
    """Show scripts and documentation for repositories without C/C++ targets."""
    libraries = {name: {"name": name, "type": "repository"}}
    modules = {}
    for path in paths:
        file = PurePosixPath(path)
        if path not in scripts and file.suffix.lower() not in {".md", ".rst", ".sh", ".ps1", ".py", ".yml", ".yaml"}:
            continue
        item = "file:" + path
        modules[item] = {"name": item, "label": file.name, "library": name,
                         "group": file.parts[0] if len(file.parts) > 1 else "Files",
                         "files": [{"path": path, "line": 1}]}
    imports = []
    for path, commands in scripts.items():
        for command, args, line in commands:
            if command != "include" or not args:
                continue
            value = args[0].strip('"').removeprefix("${CMAKE_CURRENT_LIST_DIR}/")
            if "$" in value:
                continue
            target = "file:" + normalize_path(PurePosixPath(path).parent, value)
            if target in modules and target != "file:" + path:
                imports.append({"library": name, "source": "file:" + path, "target": target,
                                "kind": "CMake include", "path": path, "line": line})
    return {"version": 1, "name": name, "filesScanned": 0, "libraries": libraries,
            "modules": modules, "links": [], "imports": imports, "includes": []}
