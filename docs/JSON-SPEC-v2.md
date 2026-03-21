# Selection Search Resource JSON Specification v2.0

This specification is designed for a Chrome extension that takes highlighted text from the browser, applies placeholder-specific transformation pipelines, builds a URL, and opens either the target URL directly or a launch page with format-aware guidance.

## 1. Purpose

Use this schema to describe search, research, lookup, documentation, API, or data-retrieval resources that can be invoked from selected text.

The goals are:

- reduce URL-construction ambiguity
- make menu grouping explicit
- make placeholder handling explicit
- support both HTML and non-HTML responses
- provide enough metadata that future extension code can render, decode, or hand off structured responses more intelligently

## 2. Top-level object

```json
{
  "schema_version": "2.0",
  "schema_name": "selection-search-resource-spec",
  "generated_at": "YYYY-MM-DD",
  "purpose": "Short description",
  "global_rules": {
    "selection_input": {
      "default_source": "selected_text",
      "normalize_unicode": "NFKC_optional",
      "trim_whitespace_default": true,
      "collapse_internal_whitespace_default": true
    },
    "menu_defaults": {
      "root_title": "Search selected text with…",
      "group_related_entries": true
    },
    "result_handling_defaults": {
      "html_strategy": "direct",
      "structured_strategy": "launchpad"
    }
  },
  "resources": []
}
```

## 3. Required fields per resource

Each entry in `resources` must be an object with:

- `id`
- `status`
- `resource`
- `menu`
- `input_contract`
- `url`
- `result_handling`

## 4. Resource object

```json
{
  "id": "pubmed_search",
  "status": "active",
  "resource": {
    "site_name": "PubMed",
    "resource_label": "Biomedical literature search",
    "description": "Searches PubMed using the `term` query parameter.",
    "homepage": "https://pubmed.ncbi.nlm.nih.gov/",
    "category": "scientific_medical_literature",
    "confidence": "high",
    "tested_status": "documented_high_confidence"
  }
}
```

### Rules

- `id` must be unique, lowercase snake_case preferred.
- `status` should be one of: `active`, `disabled`, `experimental`, `deprecated`.
- `resource.category` should be a stable machine-friendly category key such as `language_vocabulary`, `programming_docs`, or `official_general_reference`.

## 5. Menu object

Use this object to make menu layout explicit instead of forcing the extension to guess from domains alone.

```json
{
  "menu": {
    "category_label": "Scientific Medical Literature",
    "group_label": "PubMed",
    "title": "Biomedical literature search",
    "category_order": 200,
    "group_order": 100,
    "order": 100
  }
}
```

### Rules

- `category_label` is the first submenu level under the root context menu.
- `group_label` is the second submenu level when multiple related entries exist.
- `title` is the final clickable menu label.
- Lower `*_order` values sort earlier.
- If a group contains only one resource, the extension may flatten that leaf directly under the category.

## 6. Input contract

```json
{
  "input_contract": {
    "selection_policy": "selected_text",
    "supported_query_modes": ["word", "phrase", "author", "title"],
    "allow_empty": false
  }
}
```

### Rules

- `selection_policy` should be `selected_text` for this extension.
- `supported_query_modes` describes intended usage and helps future LLMs generate better entries.
- `allow_empty` should almost always be `false`.

## 7. URL object

The `url` object is the core execution block.

```json
{
  "url": {
    "template": "https://pubmed.ncbi.nlm.nih.gov/?term={query}",
    "method": "GET",
    "placeholders": {
      "query": {
        "source": "selected_text",
        "pipeline": ["trim", "collapse_whitespace", "encode_query_param_plus"],
        "preserve_operators": true
      }
    },
    "validation": {
      "required_placeholders": ["query"],
      "must_start_with": ["https://"]
    },
    "examples": [
      {
        "selected_text": "diabetes hypertension",
        "expected_url": "https://pubmed.ncbi.nlm.nih.gov/?term=diabetes+hypertension"
      }
    ]
  }
}
```

### Rules

- `template` must be a full URL template.
- `method` should be `GET` unless a future extension revision explicitly adds other request modes.
- Every placeholder present in the template should have a matching entry in `placeholders`.
- Include at least one example whenever possible.

## 8. Placeholder bindings

Each placeholder binding tells the extension how to derive the final inserted string.

```json
{
  "query": {
    "source": "selected_text",
    "pipeline": ["trim", "collapse_whitespace", "encode_query_param_plus"],
    "default_value": "",
    "preserve_operators": true
  }
}
```

### Allowed `source` values

For this extension revision, use:
- `selected_text`

Future-safe values can be reserved but should not be used unless supported:
- `clipboard`
- `manual_input`
- `constant`

### Allowed pipeline operations

Use these exact operation names unless the extension is extended further:

- `normalize_unicode_nfkc`
- `trim`
- `collapse_whitespace`
- `lowercase`
- `uppercase`
- `strip_leading_dot`
- `strip_leading_dots`
- `strip_wrapping_quotes`
- `regex_replace`
- `encode_query_param_plus`
- `encode_query_param`
- `encode_path_segment`
- `encode_none`

### Object-form pipeline step

Most steps can be plain strings. Use object form when parameters are needed:

