import os
from pathlib import Path, PurePosixPath
import posixpath
import subprocess

SKIP_DIRS = {".git", ".dependency-viewer", "build", "_build", "_deps", "node_modules", "dependency-viewer-report"}


def inventory(root):
    """Use Git's tracked paths and ignore generated files in archive checkouts."""
    if (root / ".git").exists():
        raw = subprocess.check_output(["git", "-C", str(root), "ls-files", "-z"])
        paths = (Path(os.fsdecode(name)) for name in raw.split(b"\0") if name)
    else:
        def walk():
            for folder, directories, files in os.walk(root):
                directories[:] = [name for name in directories if name.lower() not in SKIP_DIRS]
                yield from (Path(folder, name).relative_to(root) for name in files)
        paths = walk()
    return sorted(
        path.as_posix() for path in paths
        if (file := root / path).is_file() and file.resolve().is_relative_to(root)
        and not any(part.lower() in SKIP_DIRS for part in path.parts[:-1])
    )


def cmake_file(path):
    return PurePosixPath(path).name in {"CMakeLists.txt", "CMakeFiles.txt"} or path.endswith((".cmake", ".cmake.in"))


def normalize_path(directory, value):
    # A leading slash here represents a repository-root CMake variable.
    value = value.replace("\\", "/")
    return posixpath.normpath(value.lstrip("/") if value.startswith("/") else str(directory / value))
