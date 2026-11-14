import re

NAME = r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*"
MODULE = re.compile(rf"(?m)^[ \t]*(?:export[ \t]+)?module\s+({NAME}(?::{NAME})?)\s*;")
IMPORT = re.compile(rf'(?m)^[ \t]*(export[ \t]+)?import\s+((?:{NAME})?:{NAME}|{NAME}|<[^>\n]+>|"[^"\n]+")\s*;')
INCLUDE = re.compile(r'(?m)^[ \t]*#[ \t]*include[ \t]+(<[^>\n]+>|"[^"\n]+")')
COMMENTS = re.compile(r'R"([^\s()\\]{0,16})\([\s\S]*?\)\1"|"(?:\\.|[^"\\])*"|/\*[\s\S]*?\*/|//[^\n]*')


SUFFIXES = {".c", ".cc", ".cpp", ".cxx", ".c++", ".h", ".hh", ".hpp", ".hxx",
            ".inl", ".ipp", ".tpp", ".ixx", ".cppm", ".cxxm", ".mpp", ".mm"}


def source_text(path):
    def blank(match):
        value = match[0]
        return re.sub(r"[^\n]", " ", value) if value.startswith(("//", "/*", 'R"')) else value

    return COMMENTS.sub(blank, path.read_text(encoding="utf-8-sig", errors="replace"))


def group_name(module, library):
    base = module.split(":", 1)[0]
    relative = module_label(base, library)
    return relative.split(".", 1)[0] if relative != base else base


def module_label(module, library):
    parts = module.split(".")
    for index, part in enumerate(parts[:-1]):
        if part == library:
            return ".".join(parts[index + 1:])
    return module
