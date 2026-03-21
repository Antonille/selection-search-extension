# Resource Audit
This audit compares the uploaded legacy finalist JSON against the pre-update extension behavior and the updated v2 schema/extension behavior.
Legend:
- **Current URL**: whether the original extension could generally form the URL correctly.
- **Current result handling**: whether the original extension handled the returned format well.
- **Main issue**: the most likely source of ambiguity or failure.

## mw_dictionary — Merriam-Webster Dictionary
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Exact-entry path lookups can still misfire when the selection includes surrounding quotes or trailing punctuation.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## mw_thesaurus — Merriam-Webster Thesaurus
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Exact-entry path lookups can still misfire when the selection includes surrounding quotes or trailing punctuation.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## cambridge_dictionary — Cambridge Dictionary
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Exact-entry path lookups can still misfire when the selection includes surrounding quotes or trailing punctuation.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## etymonline_word — Online Etymology Dictionary
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Exact-entry path lookups can still misfire when the selection includes surrounding quotes or trailing punctuation.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## wiktionary_entry — Wiktionary
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Exact-entry path lookups can still misfire when the selection includes surrounding quotes or trailing punctuation.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## wikipedia_special_search — Wikipedia Special:Search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## onelook_general — OneLook
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## pubmed_search — PubMed
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## pubmed_clinical_queries — PubMed Clinical Queries
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## medlineplus_webservice — MedlinePlus Web Service
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Limited** — Current extension opens the raw structured response with no format-aware guidance.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource explicitly states that it returns XML, which is valuable metadata for future handling.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - The legacy extension had no launch page or structured-result hints for XML endpoints.
- Updated handling in this revision:
  - The updated extension routes this resource through the launch page, which explains the format and lets the user open or copy the final URL.

## europe_pmc_search — Europe PMC
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## arxiv_search — arXiv search
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## openalex_works_search — OpenAlex Works API
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Limited** — Current extension opens the raw structured response with no format-aware guidance.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource explicitly states that it returns JSON, which is valuable metadata for future handling.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
  - The legacy extension had no launch page or structured-result hints for JSON endpoints.
- Updated handling in this revision:
  - The updated extension routes this resource through the launch page, which explains the format and lets the user open or copy the final URL.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## crossref_works_query_bibliographic — Crossref Works API
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Limited** — Current extension opens the raw structured response with no format-aware guidance.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource explicitly states that it returns JSON, which is valuable metadata for future handling.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
  - The legacy extension had no launch page or structured-result hints for JSON endpoints.
- Updated handling in this revision:
  - The updated extension routes this resource through the launch page, which explains the format and lets the user open or copy the final URL.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## nasa_ntrs_search — NASA Technical Reports Server (NTRS)
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## jstor_basic_search — JSTOR basic search
- Current URL: **Partial** — URL builds, but current code only approximates the operator-preserving intent.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The current extension does not lowercase or strip punctuation, so most advanced query syntax survives basic encoding.
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - Operator preservation was only implicit; there was no explicit placeholder-level contract or test case in the extension.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.
  - The updated schema records `preserve_operators: true` on the relevant placeholder, so the intent is explicit instead of implied.

## doaj_articles_search — DOAJ article search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - The JSON itself already notes that the path-style DOAJ search is less explicitly documented than some other endpoints.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## python_docs_search — Python official docs search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## numpy_docs_search — NumPy docs search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## scipy_docs_search — SciPy docs search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## pytorch_docs_search — PyTorch docs search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## mdn_search — MDN Web Docs search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## fileinfo_extension — FileInfo
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## data_gov_dataset_search — Data.gov dataset search
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Yes** — Browser tab behavior is natural for HTML endpoints.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource returns HTML, so a normal browser tab is a good default.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
- Updated handling in this revision:
  - The updated extension continues to open this resource directly, but now uses explicit placeholder pipelines and menu metadata when present.

## loc_general_search_api — Library of Congress search API
- Current URL: **Yes** — Current placeholder and encoding support are sufficient for the basic URL shape.
- Current result handling: **Limited** — Current extension opens the raw structured response with no format-aware guidance.
- Strengths:
  - The declared placeholder type is already one the extension understands (`query`, `path_term`, `normalized_extension`, or similar).
  - The resource explicitly states that it returns JSON, which is valuable metadata for future handling.
- Weaknesses / ambiguity sources:
  - The legacy extension ignored most of the descriptive `string_prep.steps` text and all top-level global handling rules.
  - The legacy extension had no launch page or structured-result hints for JSON endpoints.
- Updated handling in this revision:
  - The updated extension routes this resource through the launch page, which explains the format and lets the user open or copy the final URL.
