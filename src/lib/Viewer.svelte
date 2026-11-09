<script lang="ts">
  import { onMount } from 'svelte'
  import { DRAG_MODE, Niivue, SLICE_TYPE, type NiiVueLocation } from '@niivue/niivue'
  import SliceBar from './SliceBar.svelte'

  export interface VolumeInfo {
    dims: number[]
    voxel: number[]
    plane: SLICE_TYPE
  }

  export type CutFrom = 'front' | 'side' | 'top'

  interface Props {
    sliceType: SLICE_TYPE
    colormap: string
    brightness: number // -100..100, 0 = automatic window
    contrast: number // -100..100, 0 = automatic window
    cutFrom: CutFrom
    lighting: boolean
    onlocation?: (text: string) => void
  }

  let { sliceType, colormap, brightness, contrast, cutFrom, lighting, onlocation }: Props = $props()

  let canvas: HTMLCanvasElement
  const nv = new Niivue({
    backColor: [0, 0, 0, 1],
    dragAndDropEnabled: false, // App handles drops so DICOM folders go through dcm2niix
    dragMode: DRAG_MODE.none, // contrast lives in the toolbar menu, not on right-drag
    invertScrollDirection: true, // wheel up = handle up on the slice bar
    clipPlaneColor: [0, 0, 0, 0], // cut without drawing the (purple) plane itself
    isColorbar: false,
    loadingText: '',
  })
  let ready: Promise<unknown> = new Promise(() => {})

  // Slice bar: which RAS axis it moves along, and where the crosshair is on it.
  let native = $state(SLICE_TYPE.AXIAL)
  let count = $state(0)
  let slice = $state(0)
  const RAS_AXIS: Partial<Record<SLICE_TYPE, number>> = {
    [SLICE_TYPE.SAGITTAL]: 0,
    [SLICE_TYPE.CORONAL]: 1,
    [SLICE_TYPE.AXIAL]: 2,
  }
  let axis = $derived(RAS_AXIS[sliceType] ?? RAS_AXIS[native]!)
  let is3D = $derived(sliceType === SLICE_TYPE.RENDER)
  let loaded = $state(false)

  // 3D cut: 0 = whole volume, 100 = cut all the way through. With axis-aligned cut directions
  // NiiVue's clip depth runs +DEPTH..-DEPTH across the (unit-cube) volume; >= 2 disables it.
  const DEPTH = 0.5
  const CUT_ANGLES: Record<CutFrom, [number, number]> = { front: [180, 0], side: [270, 0], top: [0, 90] }
  let cut = $state(0)

  function applyCut(c: number, from: CutFrom) {
    const [azimuth, elevation] = CUT_ANGLES[from]
    nv.setClipPlane([c === 0 ? 2 : DEPTH - (c / 100) * 2 * DEPTH, azimuth, elevation])
  }

  function setCut(c: number) {
    cut = c
    applyCut(c, cutFrom)
  }

  function syncSlice() {
    const dims = nv.volumes[0]?.dimsRAS
    count = dims ? dims[axis + 1] : 0
    slice = Math.min(count - 1, Math.max(0, Math.floor(nv.scene.crosshairPos[axis] * count)))
  }

  function setSlice(i: number) {
    nv.scene.crosshairPos[axis] = (i + 0.5) / count
    nv.createOnLocationChange()
    nv.drawScene()
  }

  onMount(() => {
    ready = nv.attachToCanvas(canvas)
    nv.onLocationChange = (loc) => {
      onlocation?.((loc as NiiVueLocation).string)
      syncSlice()
    }
    // In 3D with a cut active, the wheel moves the cut (same direction as the bar) instead of
    // NiiVue's own clip handling; with no cut, NiiVue zooms as usual.
    const onWheel = (e: WheelEvent) => {
      if (!is3D || cut === 0) return
      e.preventDefault()
      e.stopImmediatePropagation()
      setCut(Math.min(100, Math.max(1, cut + (e.deltaY < 0 ? 2 : -2))))
    }
    canvas.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => canvas.removeEventListener('wheel', onWheel, { capture: true })
  })

  $effect(() => {
    const st = sliceType
    ready.then(() => {
      nv.setSliceType(st)
      syncSlice()
    })
  })

  $effect(() => {
    const cm = colormap
    ready.then(() => {
      const v = nv.volumes[0]
      if (v) nv.setColormap(v.id, cm)
    })
  })

  $effect(() => {
    const b = brightness
    const k = contrast
    ready.then(() => applyWindow(b, k))
  })

  $effect(() => {
    const from = cutFrom
    ready.then(() => applyCut(cut, from))
  })

  $effect(() => {
    const amount = lighting ? 0.6 : 0
    ready.then(() => nv.setVolumeRenderIllumination(amount))
  })

  // Brightness shifts the window centre, contrast narrows/widens it, both relative to
  // NiiVue's robust (2–98%) range, which is what 0/0 shows.
  function applyWindow(b: number, k: number) {
    const v = nv.volumes[0]
    if (v?.robust_min === undefined || v.robust_max === undefined) return
    const width0 = v.robust_max - v.robust_min
    const centre = (v.robust_max + v.robust_min) / 2 - (b / 100) * width0
    const width = width0 * 2 ** (-k / 50)
    v.cal_min = centre - width / 2
    v.cal_max = centre + width / 2
    nv.updateGLVolume()
  }

  // The plane the series was acquired in: NiiVue displays the voxel grid permuted to the nearest
  // RAS axes, so the thick-slice axis (largest RAS spacing, else fewest voxels) is the one to look along.
  function nativePlane(pixDimsRAS?: number[], dimsRAS?: number[]): SLICE_TYPE {
    if (!pixDimsRAS || !dimsRAS) return SLICE_TYPE.AXIAL
    const spacing = pixDimsRAS.slice(1, 4)
    const counts = dimsRAS.slice(1, 4)
    const anisotropic = Math.max(...spacing) / Math.min(...spacing) > 1.2
    const axis = anisotropic ? spacing.indexOf(Math.max(...spacing)) : counts.indexOf(Math.min(...counts))
    return [SLICE_TYPE.SAGITTAL, SLICE_TYPE.CORONAL, SLICE_TYPE.AXIAL][axis]
  }

  export async function show(image: File): Promise<VolumeInfo> {
    await ready
    const url = URL.createObjectURL(image)
    try {
      await nv.loadVolumes([{ url, name: image.name, colormap }])
    } finally {
      URL.revokeObjectURL(url)
    }
    const v = nv.volumes[0]
    native = nativePlane(v.pixDimsRAS, v.dimsRAS)
    applyWindow(brightness, contrast)
    setCut(0)
    syncSlice()
    loaded = true
    return {
      dims: v.dims?.slice(1, 4) ?? [],
      voxel: v.pixDims?.slice(1, 4) ?? [],
      plane: native,
    }
  }
</script>

<div class="viewer">
  <div class="stage">
    <canvas bind:this={canvas}></canvas>
  </div>
  <!-- always rendered so the canvas width never changes when the bar hides -->
  <div class="slices">
    {#if is3D && loaded}
      <SliceBar value={cut} max={100} label={'Cut\n' + cut + '%'} hint="Cut into the volume" onchange={setCut} />
    {:else if count > 1}
      <SliceBar value={slice} max={count - 1} label={`${slice + 1}\n/${count}`} hint="Slice" onchange={setSlice} />
    {/if}
  </div>
</div>

<style>
  .viewer {
    display: flex;
    flex: 1;
    min-height: 0;
    background: #000;
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    outline: none;
  }
  .slices {
    display: flex;
    flex-direction: column;
    width: 52px;
    padding: 12px 0;
    border-left: 1px solid var(--border);
    background: var(--panel);
  }
</style>
