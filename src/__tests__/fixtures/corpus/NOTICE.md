# Corpus notice

The files in `icons/` are a fixed sample of real icon sets, used only as test input. They are not
part of the published package. The sample is every Nth file of each set's sorted file list
(25 per set), copied unchanged and prefixed with the set name. Licenses are in `licenses/`.

| Prefix           | Package                       | Version | Path sampled    | License                                                              |
| ---------------- | ----------------------------- | ------- | --------------- | -------------------------------------------------------------------- |
| `heroicons--`    | heroicons                     | 2.2.0   | `24/outline`    | MIT                                                                  |
| `lucide--`       | lucide-static                 | 1.73.0  | `icons`         | ISC                                                                  |
| `material--`     | @material-design-icons/svg    | 0.14.15 | `filled`        | Apache-2.0                                                           |
| `fontawesome--`  | @fortawesome/fontawesome-free | 7.3.1   | `svgs`          | CC BY 4.0 (icons), attribution: Font Awesome Free by Fonticons, Inc. |
| `simple-icons--` | simple-icons                  | 16.38.0 | `icons`         | CC0-1.0                                                              |
| `tabler--`       | @tabler/icons                 | 3.52.0  | `icons/outline` | MIT                                                                  |
| `bootstrap--`    | bootstrap-icons               | 1.13.2  | `icons`         | MIT                                                                  |
| `messy--`        | hand-written                  | n/a     | n/a             | CC0-1.0, written for this repository                                 |

The `messy--` files imitate editor exports (Illustrator, Inkscape, Figma, Sketch, SVGO): XML
prolog, DOCTYPE with entities, RDF metadata, namespaced attributes, gradients, clip paths, masks,
`<use>`, a BOM, CRLF line endings, sizes without a viewBox, an empty `<svg/>` and non-ASCII titles.
Brand marks in `simple-icons--` remain the property of their owners.
