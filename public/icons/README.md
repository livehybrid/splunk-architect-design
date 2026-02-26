# Splunk Icon Placeholders

This directory is reserved for official Splunk iconography or custom icon packs.

## Current behavior

- The UI currently renders in-node text placeholders (for example, `UF`, `HF`, `IN`) when no icon exists.
- A generic placeholder icon is available at `public/icons/placeholder.svg`.

## Recommended file naming

- `universal-forwarder.svg`
- `heavy-forwarder.svg`
- `indexer.svg`
- `search-head.svg`
- `cluster-manager.svg`
- `monitoring-console.svg`

After adding official icons, map component types to these files in the UI node renderer.
