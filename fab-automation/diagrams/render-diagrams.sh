#!/usr/bin/env bash
# render-diagrams.sh - render this directory's PlantUML sources to PNG + SVG.
# Pattern: LtCol Forge's scripts/render_diagrams.sh in
# yukon-systems/StorOps_RAG-Vector-Pipelined-Processor (GitLab), adapted to
# this branch's flat diagrams/ layout. PlantUML does layout via Graphviz
# (dot must be on PATH); if no PlantUML is available the Forge original
# falls back to rendering diagrams/dot/*.dot with Graphviz directly.
set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "${dir}/png" "${dir}/svg"

# uml-palette.puml is a skinparam include, not a diagram - exclude it.
sources=()
for f in "${dir}"/*.puml; do
  [[ "$(basename "${f}")" == "uml-palette.puml" ]] && continue
  sources+=("${f}")
done

if command -v plantuml >/dev/null 2>&1; then
  plantuml -tpng -o "${dir}/png" "${sources[@]}"
  plantuml -tsvg -o "${dir}/svg" "${sources[@]}"
  exit 0
fi

jar="${PLANTUML_JAR:-}"
if [[ -z "${jar}" ]]; then
  for cand in "${dir}/../tools/plantuml.jar" "${HOME}/plantuml.jar" /usr/share/plantuml/plantuml.jar; do
    [[ -f "${cand}" ]] && jar="${cand}" && break
  done
fi

if [[ -n "${jar}" ]]; then
  java -jar "${jar}" -tpng -o "${dir}/png" "${sources[@]}"
  java -jar "${jar}" -tsvg -o "${dir}/svg" "${sources[@]}"
  exit 0
fi

echo "No PlantUML found (PATH or PLANTUML_JAR). Install plantuml + graphviz, or set PLANTUML_JAR." >&2
exit 1
