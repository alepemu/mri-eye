<script lang="ts">
  // Vertical slider: max at the top. Custom-drawn so it can be styled freely (native vertical
  // range inputs only take an accent colour).
  interface Props {
    value: number
    max: number
    label: string
    hint?: string
    onchange: (value: number) => void
  }

  let { value, max, label, hint = '', onchange }: Props = $props()

  let track: HTMLElement
  let dragging = $state(false)
  const pos = $derived(max > 0 ? value / max : 0)

  function fromPointer(e: PointerEvent) {
    const r = track.getBoundingClientRect()
    const frac = 1 - (e.clientY - r.top) / r.height
    set(Math.round(frac * max))
  }

  function set(v: number) {
    const clamped = Math.min(max, Math.max(0, v))
    if (clamped !== value) onchange(clamped)
  }

  function onkeydown(e: KeyboardEvent) {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key]
    if (step) set(value + step)
    else if (e.key === 'Home') set(0)
    else if (e.key === 'End') set(max)
    else return
    e.preventDefault()
  }
</script>

<div class="bar" title={hint}>
  <span class="label">{label}</span>
  <div
    class="track"
    class:dragging
    bind:this={track}
    role="slider"
    tabindex="0"
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value}
    aria-label={hint || label}
    aria-orientation="vertical"
    onpointerdown={(e) => {
      // no text selection, and no native drag of an existing selection (which would cancel this one)
      e.preventDefault()
      track.focus()
      dragging = true
      track.setPointerCapture(e.pointerId)
      fromPointer(e)
    }}
    ondragstart={(e) => e.preventDefault()}
    onpointermove={(e) => dragging && fromPointer(e)}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
    onwheel={(e) => {
      e.preventDefault()
      set(value + (e.deltaY < 0 ? 1 : -1))
    }}
    {onkeydown}
  >
    <div class="rail"></div>
    <div class="fill" style:height="{pos * 100}%"></div>
    <div class="thumb" style:bottom="{pos * 100}%"></div>
  </div>
</div>

<style>
  .bar {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    min-height: 0;
    width: 100%;
    user-select: none;
  }
  .label {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--text-h);
    text-align: center;
    line-height: 1.2;
    white-space: pre-line;
  }
  .track {
    position: relative;
    flex: 1;
    width: 28px;
    margin: 8px 0;
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  .track.dragging {
    cursor: grabbing;
  }
  .rail,
  .fill {
    position: absolute;
    left: 50%;
    width: 4px;
    transform: translateX(-50%);
    border-radius: 2px;
  }
  .rail {
    top: 0;
    bottom: 0;
    background: var(--border);
  }
  .fill {
    bottom: 0;
    background: #5b606b;
  }
  .thumb {
    position: absolute;
    left: 50%;
    width: 22px;
    height: 10px;
    transform: translate(-50%, 50%);
    border-radius: 5px;
    background: #d6d9df;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    transition: background 0.1s;
  }
  .track:hover .thumb,
  .track.dragging .thumb {
    background: #fff;
  }
  .track:focus-visible .thumb {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
</style>
