// Dev-only: exposes the local footage/ folder (laid out by scripts/import-cd.mjs) to the app.
// Layout: footage/<group>/<exam>/<series>/*.dcm, or footage/<study>/<series>/*.dcm (ungrouped).
// <group> can be any name; scripts/import-cd.mjs uses the study date (YYYY-MM-DD) by default.
//   GET /api/studies -> [{ id, name, group?, series: [{ id, name, files: [url...] }] }]
//   GET /footage/... -> raw .dcm bytes
// Never part of a production build, so scans stay on this machine.

import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export interface FootageSeries {
  id: string
  name: string
  files: string[]
}

export interface FootageStudy {
  id: string // path relative to footage/, e.g. "2026-08-26/MR arthrography"
  name: string // exam folder name
  group?: string // grouping folder name, when nested
  series: FootageSeries[]
}

const subdirs = (dir: string) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()

// "03_COR_T1_FS_DERECHO" -> "COR T1 FS DERECHO"
const seriesName = (dir: string) => dir.replace(/^\d+_/, '').replace(/_/g, ' ')

const dicomFiles = (dir: string) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.dcm'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

// segments: path of the study folder relative to root, e.g. ["2026-08-26", "MR arthrography"]
function readStudy(root: string, segments: string[], group?: string): FootageStudy {
  const id = segments.join('/')
  return {
    id,
    name: segments[segments.length - 1],
    group,
    series: subdirs(path.join(root, ...segments))
      .map((series) => ({
        id: `${id}/${series}`,
        name: seriesName(series),
        files: dicomFiles(path.join(root, ...segments, series)).map(
          (f) => '/footage/' + [...segments, series, f].map(encodeURIComponent).join('/'),
        ),
      }))
      .filter((s) => s.files.length > 0),
  }
}

function listStudies(root: string): FootageStudy[] {
  if (!fs.existsSync(root)) return []
  return subdirs(root)
    .flatMap((top) => {
      const children = subdirs(path.join(root, top))
      // series folders directly inside -> a study; otherwise a group of studies
      const isStudy = children.some((c) => dicomFiles(path.join(root, top, c)).length > 0)
      return isStudy ? [readStudy(root, [top])] : children.map((exam) => readStudy(root, [top, exam], top))
    })
    .filter((s) => s.series.length > 0)
}

export default function footage(dir = 'footage'): Plugin {
  return {
    name: 'mri-eye-footage',
    apply: 'serve',
    configureServer(server) {
      const root = path.resolve(server.config.root, dir)

      server.middlewares.use('/api/studies', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(listStudies(root)))
      })

      server.middlewares.use('/footage', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0])
        const file = path.resolve(root, '.' + rel)
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
        res.setHeader('Content-Type', 'application/dicom')
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}
