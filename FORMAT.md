# Graph format v1

Open a UTF-8 JSON file via the folder icon. For a standalone build, run
`python tools/build.py --data examples/includes.json --output include-view.html`.
The viewer interprets paths as text and uses no project-specific parser for this format.

The root object has `format: "dependency-viewer"`, `version: 1`, a display
`name`, and arrays `nodes` and `edges`. See [the schema](graph.schema.json).

| Node kind | Meaning | Parent |
| --- | --- | --- |
| `project` | Top-level project, build target, or library | Omit `parent` |
| `group` | Container such as a directory or subsystem | ID of a project |
| `item` | Smallest displayed unit, such as a file or a module | ID of a group |

Each node has a unique string `id` and a display `label`. IDs are exact and
case sensitive. Each group must contain at least one item. Projects can be
empty. A flat set of files can use a single project and a single group.

Each edge has `source`, `target`, and a string `kind`. The direction is
**consumer → provider**. Thus a file containing `#include "b.hpp"` is the
source, and `b.hpp` is the target. Use `include`, `import`, or `link` where
appropriate. The viewer also accepts other edge kinds and shows them in details.
An edge connects two projects or two items. Item edges can cross groups and
projects. Self-edges are unsupported in v1. Opposite directions are allowed.
Nodes and edges can have a `sources` array of `{ "path": "...", "line": 1 }`
records. Line numbers start at 1. Include evidence only when you have it.

The JSON Schema checks object structure. The viewer also validates IDs,
parent relationships, edge endpoints, and non-empty groups.

## What the viewer shows

- The first screen shows projects and their explicitly supplied project edges.
- Opening a project shows its groups and bundled item edges between those groups.
- Opening a group shows its items and edges within the group. Boundary controls
  expose the dependencies and consumers outside the group.
- Overlapping edges with the same directed pair share a line and keep their kinds
  and evidence. The overview map bundles item edges across project boundaries.
- The cycle tool lists strongly connected groups of items. For
  [the include example](examples/includes.json), it lists `a.hpp` and `b.hpp`
  together. `main.cpp` depends on the cycle and is outside it.
- [The modules example](examples/modules.json) has a project link from App to
  Math and a separate import from App.Main to Math.Vector.
