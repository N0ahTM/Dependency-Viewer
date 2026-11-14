# Dependency Viewer

Dependency Viewer is an interactive graph for build targets, source files and
modules. Explore dependencies in the browser, inspect source locations and
follow directed paths between items. The application runs from a single HTML
file and supports both a detailed graph and a zoomable overview.

## Try the demo

Open [index.html](index.html) from a local checkout or an extracted archive.
The default graph describes a fictional application. Use the folder button to
load another graph. [Graph format](FORMAT.md) describes the JSON contract and
links to the schema.

- Search with `Ctrl+F` (`⌘+F` on macOS) or `/`.
- Click a node to open its contents or details. Click a line to inspect the
  underlying declarations.
- Right-click a node to pin its direct connections in color. Right-click again
  to release them.
- Open **Overview** for the entire graph. Use **?** for shortcuts and settings.

## Build a report

Python 3.10 or newer is required. Use Git for scanning a Git checkout.

```sh
python tools/build.py
python tools/scan.py /path/to/checkout --html dependency-viewer-report/index.html
```

The scanner emits `dependency-viewer-report/graph.json` and the standalone
HTML report. It reads CMake and C/C++ declarations statically. See the
[GitLab guide](ci/README.md) for coverage and how to use the job per repository.
To render a JSON graph from another source, pass it with `--data` to
`tools/build.py`.

## Host the demo on GitHub Pages

Push this source tree to the `main` branch of a new repository. In
**Settings → Pages → Build and deployment**, select **GitHub Actions** as the
source. Run **Deploy demo to GitHub Pages** under **Actions**. Later pushes to
`main` refresh the site. The workflow builds only the synthetic demo.
[GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Run it on GitLab

Copy `LICENSE` and the `ci`, `src` and `tools` directories into `.dependency-viewer/` in
the checkout to scan, then add the local include shown in the
[GitLab guide](ci/README.md#local-template). The guide also covers sharing one
template across GitLab projects and serving a report through GitLab Pages.

## Source layout

The viewer entry point is `src/app/main.mjs`. The input model and graph
algorithms live under `src/data/` and `src/graph/`. Drawings and interactions
live under `src/views/`, `src/navigation/` and `src/ui/`. The static scanner
is under `tools/scanner/`.

## License

Dependency Viewer is released under the [MIT License](LICENSE).
