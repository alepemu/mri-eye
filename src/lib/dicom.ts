// Turn whatever the user gives us (a CD folder, loose .dcm files, NIfTI files) into NIfTI volumes.
// DICOM goes through dcm2niix (WASM, in a worker); nothing leaves the browser.

import { convert } from '@niivue/dcm2niix'

export interface Volume {
  name: string
  image: File
}

const NIFTI = /\.nii(\.gz)?$/i

// DICOM Part 10 files carry "DICM" at byte 128. This skips the viewer .exe/.dll/etc. on CDs.
async function isDicom(file: File): Promise<boolean> {
  if (file.size < 132 || file.name.toUpperCase() === 'DICOMDIR') return false
  const magic = new Uint8Array(await file.slice(128, 132).arrayBuffer())
  return String.fromCharCode(...magic) === 'DICM'
}

export async function toVolumes(files: File[], onProgress?: (fraction: number) => void): Promise<Volume[]> {
  const nifti = files.filter((f) => NIFTI.test(f.name)).map((f) => ({ name: f.name.replace(NIFTI, ''), image: f }))
  const flags = await Promise.all(files.map(isDicom))
  const dicom = files.filter((_, i) => flags[i])
  if (dicom.length === 0) return nifti

  // %s_%d = series number + description: keeps patient folder names out of output names
  const { series, exitCode, log } = await convert(dicom, { args: ['-f', '%s_%d', '-z', 'n'], onProgress })
  if (series.length === 0) throw new Error(`dcm2niix produced no images (exit ${exitCode}): ${log.slice(-3).join(' ')}`)
  return [
    ...nifti,
    ...series.map((s) => ({ name: String(s.json?.SeriesDescription ?? s.stem), image: s.image })),
  ]
}
