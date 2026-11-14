import re
from pathlib import PurePosixPath

CMAKE_TOKEN = re.compile(
    r'#\[(=*)\[[\s\S]*?\]\1\]|#[^\n]*|\[(=*)\[[\s\S]*?\]\2\]'
    r'|(?:[^\s()#"]|"(?:\\.|[^"\\])*")+|\(|\)'
)
TARGET = re.compile(r"[\w.+-]+(?:::[\w.+-]+)*", re.ASCII)


def cmake_commands(text):
    """Read commands and argument spellings while retaining source line numbers."""
    tokens = [match for match in CMAKE_TOKEN.finditer(text) if not match[0].startswith("#")]
    index = 0
    while index + 1 < len(tokens):
        command, opening = tokens[index:index + 2]
        index += 1
        if opening[0] != "(":
            continue
        index += 1
        depth, args = 1, []
        while index < len(tokens):
            token = tokens[index][0]
            index += 1
            depth += (token == "(") - (token == ")")
            if depth == 0:
                break
            args.append(token)
        yield command[0].lower(), args, text.count("\n", 0, command.start()) + 1


def target_links(commands, path, libraries, aliases):
    conditions = []
    for command, args, line in commands:
        if command == "if":
            conditions.append(["if (" + " ".join(args) + ")"])
        elif command in ("elseif", "else") and conditions:
            conditions[-1].append(command + (" (" + " ".join(args) + ")" if args else ""))
        elif command == "endif" and conditions:
            conditions.pop()
        elif command in {"target_link_libraries", "add_dependencies"} and args and args[0] in libraries:
            scope = ""
            qualifier = ""
            for target in arguments(args[1:]):
                if target in {"PUBLIC", "PRIVATE", "INTERFACE", "LINK_PUBLIC", "LINK_PRIVATE", "LINK_INTERFACE_LIBRARIES"}:
                    scope = target
                    continue
                if target in {"debug", "optimized", "general"}:
                    qualifier = target
                    continue
                dependency = aliases.get(target, target)
                if dependency == args[0]:
                    continue
                yield {
                    "source": args[0], "target": dependency,
                    "expression": "$" in target, "scope": scope or command,
                    "conditions": [" / ".join(branch) for branch in conditions] + ([qualifier] if qualifier else []),
                    "path": path, "line": line,
                }
                qualifier = ""


def arguments(tokens):
    for token in tokens:
        value = token.strip('"')
        if "$<" in value:
            yield value
        else:
            yield from filter(None, value.split(";"))


def collect_targets(scripts):
    targets, aliases, declarations = {}, {}, {}
    for path, commands in scripts.items():
        for command, tokens, line in commands:
            args = list(arguments(tokens))
            if command not in {"add_library", "add_executable", "add_custom_target"} or not args:
                continue
            name, *values = args
            if not TARGET.fullmatch(name):
                continue
            if values[:1] == ["ALIAS"] and len(values) == 2:
                aliases[name] = values[1]
                continue
            kind = next((value for value in values if value in {
                "STATIC", "SHARED", "MODULE", "OBJECT", "INTERFACE", "IMPORTED", "UNKNOWN",
            }), command.removeprefix("add_"))
            targets.setdefault(name, {"name": name, "type": kind, "path": path, "line": line})
            declarations.setdefault(path, set()).add(name)
    return targets, aliases, declarations
