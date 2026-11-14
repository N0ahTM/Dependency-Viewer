"""Build a standalone HTML from the viewer's local ES modules and data."""

import argparse
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src"
IMPORT = re.compile(r"^import \{ ([^}\n]+) \} from '(\.{1,2}/[^'\n]+\.mjs)';$", re.MULTILINE)
EXPORT = re.compile(r"^export ((?:async )?function|class) (\w+)", re.MULTILINE)
STYLE_FILES = ("base", "diagram", "help", "diagram-effects", "controls", "details", "search", "motion")


def bundle(entry):
    blocks = {}

    visiting = set()

    def visit(path):
        key = path.relative_to(ROOT).as_posix()
        if key in blocks:
            return
        if key in visiting:
            raise ValueError(f"Circular module import: {key}")
        visiting.add(key)

        def bind(match):
            dependency = (path.parent / match[2]).resolve()
            visit(dependency)
            binding = dependency.relative_to(ROOT).as_posix()
            return f"const {{ {match[1]} }} = modules[{json.dumps(binding)}];"

        code = path.read_text(encoding="utf-8")
        imported_code = IMPORT.sub(bind, code)
        exports = [match[2] for match in EXPORT.finditer(imported_code)]
        code = EXPORT.sub(r"\1 \2", imported_code).strip()
        blocks[key] = f"modules[{json.dumps(key)}] = (() => {{\n{code}\nreturn {{ {', '.join(exports)} }};\n}})();"
        visiting.remove(key)

    visit(entry)
    return "const modules = Object.create(null);\n\n" + "\n\n".join(blocks.values())


def build(output, data_path):
    template = (SOURCE / "index.html").read_text(encoding="utf-8")
    css = "".join((SOURCE / "styles" / (name + ".css")).read_text(encoding="utf-8") for name in STYLE_FILES)
    data = json.loads(data_path.read_text(encoding="utf-8"))
    json_text = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")
    entry = SOURCE / "app/main.mjs"
    js = re.sub(r"</script", lambda _: r"<\/script", bundle(entry), flags=re.IGNORECASE)
    html = template.replace("<!-- styles -->", f"<style>\n{css}</style>")
    html = html.replace("<!-- data -->", f'<script id="viewer-data" type="application/json">{json_text}</script>')
    html = html.replace("<!-- script -->", f'<script type="module">\n{js}\n</script>')
    output.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "index.html")
    parser.add_argument("--data", type=Path, default=ROOT / "examples/demo.json")
    args = parser.parse_args()
    build(args.output, args.data)
