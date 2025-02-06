<script lang="ts">
	import { throttledDerived } from '$utils/stores';
  import { VisLeafletMap } from '@unovis/svelte'
	import { onMount } from 'svelte';
	import { derived, readable, type Readable } from 'svelte/store';
  
    type MapPointDataRecord = { id: string; dd: { lat: number; lon: number } }

    export let data: Readable<any[]>;

    const mapData = throttledDerived(data, ($data) => {
        if (!$data) {
            return []
        }

        return $data
            .filter((d: any) => d?.dd)
            .map((d: any) => {
                return {
                    id: d.relay.replace('wss://', '').replace('ws://', ''),  
                    dd: { lat: d.dd.lat, lon: d.dd.lon }
                }
            })
    }, 1000)
    const style = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const renderer = 'raster'
    const pointLatitude = (d: MapPointDataRecord) => d?.dd.lat
    const pointLongitude = (d: MapPointDataRecord) => d?.dd.lon
    const pointBottomLabel = (d: MapPointDataRecord) => d.id
    const pointColor = '#286e47'

    let showMap = false

    onMount(async () => {
        showMap = true
        data = readable([])
    })
  </script>
  
  {#if showMap}
  <VisLeafletMap
    height="75vh"
    data={$mapData}
    {style}
    {renderer}
    {pointLatitude}
    {pointLongitude}
    {pointBottomLabel}
    {pointColor}
    clusterExpandOnClick={false}
    attribution={[
      '<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
    ]}
    fitViewOnInit={true}
    fitViewOnUpdate={true}
    [options]={{
      scrollWheelZoom: false,
      dragging: false
    }}
    
    />
  {/if}
  
<style lang="postcss" global    >
:root {
    --map-tiles-filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
}

.leaflet-layer,
.leaflet-control-zoom-in,
.leaflet-control-zoom-out,
.leaflet-control-attribution {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}

.leaflet-container {
    background: #000
}
</style>