# Dependency Viewer

The project is a local, framework-free browser viewer. The contract for
external data is FORMAT.md and graph.schema.json. The examples are synthetic.
Put format changes in the schema, runtime validation, docs, and examples
together. An edge is consumer to provider. Preserve the direction and provenance
through views, aggregation, and cycle handling.

- src/app/main.mjs starts the viewer and connects the dataset, views, and controls.
- src/data/ validates inputs and prepares views and search.
- src/graph/ contains layout, cycle detection, routing helpers, and pin state.
- src/navigation/ owns browser history, camera math, and wheel transitions.
- src/views/diagram/ handles SVG rendering, hit targets, and dragging.
- src/views/atlas/ handles Canvas rendering, hit testing, pointer input, and the minimap.
- src/ui/ manages menus, details, search, shortcuts, and preferences.
- src/styles/ is bundled in the order defined by tools/build.py.
- tools/scan.py is the CLI entry point for the modules in tools/scanner/.

Edit src and rebuild with `python tools/build.py`. The committed index.html is
the standalone deliverable. For a focused browser check, serve the repo with
`python -m http.server 8765 --bind 127.0.0.1`. Open the include example, verify
the two-node cycle, and inspect an edge. When editing drag behavior, check
that a wire moves before pointer release and returns on a rejected drop.
The scanner report format is separate from the interchange format.
