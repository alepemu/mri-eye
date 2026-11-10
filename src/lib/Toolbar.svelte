<script lang="ts">
  import { SLICE_TYPE } from '@niivue/niivue'
  import type { CutFrom } from './Viewer.svelte'

  interface Props {
    sliceType: SLICE_TYPE
    colormap: string
    brightness: number
    contrast: number
    cutFrom: CutFrom
    lighting: boolean
    disabled: boolean
    onopen: (files: File[], label: string) => void
  }

  let {
    sliceType = $bindable(),
    colormap = $bindable(),
    brightness = $bindable(),
    contrast = $bindable(),
    cutFrom = $bindable(),
    lighting = $bindable(),
    disabled,
    onopen,
  }: Props = $props()

  const cutSides: { id: CutFrom; label: string }[] = [
    { id: 'front', label: 'Front' },
    { id: 'side', label: 'Side' },
    { id: 'top', label: 'Top' },
  ]

  let menuOpen = $state(false)
  let menu: HTMLElement
  const adjusted = $derived(brightness !== 0 || contrast !== 0)

  const views = [
    { type: SLICE_TYPE.AXIAL, label: 'Axial' },
    { type: SLICE_TYPE.CORONAL, label: 'Coronal' },
    { type: SLICE_TYPE.SAGITTAL, label: 'Sagittal' },
    { type: SLICE_TYPE.MULTIPLANAR, label: 'Multi' },
    { type: SLICE_TYPE.RENDER, label: '3D' },
  ]
  const colormaps = ['gray', 'bone', 'hot', 'inferno', 'viridis']

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = [...(input.files ?? [])]
    const label = files[0]?.webkitRelativePath.split('/')[0] || (files.length === 1 ? files[0].name : `${files.length} files`)
    if (files.length) onopen(files, label)
    input.value = ''
  }
</script>

<svelte:window
  onpointerdown={(e) => {
    if (menuOpen && !menu.contains(e.target as Node)) menuOpen = false
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape') menuOpen = false
  }}
/>

<header>
  <div class="group">
    {#each views as v (v.type)}
      <button class:active={sliceType === v.type} onclick={() => (sliceType = v.type)}>{v.label}</button>
    {/each}
  </div>
  <div class="select">
    <select bind:value={colormap} aria-label="Colormap">
      {#each colormaps as cm (cm)}<option value={cm}>{cm}</option>{/each}
    </select>
    <span class="chevron" aria-hidden="true"></span>
  </div>
  <div class="menu" bind:this={menu}>
    <button class:active={menuOpen} aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
      Contrast{#if adjusted}<span class="dot" title="Adjusted"></span>{/if}<span class="chevron" aria-hidden="true"
      ></span>
    </button>
    {#if menuOpen}
      <div class="panel">
        <label>
          <span>Brightness <output>{brightness}</output></span>
          <input type="range" min="-100" max="100" bind:value={brightness} />
        </label>
        <label>
          <span>Contrast <output>{contrast}</output></span>
          <input type="range" min="-100" max="100" bind:value={contrast} />
        </label>
        <button
          disabled={!adjusted}
          onclick={() => {
            brightness = 0
            contrast = 0
          }}>Reset</button
        >
      </div>
    {/if}
  </div>
  {#if sliceType === SLICE_TYPE.RENDER}
    <span class="sep"></span>
    <span class="caption">Cut from</span>
    <div class="group">
      {#each cutSides as s (s.id)}
        <button class:active={cutFrom === s.id} onclick={() => (cutFrom = s.id)}>{s.label}</button>
      {/each}
    </div>
    <button class:active={lighting} aria-pressed={lighting} onclick={() => (lighting = !lighting)}>Lighting</button>
  {/if}
  <span class="spacer"></span>
  <label class="button" class:disabled>
    Open folder
    <input type="file" webkitdirectory multiple {disabled} onchange={picked} />
  </label>
  <label class="button" class:disabled>
    Open files
    <input type="file" multiple accept=".dcm,.nii,.gz,application/dicom" {disabled} onchange={picked} />
  </label>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    flex-wrap: wrap;
  }
  .group {
    display: flex;
  }
  .group button {
    border-radius: 0;
  }
  .group button:first-child {
    border-radius: 6px 0 0 6px;
  }
  .group button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .group button + button {
    border-left: 0;
  }
  button,
  select,
  .button {
    font: inherit;
    font-size: 13px;
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
  button:hover,
  select:hover,
  .button:hover {
    background: var(--hover);
  }
  /* the shared .chevron (app.css) also replaces the native select arrow */
  button .chevron {
    margin-left: 8px;
  }
  .select {
    position: relative;
    display: flex;
    color: var(--text);
  }
  .select select {
    appearance: none;
    padding-right: 28px;
  }
  .select .chevron {
    position: absolute;
    right: 11px; /* 10px padding + 1px border, same as the button chevrons */
    top: 50%;
    margin: 0;
    transform: translateY(-50%);
    pointer-events: none;
  }
  button.active {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    color: var(--text-h);
  }
  .button input {
    display: none;
  }
  .button.disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .spacer {
    flex: 1;
  }
  .sep {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background: var(--border);
  }
  .caption {
    font-size: 12px;
    color: var(--muted);
  }
  .menu {
    position: relative;
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 6px;
    border-radius: 50%;
    background: var(--accent);
    vertical-align: middle;
  }
  .panel {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 10;
    display: grid;
    gap: 12px;
    width: 220px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .panel label {
    display: grid;
    gap: 4px;
    font-size: 12px;
  }
  .panel label span {
    display: flex;
    justify-content: space-between;
  }
  .panel output {
    color: var(--text-h);
    font-variant-numeric: tabular-nums;
  }
  .panel input[type='range'] {
    width: 100%;
    margin: 0;
    accent-color: var(--accent);
  }
  .panel button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
