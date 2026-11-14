# Dependency Viewer in GitLab CI

The scanner analyzes one checkout per run. It requires Python 3.10 or newer and
Git. Run it locally from the Dependency Viewer repository with:

```sh
python tools/scan.py /path/to/checkout --output dependency-viewer-report/graph.json --html dependency-viewer-report/index.html
```

Open the generated `index.html` directly in a browser. It includes the graph and
viewer code. You can also load `graph.json` into an existing viewer with its folder
button.

## Shared template

Store the viewer in a GitLab project. In that project, add the consumer projects
to the job token allowlist. If the viewer project is private, the accounts
starting pipelines need read access. The job uses the GitLab job token.

Add this entry to each consumer project's `.gitlab-ci.yml`. Replace the project
path, project ID and both commit SHAs with the published viewer's values. Use the
same SHA in both places.

```yaml
include:
  - project: 'your-group/dependency-viewer'
    ref: '0123456789abcdef0123456789abcdef01234567'
    file: '/ci/gitlab.yml'
    inputs:
      viewer_project_id: '12345678'
      viewer_revision: '0123456789abcdef0123456789abcdef01234567'
```

The job uses `.pre` by default. For a pipeline with no other jobs, set
`stage: test` under `inputs`. If the repository declares its own stages, you
can specify one of them. The job needs a Linux runner with Docker image support.
If the runner requires tags, set them on the `dependency-viewer` job in the
consumer project. The consumer project's `workflow.rules` govern when a pipeline
is created.

Each job artifact contains `graph.json` and `index.html` for that repository and
commit.

## Local template

Copy `LICENSE` and the `ci`, `tools` and `src` directories into `.dependency-viewer/` in the
consumer repository. For a pipeline with no other jobs, use:

```yaml
include:
  - local: '/.dependency-viewer/ci/gitlab.yml'
    inputs:
      stage: test
```

For an existing stage list, select one of its stages or omit `inputs` to use
`.pre`.

## Publish a report with GitLab Pages

If the project has no existing Pages deployment, add this override alongside
the include. Pipelines on the default branch publish the generated report.

```yaml
dependency-viewer:
  pages:
    publish: dependency-viewer-report
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
```

Find the deployed URL under **Deploy → Pages**. If the project already has a
Pages job, fetch the report artifacts in that job and copy the HTML into a
subdirectory of its existing publish directory.

Reports contain source paths and dependency metadata. For a private project,
set Pages visibility to **Only Project Members** before publishing its report.
[GitLab Pages access control](https://docs.gitlab.com/user/project/pages/pages_access_control/)

## Scanner coverage

By default, the scanner uses the entire checkout. To limit a custom CI job
to selected directories, pass one `--scan-dir` option per directory.
Use checkout-relative paths and match their spelling on the runner.

```sh
python tools/scan.py /path/to/checkout --scan-dir include --scan-dir src --scan-dir interface \
  --html dependency-viewer-report/index.html
```

The filter applies to CMake declarations and C/C++ files. References to
dependencies outside those directories can still appear as external details.

- CMake libraries, executables, named helper targets, aliases, link arguments,
  build dependencies and literal source manifests.
- C++ modules, imports, partitions and local includes. Ambiguous targets,
  external link arguments and generator expressions remain in the details.
- Package directories, scripts and documentation for repositories without a
  conventional C++ build.

The scanner reads CMake and preprocessor declarations statically and combines
declared platform branches. Dynamically generated targets and includes that
require compiler search paths may be absent.
