# Add-model schema audit

Compared the local horde-model-reference service schema and the public OpenAPI schema at
https://models.aihorde.net/api/openapi.json on 2026-10-26. Read the pending queue using the
approver credential; no queue records were changed. The two pending records were
Anima-Turbo-v1.1 (#302) and Krea2-Turbo_fp8 (#303).

| Area                   | Delta and correction                                                                                                                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File roles             | Both pending records declare `unet`, `vae`, and `text_encoders` in `config.files[].file_type`. The wizard now edits canonical `file_purpose` and maps it to legacy `file_type` on submission. Arbitrary role strings remain accepted.                                                                                       |
| File metadata          | Added `content_hash` and `size_bytes`; preserved slow-download flags, SHA256 from legacy files, and embedded component hashes. Content hashes identify tensor contents, separately from SHA256.                                                                                                                             |
| Baselines              | Removed invalid fixed suggestions (`stable_diffusion_2_1`, `stable_diffusion_3`, etc.); added current Anima/Krea values and existing generated enum values. Baseline and style inputs allow custom strings, as the backend schema does. Instruct formats also accept custom strings.                                        |
| Image attributes       | Added total size, optimization, showcase URLs and the existing structured requirements editor, including step/CFG bounds, samplers, schedulers and custom requirements. Added `er_sde` and `simple` suggestions found in both pending records.                                                                              |
| Licensing              | Both pending records have multiple evidence sources with checked dates. Added repeatable evidence controls and checked/reviewed dates and reviewer. Preserve per-file overrides and other licensing attributes during ordinary edits; per-file overrides remain editable in advanced JSON.                                  |
| Other model attributes | Additional controls cover fine-tune series, text settings, model URL, naming exceptions, context windows and support claims; CLIP pretrained names; ControlNet style; annotator control types/preprocessors; LoRA, embedding, audio and video attributes. Complex structured attributes use individual JSON-object editors. |
| Round trips            | JSON editing and loading proposals now preserve attributes beyond the original curated field set, and allow empty download lists. Submission bypasses the lossy form adapter and emits either native v2 downloads or correctly split legacy files/downloads.                                                                |
| Input layout           | File-purpose suggestions use an input-anchored overlay that follows resizing. The suggestion list fills its overlay. Short identifiers, numbers and dates have compact widths; names, URLs, hashes and descriptions have wider responsive limits.                                                                           |
| Templates              | Model detail offers **Use as template**, opening a create proposal with a copied file list and settings. Clear the model name/display name and source audit metadata. Reset licensing and text naming exceptions/group for a new review. Shared VAE/text encoder URLs, roles and checksums remain available.                |

`available`, legacy `type`, and `download_all` retain the existing compatibility defaults.
Legacy `min_bridge_version` retains the existing service compatibility treatment.
Record audit timestamps and read-only guidance enrichment do not need authoring controls.
Deprecated placement fields (`directory` / nonempty `file_path`) are not offered: the current
service uses the file purpose for component placement and requires legacy `file_path` to be empty.

## Form hierarchy informed by production data

A read-only sample of the v1 production catalogs on 2026-10-26 included 163 image
records and 2,112 text records (including text variants).

- Image description, version, baseline and style were populated on all 163 records;
  homepage on 157 and total size on 162. These remain prominent.
- Tags appeared on 28 image records, triggers on 24, showcases on 73, requirements
  on 31 and optimization on one. Group these as supporting discovery, runtime and
  compatibility details; optional does not mean invalid or unimportant.
- Image download names had a median length of 23 characters and 95th percentile
  of 38; URLs had median 93 and 95th percentile 114. Keep URLs and SHA256 wider.
- Only eight legacy file entries declared a file type. Whole-file SHA256 remained
  common; component content hashes and per-file sizes were not declared in this
  legacy catalog. Keep all supported controls available but give technical extras
  less visual weight. Pending split-file models still need visible file-role controls.
- Text baseline values were populated on 228 records; their 95th percentile length
  was 48 characters, commonly full repository names. Use a wider baseline input.
  Parameter counts were populated throughout the text catalog and remain prominent.

The visual changes use section legends, subdued descriptions, restrained required
markers and a single lightly accented group per step. They do not change payloads,
default values or validation requirements.

## Scoped clearing

Populated authoring controls have a clear button adjacent to the input. Each form
group has a clear-section action limited to its fields, and each download entry
has a clear-file action that retains other files. Required fields become empty
and remain subject to validation. Locked model identifiers cannot be cleared.
Permission fields clear to `unknown`; booleans clear to false; collection fields
clear to empty collections. Requirement and embedded-component section clearing
also discards unfinished custom-entry drafts. Additional attribute clearing resets
invalid JSON drafts and their local validation state.
