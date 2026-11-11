// Turn whatever the user gives us (a CD folder, loose .dcm files, NIfTI files, pictures) into
// volumes NiiVue can open. DICOM goes through dcm2niix (WASM, in a worker); nothing leaves the browser.

import { convert } from '@niivue/dcm2niix'

export interface Volume {
  name: string
  image: File
}

const NIFTI = /\.nii(\.gz)?$/i
const PICTURE = /\.(png|jpe?g|bmp|gif)$/i // NiiVue opens these directly as 2D images

// DICOM Part 10 files carry "DICM" at byte 128. This skips the viewer .exe/.dll/etc. on CDs.
async function isDicom(file: File): Promise<boolean> {
  if (file.size < 132 || file.name.toUpperCase() === 'DICOMDIR') return false
  const magic = new Uint8Array(await file.slice(128, 132).arrayBuffer())
  return String.fromCharCode(...magic) === 'DICM'
}

// NiiVue draws colour (RGBA) pictures upside down and can't window or colormap them, while
// grey ones load as plain 8-bit images. Medical pictures are grey anyway (colour mostly comes
// from screenshot chrome), so colour pictures are converted to grayscale first.
async function asGrayscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = pixels.data
  let grey = true
  for (let i = 0; i < d.length && grey; i += 4) grey = d[i] === d[i + 1] && d[i] === d[i + 2]
  if (grey) return file
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
  }
  ctx.putImageData(pixels, 0, 0)
  const png = await canvas.convertToBlob({ type: 'image/png' })
  return new File([png], file.name.replace(PICTURE, '.png'))
}

export async function toVolumes(files: File[], onProgress?: (fraction: number) => void): Promise<Volume[]> {
  const nifti = files.filter((f) => NIFTI.test(f.name)).map((f) => ({ name: f.name.replace(NIFTI, ''), image: f }))
  const pictures = await Promise.all(
    files
      .filter((f) => PICTURE.test(f.name))
      .map(async (f) => ({ name: f.name.replace(PICTURE, ''), image: await asGrayscale(f) })),
  )
  const direct = [...nifti, ...pictures]
  const flags = await Promise.all(files.map(isDicom))
  const dicom = files.filter((_, i) => flags[i])
  if (dicom.length === 0) return direct

  // %s_%d = series number + description: keeps patient folder names out of output names
  const { series, exitCode, log } = await convert(dicom, { args: ['-f', '%s_%d', '-z', 'n'], onProgress })
  if (series.length === 0) throw new Error(`dcm2niix produced no images (exit ${exitCode}): ${log.slice(-3).join(' ')}`)
  return [
    ...direct,
    ...series.map((s) => ({ name: String(s.json?.SeriesDescription ?? s.stem), image: s.image })),
  ]
}
