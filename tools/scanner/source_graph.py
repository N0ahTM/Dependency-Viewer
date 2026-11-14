"""Build source nodes and resolve their declared dependencies."""

from pathlib import PurePosixPath

from .cpp import IMPORT, INCLUDE, MODULE, group_name, module_label
from .paths import normalize_path


def index_sources(files, owners):
    modules, items_by_file, providers = {}, {}, {}
    declarations = {path: MODULE.search(text) for path, text in files.items()}
    module_owners = {}
    for path, declaration in declarations.items():
        if declaration:
            module_owners.setdefault(declaration[1], set()).update(owners[path])
    for path, text in files.items():
        declaration = declarations[path]
        for library in sorted(owners[path]):
            module = declaration[1] if declaration else None
            item = (module if len(module_owners[module]) == 1 else f"{library}/{module}") if module else f"file:{library}/{path}"
            relative = PurePosixPath(path)
            group = group_name(module, library) if module else (str(relative.parent) if relative.parent.parts else "Files")
            entry = modules.setdefault(item, {
                "name": item, "label": module_label(module, library) if module else relative.name,
                "library": library, "group": group, "files": [],
            })
            entry["files"].append({"path": path, "line": text.count("\n", 0, declaration.start()) + 1 if declaration else 1})
            items_by_file.setdefault(path, {})[library] = item
            if module:
                providers.setdefault(module, {})[library] = item
    return modules, items_by_file, providers, declarations


def read_dependencies(files, modules, items_by_file, providers, module_declarations):
    suffixes = {}
    for path in files:
        parts = PurePosixPath(path).parts
        for index in range(len(parts)):
            suffixes.setdefault("/".join(parts[index:]), []).append(path)

    def header_provider(spelling, origin):
        header = spelling[1:-1].replace("\\", "/")
        if spelling.startswith('"'):
            near = normalize_path(PurePosixPath(origin).parent, header)
            if near in files:
                return items_by_file[near]
        matches = suffixes.get(header, [])
        return items_by_file[matches[0]] if len(matches) == 1 else {}

    def resolve(candidates, library, fallback):
        return candidates.get(library) or (next(iter(candidates.values())) if len(candidates) == 1 else fallback)

    imports, includes = [], []
    for path, text in files.items():
        declaration = module_declarations[path]
        for library, item in items_by_file[path].items():
            for match in IMPORT.finditer(text):
                spelling = match[2]
                if spelling.startswith(":") and declaration:
                    spelling = declaration[1].split(":", 1)[0] + spelling
                candidates = header_provider(spelling, path) if spelling.startswith(('"', '<')) else providers.get(spelling, {})
                target = resolve(candidates, library, spelling)
                if target != item:
                    imports.append({"library": library, "source": item, "target": target, "kind": "import",
                                    "reexport": bool(match[1]), "path": path, "line": text.count("\n", 0, match.start()) + 1})
            for match in INCLUDE.finditer(text):
                spelling = match[1]
                target = resolve(header_provider(spelling, path), library, spelling)
                record = {"library": library, "source": item, "target": spelling, "kind": "include",
                          "path": path, "line": text.count("\n", 0, match.start()) + 1}
                includes.append(record)
                if target != item and target in modules:
                    imports.append({**record, "target": target})
    return imports, includes
