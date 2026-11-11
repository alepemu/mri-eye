# footage/

Local scans only. This folder's contents are **gitignored** because they contain patient data.

Layout (created by `node scripts/import-cd.mjs <cd-folder> [--name "<group>/<exam>"]`):

```
footage/<group>/<exam>/<NN_SeriesDescription>/*.dcm
```

e.g. `footage/2026-08-26 (MR Arthro)/MR arthrography/01_AX_T1_FS_DERECHO/`.

- **group**: any name. The import defaults to the study date (`2026-08-26`). Start names with the date to keep them in time order, since groups are sorted alphabetically.
- **exam**: one study, e.g. `MRI`, `XRAY`, `Fluoroscopy`. The import derives it from the modality unless you pass `--name`.
- **series**: `.dcm` files, or plain pictures (`.png`, `.jpg`, `.jpeg`, `.bmp`, `.gif`) dropped in by hand, e.g. `footage/2026-04-05 (XRAY)/XRAY/01_Epaule_face_1/xray.jpeg`.

Folders without images, like `Reports/` with PDFs, are kept but not shown in the viewer. Renaming groups or exams by hand is fine. The dev server lists everything here in the viewer's sidebar, one collapsible section per group.
