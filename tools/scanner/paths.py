import os
from pathlib import Path, PurePosixPath
import posixpath
import subprocess

SKIP_DIRS = {".git", ".dependency-viewer", "build", "_build", "_deps", "node_modules", "dependency-viewer-report"}


def scan_directories(root, values):
    directories = []
    for value in values:
        directory = PurePosixPath(value.replace("\\", "/"))
        if not directory.parts or directory.is_absolute() or ".." in directory.parts or ":" in value:
            raise ValueError(f"--scan-dir requires a directory relative to the checkout: {value}")
        location = root / directory
        if not location.is_dir() or location.resolve().parts != location.parts:
            raise ValueError(f"--scan-dir must match an existing checkout directory exactly: {value}")
        directories.append(directory)
    return tuple(dict.fromkeys(directories))


def inventory(root, directories=()):
    """Use Git's tracked paths and ignore generated files in archive checkouts."""
    if (root / ".git").exists():
        pathspecs = [f":(literal){directory.as_posix()}/" for directory in directories]
        raw = subprocess.check_output(["git", "-C", str(root), "ls-files", "-z", "--", *pathspecs])
        paths = (Path(os.fsdecode(name)) for name in raw.split(b"\0") if name)
    else:
        def walk():
            for directory in directories or (PurePosixPath("."),):
                for folder, children, files in os.walk(root / directory):
                    children[:] = [name for name in children if name.lower() not in SKIP_DIRS]
                    yield from (Path(folder, name).relative_to(root) for name in files)
        paths = walk()
    allowed = [root / directory for directory in directories] or [root]
    return sorted(
        path.as_posix() for path in set(paths)
        if (file := root / path).is_file()
        and any(file.resolve().is_relative_to(directory) for directory in allowed)
        and not any(part.lower() in SKIP_DIRS for part in path.parts[:-1])
    )


def cmake_file(path):
    return PurePosixPath(path).name in {"CMakeLists.txt", "CMakeFiles.txt"} or path.endswith((".cmake", ".cmake.in"))


def normalize_path(directory, value):
    # A leading slash here represents a repository-root CMake variable.
    value = value.replace("\\", "/")
    return posixpath.normpath(value.lstrip("/") if value.startswith("/") else str(directory / value))
