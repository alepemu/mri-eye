<script lang="ts">
  import { onMount } from 'svelte'
  import { SLICE_TYPE } from '@niivue/niivue'
  import { filesFromDataTransfer } from '@niivue/dcm2niix'
  import Sidebar from './lib/Sidebar.svelte'
  import Toolbar from './lib/Toolbar.svelte'
  import Viewer, { type CutFrom, type VolumeInfo } from './lib/Viewer.svelte'
  import { fetchFiles, fetchStudies, type Series, type Study } from './lib/studies'
  import { toVolumes } from './lib/dicom'

  let studies = $state<Study[]>([])
  let selected = $state<string | null>(null)
  let sliceType = $state(SLICE_TYPE.AXIAL)
  let colormap = $state('gray')
  let brightness = $state(0)
  let contrast = $state(0)
  let cutFrom = $state<CutFrom>('front')
  let lighting = $state(false)
  let busy = $state(false)
  let status = $state('')
  let location = $state('')
  let info = $state<(VolumeInfo & { name: string }) | null>(null)
  let dragging = $state(false)
  let viewer: Viewer

  // series id -> converted NIfTI, so switching back is instant
  const converted = new Map<string, File>()

  onMount(async () => {
    studies = await fetchStudies()
  })

  async function open(series: Series) {
    selected = series.id
    busy = true
    status = `Loading ${series.name}…`
    try {
      let image = series.image ?? converted.get(series.id)
      if (!image) {
        const files = await fetchFiles(series.urls ?? [])
        status = `Converting ${series.name}…`
        const [volume] = await toVolumes(files)
        image = volume.image
        converted.set(series.id, image)
      }
      brightness = 0
      contrast = 0
      const result = await viewer.show(image)
      info = { name: series.name, ...result }
      sliceType = result.plane
      status = ''
    } catch (e) {
      status = `Error: ${(e as Error).message}`
    } finally {
      busy = false
    }
  }

  async function importFiles(files: File[], label: string) {
    busy = true
    status = `Reading ${files.length} files…`
    try {
      const volumes = await toVolumes(files, (f) => (status = `Converting… ${Math.round(f * 100)}%`))
      if (volumes.length === 0) throw new Error('No DICOM or NIfTI images found')
      const id = `opened-${Date.now()}`
      const study: Study = {
        id,
        name: label,
        series: volumes.map((v, i) => ({ id: `${id}/${i}`, name: v.name, image: v.image })),
      }
      studies = [study, ...studies]
      busy = false
      await open(study.series[0])
    } catch (e) {
      status = `Error: ${(e as Error).message}`
      busy = false
    }
  }

  // only real file drags from the OS, not text/elements dragged around inside the page
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')

  function ondrop(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragging = false
    if (busy || !e.dataTransfer) return
    const label = e.dataTransfer.items[0]?.getAsFile()?.name ?? 'Dropped files'
    // read items synchronously, inside the handler
    filesFromDataTransfer(e.dataTransfer.items).then((files) => importFiles(files, label))
  }

  const fmt = (xs: number[], digits = 0) => xs.map((x) => x.toFixed(digits)).join(' × ')
</script>

<div
  class="app"
  role="application"
  ondragover={(e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragging = true
  }}
  ondragleave={(e) => {
    if (e.relatedTarget === null) dragging = false
  }}
  {ondrop}
>
  <Sidebar {studies} {selected} disabled={busy} onselect={open} />
  <main>
    <Toolbar
      bind:sliceType
      bind:colormap
      bind:brightness
      bind:contrast
      bind:cutFrom
      bind:lighting
      disabled={busy}
      onopen={importFiles}
    />
    <Viewer
      bind:this={viewer}
      {sliceType}
      {colormap}
      {brightness}
      {contrast}
      {cutFrom}
      {lighting}
      onlocation={(text) => (location = text)}
    />
    {#if !info && !busy}
      <div class="hint">Pick a series on the left, or drop a DICOM folder / NIfTI file here.</div>
    {/if}
    {#if dragging}<div class="drop">Drop to open</div>{/if}
    <footer>
      {#if info}
        <strong>{info.name}</strong>
        <span>{fmt(info.dims)} px</span>
        <span>{fmt(info.voxel, 2)} mm</span>
      {/if}
      <span class="location">{location}</span>
      {#if status}<span class="status" class:error={status.startsWith('Error')}>{status}</span>{/if}
    </footer>
  </main>
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: 260px 1fr;
    height: 100svh;
  }
  main {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  footer {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 6px 12px;
    border-top: 1px solid var(--border);
    background: var(--panel);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    min-height: 18px;
    white-space: nowrap;
    overflow: hidden;
  }
  footer strong {
    color: var(--text-h);
    font-weight: 600;
  }
  .location {
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status {
    margin-left: auto;
    color: var(--accent);
  }
  .status.error {
    color: var(--error);
  }
  .hint,
  .drop {
    position: absolute;
    inset: 50px 0 32px;
    display: grid;
    place-items: center;
    pointer-events: none;
    color: var(--muted);
  }
  .drop {
    background: rgba(0, 0, 0, 0.6);
    border: 2px dashed var(--accent-border);
    color: var(--text-h);
    font-size: 18px;
  }
  @media (max-width: 700px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: 30vh 1fr;
    }
  }
</style>
