// Studies/series shown in the sidebar. Footage series come from the dev plugin as DICOM urls;
// dropped/opened series arrive already converted to NIfTI.

export interface Series {
  id: string
  name: string
  count?: number
  urls?: string[]
  image?: File
}

export interface Study {
  id: string
  name: string
  group?: string // grouping folder for footage studies, any name (e.g. a date "2026-08-26")
  series: Series[]
}

interface FootageStudy {
  id: string
  name: string
  group?: string
  series: { id: string; name: string; files: string[] }[]
}

export async function fetchStudies(): Promise<Study[]> {
  try {
    const res = await fetch('/api/studies')
    if (!res.ok) return []
    const data = (await res.json()) as FootageStudy[]
    return data.map((s) => ({
      id: s.id,
      name: s.name,
      group: s.group,
      series: s.series.map((x) => ({ id: x.id, name: x.name, count: x.files.length, urls: x.files })),
    }))
  } catch {
    return [] // e.g. a production build, where the dev plugin doesn't exist
  }
}

export function fetchFiles(urls: string[]): Promise<File[]> {
  return Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
      return new File([await res.blob()], decodeURIComponent(url.split('/').pop()!))
    }),
  )
}
