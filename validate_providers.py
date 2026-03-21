#!/usr/bin/env python3
r"""Validate config JSON for the Selection Search Launcher extension.

Usage:
    python validate_providers.py providers.default.json
    python validate_providers.py path\to\my-config.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ALLOWED_ENCODINGS = {"url", "plus", "none"}
ALLOWED_PIPELINE_OPS = {
    "normalize_unicode_nfkc",
    "trim",
    "collapse_whitespace",
    "lowercase",
    "uppercase",
    "strip_leading_dot",
    "strip_leading_dots",
    "strip_wrapping_quotes",
    "regex_replace",
    "encode_query_param_plus",
    "encode_query_param",
    "encode_path_segment",
    "encode_none",
    "none",
}


def validate_provider_array(data: object) -> list[str]:
    errors: list[str] = []

    if not isinstance(data, list):
        return ["Top-level provider config must be an array."]

    seen_ids: set[str] = set()

    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            errors.append(f"Entry {index}: must be an object.")
            continue

        item_id = str(item.get("id", "")).strip()
        title = str(item.get("title", "")).strip()
        url_template = str(item.get("urlTemplate", "")).strip()

        if not item_id:
            errors.append(f"Entry {index}: missing 'id'.")
        elif item_id in seen_ids:
            errors.append(f"Entry {index}: duplicate id '{item_id}'.")
        else:
            seen_ids.add(item_id)

        if not title:
            errors.append(f"Entry {index}: missing 'title'.")

        if not url_template:
            errors.append(f"Entry {index}: missing 'urlTemplate'.")
        elif "{text}" not in url_template and "{raw}" not in url_template:
            errors.append(f"Entry {index}: urlTemplate must include '{{text}}' or '{{raw}}'.")

        filters = item.get("filters", {})
        if filters is not None and not isinstance(filters, dict):
            errors.append(f"Entry {index}: 'filters' must be an object if present.")
            continue

        if isinstance(filters, dict):
            encoding = filters.get("encoding")
            if encoding is not None and encoding not in ALLOWED_ENCODINGS:
                errors.append(
                    f"Entry {index}: filters.encoding must be one of {sorted(ALLOWED_ENCODINGS)}."
                )

            regex_replacements = filters.get("regexReplacements")
            if regex_replacements is not None and not isinstance(regex_replacements, list):
                errors.append(f"Entry {index}: filters.regexReplacements must be a list if present.")

    return errors


def validate_finalists(data: object) -> list[str]:
    errors: list[str] = []

    if not isinstance(data, list):
        return ["'finalists' must be an array."]

    seen_ids: set[str] = set()

    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            errors.append(f"Finalist {index}: must be an object.")
            continue

        item_id = str(item.get("id", "")).strip()
        url_template = str(item.get("url_template", "")).strip()

        if not item_id:
            errors.append(f"Finalist {index}: missing 'id'.")
        elif item_id in seen_ids:
            errors.append(f"Finalist {index}: duplicate id '{item_id}'.")
        else:
            seen_ids.add(item_id)

        if not url_template:
            errors.append(f"Finalist {index}: missing 'url_template'.")

    return errors


def validate_resource_spec(data: object) -> list[str]:
    errors: list[str] = []

    if not isinstance(data, list):
        return ["'resources' must be an array."]

    seen_ids: set[str] = set()

    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            errors.append(f"Resource {index}: must be an object.")
            continue

        item_id = str(item.get("id", "")).strip()
        url_template = str(item.get("url", {}).get("template", "")).strip()

        if not item_id:
            errors.append(f"Resource {index}: missing 'id'.")
        elif item_id in seen_ids:
            errors.append(f"Resource {index}: duplicate id '{item_id}'.")
        else:
            seen_ids.add(item_id)

        if not url_template:
            errors.append(f"Resource {item_id or index}: missing 'url.template'.")
            continue

        placeholders = set(re.findall(r"\{([a-zA-Z0-9_]+)\}", url_template))
        bindings = item.get("url", {}).get("placeholders", {})
        if not isinstance(bindings, dict):
            errors.append(f"Resource {item_id}: url.placeholders must be an object.")
            continue

        for placeholder in placeholders:
            if placeholder not in bindings:
                errors.append(f"Resource {item_id}: missing placeholder binding for '{placeholder}'.")

        for placeholder, binding in bindings.items():
            if not isinstance(binding, dict):
                errors.append(f"Resource {item_id}: binding for '{placeholder}' must be an object.")
                continue

            pipeline = binding.get("pipeline", [])
            if pipeline is None:
                continue
            if not isinstance(pipeline, list):
                errors.append(f"Resource {item_id}: pipeline for '{placeholder}' must be a list.")
                continue

            for step in pipeline:
                if isinstance(step, str):
                    if step not in ALLOWED_PIPELINE_OPS:
                        errors.append(
                            f"Resource {item_id}: unsupported pipeline op '{step}' for '{placeholder}'."
                        )
                elif isinstance(step, dict):
                    op = str(step.get("op", "")).strip()
                    if op not in ALLOWED_PIPELINE_OPS:
                        errors.append(
                            f"Resource {item_id}: unsupported object pipeline op '{op}' for '{placeholder}'."
                        )
                else:
                    errors.append(
                        f"Resource {item_id}: pipeline step for '{placeholder}' must be a string or object."
                    )

    return errors


def validate_config(data: object) -> list[str]:
    if isinstance(data, list):
        return validate_provider_array(data)

    if not isinstance(data, dict):
        return ["Top-level JSON must be either an object or an array."]

    if "providers" in data:
        return validate_provider_array(data.get("providers"))

    if "finalists" in data:
        return validate_finalists(data.get("finalists"))

    if "resources" in data:
        return validate_resource_spec(data.get("resources"))

    return ["Object config must contain either 'providers', 'finalists', or 'resources'."]


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python validate_providers.py <config.json>")
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        return 2

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to read JSON: {exc}")
        return 1

    errors = validate_config(data)
    if errors:
        print("Validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Validation passed: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
