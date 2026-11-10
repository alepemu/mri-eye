<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity'
  import type { Series, Study } from './studies'

  interface Props {
    studies: Study[]
    selected: string | null
    disabled: boolean
    onselect: (series: Series) => void
  }

  let { studies, selected, disabled, onselect }: Props = $props()

  // groups start collapsed; this holds the ones the user opened
  const expanded = new SvelteSet<string>()

  function toggle(group: string) {
    if (expanded.has(group)) expanded.delete(group)
    else expanded.add(group)
  }
</script>

<aside>
  <h1>mri-eye</h1>
  {#if studies.length === 0}
    <p class="empty">No studies yet. Put CD exports in <code>footage/</code> or drop a folder on the viewer.</p>
  {/if}
  {#each studies as study, i (study.id)}
    {#if study.group && study.group !== studies[i - 1]?.group}
      {@const group = study.group}
      {@const open = expanded.has(group)}
      <h2 class="group">
        <button class:open aria-expanded={open} onclick={() => toggle(group)}>
          <span class="chevron" aria-hidden="true"></span>
          <span class="label">{group}</span>
        </button>
      </h2>
    {/if}
    {#if !study.group || expanded.has(study.group)}
    <section>
      <svelte:element this={study.group ? 'h3' : 'h2'} class="study" title={study.name}>{study.name}</svelte:element>
      <ul>
        {#each study.series as series (series.id)}
          <li>
            <button class:active={series.id === selected} {disabled} onclick={() => onselect(series)}>
              <span>{series.name}</span>
              {#if series.count}<small>{series.count}</small>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
    {/if}
  {/each}
</aside>

<style>
  aside {
    overflow-y: auto;
    border-right: 1px solid var(--border);
    background: var(--panel);
    padding: 12px 8px;
  }
  h1 {
    font-size: 15px;
    letter-spacing: 0.04em;
    margin: 0 8px 12px;
    color: var(--text-h);
  }
  .group {
    margin: 12px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .group button {
    justify-content: flex-start;
    align-items: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-h);
  }
  .group .chevron {
    transform: rotate(-90deg); /* collapsed: points right */
    transition: transform 0.15s;
  }
  .group button.open .chevron {
    transform: none;
  }
  .group .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .study {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin: 16px 8px 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group + section .study {
    margin-top: 10px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  button {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--hover);
  }
  button.active {
    background: var(--accent-bg);
    color: var(--text-h);
  }
  button:disabled {
    cursor: progress;
  }
  small {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .empty {
    margin: 8px;
    font-size: 13px;
    color: var(--muted);
  }
</style>
