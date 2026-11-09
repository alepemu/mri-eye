# mri-eye

A simple, fast MRI viewer that runs in your browser. Open a hospital CD export (DICOM) or NIfTI files, pick a series and scroll through it. Everything stays on your machine. Nothing is uploaded.

Stack: Vite + Svelte 5 + TypeScript (pnpm), with [NiiVue](https://github.com/niivue/niivue) (WebGL2) for rendering. DICOM is converted in the browser by [dcm2niix](https://github.com/rordenlab/dcm2niix) running as WebAssembly.

## Run

```bash
pnpm install
pnpm dev
```

Studies in `footage/` show up in the sidebar automatically. You can also use **Open folder** / **Open files**, or drag a DICOM folder or `.nii` / `.nii.gz` file onto the viewer.

## Adding a CD

Hospital CDs ship thousands of files (bundled Windows/Mac viewers) around a few hundred images. Import one so only the images are kept:

```bash
node scripts/import-cd.mjs "D:/"                       # copy CD -> footage/<name>/NN_SeriesDescription/*.dcm
node scripts/import-cd.mjs footage/SOME_EXPORT --move   # clean up an export already copied into footage/
```

## Controls

| | |
|---|---|
| Scroll wheel / slice bar (right edge) | next / previous slice |
| Left click / drag | move crosshair |
| Toolbar → Contrast | brightness / contrast sliders, reset |
| Toolbar | Axial · Coronal · Sagittal · Multi · 3D, colormap |
| 3D view | left drag rotates; scroll wheel zooms (or moves the cut once one is set) |
| 3D: right bar + Cut from Front · Side · Top | cut into the volume to see inside; Lighting adds shading |

A series opens in the plane it was acquired in. Oblique shoulder or knee planes snap to the nearest standard view, so a "COR oblique" series may open as Sagittal.

## Privacy

`footage/` is gitignored because folder names and DICOM headers contain patient identifiers. Never commit scans. The `/api/studies` and `/footage/*` endpoints exist only on the local dev server and are not part of `pnpm build`.

## Scripts

- `pnpm dev`: dev server with the footage browser
- `pnpm build`: static build (open/drop only; no footage listing)
- `pnpm check`: svelte-check + TypeScript
