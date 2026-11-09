// Dev-only: exposes the local footage/ folder (laid out by scripts/import-cd.mjs) to the app.
//   GET /api/studies         -> [{ id, series: [{ id, name, files: [url...] }] }]
//   GET /footage/<study>/... -> raw .dcm bytes
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
  id: string
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

function listStudies(root: string): FootageStudy[] {
  if (!fs.existsSync(root)) return []
  return subdirs(root).map((study) => ({
    id: study,
    series: subdirs(path.join(root, study))
      .map((series) => ({
        id: `${study}/${series}`,
        name: seriesName(series),
        files: fs
          .readdirSync(path.join(root, study, series))
          .filter((f) => f.toLowerCase().endsWith('.dcm'))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((f) => `/footage/${encodeURIComponent(study)}/${encodeURIComponent(series)}/${encodeURIComponent(f)}`),
      }))
      .filter((s) => s.files.length > 0),
  }))
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
