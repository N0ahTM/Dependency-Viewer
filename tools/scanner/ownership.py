from collections import defaultdict
from pathlib import PurePosixPath
import re

from .cmake import arguments
from .paths import normalize_path

def source_owners(scripts, declarations, targets, files):
    """Resolve literal sources and CMake set/list file manifests."""
    owners = defaultdict(set)
    for cmake in scripts:
        if PurePosixPath(cmake).name != "CMakeLists.txt":
            continue
        directory = PurePosixPath(cmake).parent
        variables = {
            "PROJECT_SOURCE_DIR": [""], "CMAKE_SOURCE_DIR": [""],
            "CMAKE_CURRENT_SOURCE_DIR": ["/" + str(directory)],
        }

        def expand(value):
            match = re.search(r"\$\{([^}]+)\}", value)
            if not match:
                return [] if "$" in value else [value]
            return [value[:match.start()] + entry + value[match.end():]
                    for entry in variables.get(match[1], []) if "$" not in entry]

        def consume(script, visiting):
            list_dir = PurePosixPath(script).parent
            previous_list_dir = variables.get("CMAKE_CURRENT_LIST_DIR")
            variables["CMAKE_CURRENT_LIST_DIR"] = ["/" + str(list_dir)]
            for command, tokens, _ in scripts[script]:
                args = list(arguments(tokens))
                if not args:
                    continue
                head, *tail = args
                if command == "include":
                    for value in expand(head):
                        included = normalize_path(directory, value)
                        if included in scripts and included not in visiting:
                            consume(included, visiting | {included})
                elif command == "set":
                    values = [item for value in tail for item in expand(value)]
                    variables[head] = list(dict.fromkeys([*variables.get(head, []), *values]))
                elif command == "list" and len(tail) >= 2:
                    variable, *values = tail
                    if head == "APPEND":
                        variables.setdefault(variable, []).extend(item for value in values for item in expand(value))
                    elif head == "TRANSFORM" and len(values) >= 2 and values[0] == "PREPEND":
                        prefixes = expand(values[1])
                        if prefixes:
                            variables[variable] = [prefix + item for prefix in prefixes for item in variables.get(variable, [])]
                elif command in {"target_sources", "add_library", "add_executable", "add_custom_target"} and head in targets:
                    for token in tail:
                        for value in expand(token):
                            path = normalize_path(directory, value)
                            if path in files:
                                owners[path].add(head)
            variables["CMAKE_CURRENT_LIST_DIR"] = previous_list_dir or []

        consume(cmake, {cmake})

    scoped = {}
    for path, names in declarations.items():
        folder = PurePosixPath(path).parent
        if PurePosixPath(path).name != "CMakeLists.txt":
            continue
        scoped.setdefault(folder, set()).update(names)
        if folder.parts[:1] == ("Source",):
            scoped.setdefault(PurePosixPath("Interface", *folder.parts[1:]), set()).update(names)
            scoped.setdefault(PurePosixPath("Include", *folder.parts[1:]), set()).update(names)
    for path in files.keys() - owners.keys():
        for parent in PurePosixPath(path).parents:
            names = scoped.get(parent, set())
            if names:
                if len(names) == 1:
                    owners[path] = names
                break
    return owners


def assign_remaining_sources(targets, owners, files, name, has_root_cmake):
    remaining = sorted(files.keys() - owners.keys())
    if remaining and not has_root_cmake and not any(path.startswith("Source/") for path in files):
        # Package repositories collect several independent distributions.
        by_package = {}
        for path in remaining:
            parts = PurePosixPath(path).parts
            if len(parts) > 1 and re.search(r"-\d", parts[0]):
                by_package.setdefault(parts[0], []).append(path)
        for package, members in by_package.items():
            targets.setdefault(package, {"name": package, "type": "package"})
            owners.update((path, {package}) for path in members)
        remaining = sorted(files.keys() - owners.keys())
    if remaining or not targets:
        fallback = name
        while fallback in targets:
            fallback += " (Files)"
        targets[fallback] = {"name": fallback, "type": "repository"}
        owners.update((path, {fallback}) for path in remaining)
