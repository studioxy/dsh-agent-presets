# Local setup for the pdf skill

The `SKILL.md` tells you to run `python scripts/<name>.py`. **That will not work on this machine
as written**, because the only `python` on `PATH` belongs to an unrelated tool's virtualenv
(`D:\local\hermes\hermes-agent\venv`). Installing packages there would break that tool.

Use this interpreter instead:

```
C:\Users\andrz\.dsh\.agent-presets\docs\venv\Scripts\python.exe
```

## What is installed there

`pypdf`, `pdfplumber`, `reportlab`, `pypdfium2`, `Pillow` — installed 2026-09-20 into a virtualenv
created from the system Python 3.11 at
`C:\Users\andrz\AppData\Local\Programs\Python\Python311\python.exe`.

## Which scripts work

Verified by running them against a two-page PDF produced by Chrome.

| script | needs | state |
|---|---|---|
| `check_bounding_boxes.py` | standard library only | works |
| `check_fillable_fields.py` | `pypdf` | works |
| `create_validation_image.py` | `Pillow` | works |
| `extract_form_field_info.py` | `pypdf` | works |
| `extract_form_structure.py` | `pdfplumber` | works — takes **two** arguments: `<input.pdf> <output.json>` |
| `fill_fillable_fields.py` | `pypdf` | works |
| `fill_pdf_form_with_annotations.py` | `pypdf` | works |
| `convert_pdf_to_images.py` | **`pdf2image`** | **does not work** |

## The one broken script

`convert_pdf_to_images.py` imports `pdf2image`, which is not installed and which in turn needs
**poppler** — a native binary that is not present on this machine and cannot be installed with pip.
`SKILL.md` mentions `pip install pytesseract pdf2image` but not the poppler requirement, which is
the part that actually blocks it on Windows.

Use `pdf-to-images.py` in this directory instead. It does the same job with `pypdfium2`, which has
no native dependency:

```
venv\Scripts\python.exe pdf-to-images.py <input.pdf> <output-dir> [--scale 2]
```

## PDF generation does not need this skill at all

Chrome prints HTML to PDF directly, with no Python and no dependencies:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu ^
  --no-pdf-header-footer --print-to-pdf=out.pdf "file:///C:/path/to/page.html"
```

What this skill adds over that is **verification and form handling** — reading back what the PDF
actually contains, and filling fields. Not producing the file.
