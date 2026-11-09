# footage/

Local scans only. This folder's contents are **gitignored** because they contain patient data.

Layout (created by `node scripts/import-cd.mjs <cd-folder>`):

```
footage/<study>/<NN_SeriesDescription>/*.dcm
```

The dev server lists everything here in the viewer's sidebar.