```json
{
  "op": "regex_replace",
  "pattern": "^\\.+",
  "flags": "",
  "replacement": ""
}
```

### Pipeline guidance by placeholder type

- `query`: usually `trim`, `collapse_whitespace`, `encode_query_param_plus`
- `field_query`: same as `query` unless the site has field-specific requirements
- `path_term`: usually `trim`, optional punctuation cleanup, then `encode_path_segment`
- `path_segment`: same as `path_term`
- `normalized_extension`: usually `trim`, `strip_leading_dots`, `lowercase`, `encode_path_segment`
- `raw`: never encode; use only when the literal text must be inserted as-is

### Operator-preserving endpoints

If the site supports field tags, boolean operators, quotes, or search syntax, set:

```json
"preserve_operators": true
```

This means:
- do not lowercase unless the site requires it
- do not strip punctuation unless the site requires it
- do not rewrite operators
- only URL-encode at the final step

## 9. Validation object

```json
{
  "validation": {
    "required_placeholders": ["query"],
    "must_start_with": ["https://"]
  }
}
```

### Rules

- `required_placeholders` should match the placeholders used by the template.
- `must_start_with` should almost always be `["https://"]`.
- Future revisions may add regex validation or test assertions.

## 10. Examples

Always include at least one `examples` entry when you know the expected URL shape.

```json
{
  "selected_text": ".PDF",
  "expected_url": "https://fileinfo.com/extension/pdf"
}
```

Examples improve:
- human review
- automated testing
- LLM prompt reliability

## 11. Result handling object

```json
{
  "result_handling": {
    "result_format": "json",
    "content_type_hint": "application/json",
    "browser_strategy": "launchpad",
    "display_hint": "Open launch page first so the user gets format-specific guidance",
    "notes_for_user": [
      "This endpoint returns JSON rather than an HTML page.",
      "Use the launch page if you want the raw response URL copied or opened in a separate tab."
    ],
    "future_hooks": [
      "viewer_hint",
      "download_hint",
      "post_processor_id"
    ]
  }
}
```

### Allowed `result_format` values

Use one of:
- `html`
- `json`
- `xml`
- `text`
- `csv`
- `tsv`
- `pdf`
- `file`
- `unknown`

### Allowed `browser_strategy` values

Use one of:
- `direct` — open target URL immediately
- `launchpad` — open an extension page first with guidance, then let the user open/copy the target
- `download` — reserved for future revisions
- `viewer` — reserved for future revisions

### Guidance

- Use `direct` for ordinary HTML search pages.
- Use `launchpad` for JSON, XML, CSV, PDF, or other non-HTML/structured results unless there is a reason to open them directly.

## 12. Recommended authoring conventions for LLMs

When generating new entries:

1. Prefer official documentation or a currently working public example URL.
2. Use `https://` unless there is a compelling reason not to.
3. Match placeholders to actual URL semantics; do not use `{query}` for a path segment.
4. Add `menu.group_label` so related entries cluster naturally.
5. Add at least one example in `url.examples`.
6. Be explicit about non-HTML responses in `result_handling`.
7. Prefer simple, lossless pipelines.
8. Do not invent unsupported pipeline operations.

## 13. Common failure modes to avoid

- Missing placeholder definitions for placeholders used in `url.template`
- Using `encode_query_param_plus` for path segments
- Lowercasing queries that rely on case-sensitive syntax
- Stripping punctuation for operator-rich search endpoints
- Omitting result-format metadata for JSON/XML endpoints
- Relying on host/domain grouping alone when the menu should be explicitly grouped

## 14. Minimal valid resource example

```json
{
  "id": "fileinfo_extension",
  "status": "active",
  "resource": {
    "site_name": "FileInfo",
    "resource_label": "File extension lookup",
    "description": "Looks up a file extension page.",
    "homepage": "https://fileinfo.com/",
    "category": "file_type_lookup",
    "confidence": "high",
    "tested_status": "tested_via_search_result"
  },
  "menu": {
    "category_label": "File Type Lookup",
    "group_label": "FileInfo",
    "title": "File extension lookup",
    "category_order": 700,
    "group_order": 100,
    "order": 100
  },
  "input_contract": {
    "selection_policy": "selected_text",
    "supported_query_modes": ["file_extension"],
    "allow_empty": false
  },
  "url": {
    "template": "https://fileinfo.com/extension/{normalized_extension}",
    "method": "GET",
    "placeholders": {
      "normalized_extension": {
        "source": "selected_text",
        "pipeline": ["trim", "strip_leading_dots", "lowercase", "encode_path_segment"]
      }
    },
    "validation": {
      "required_placeholders": ["normalized_extension"],
      "must_start_with": ["https://"]
    },
    "examples": [
      {
        "selected_text": ".PDF",
        "expected_url": "https://fileinfo.com/extension/pdf"
      }
    ]
  },
  "result_handling": {
    "result_format": "html",
    "content_type_hint": "text/html",
    "browser_strategy": "direct",
    "display_hint": "Open directly in a browser tab",
    "notes_for_user": [],
    "future_hooks": ["viewer_hint", "download_hint", "post_processor_id"]
  }
}
```
