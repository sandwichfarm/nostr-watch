<script lang="ts">
    import { onMount } from 'svelte';
    import { VisSingleContainer, VisTopoJSONMap } from '@unovis/svelte'
    import { MapPointLabelPosition, type ColorAccessor, type MapData } from '@unovis/ts'
	import { derived, readable, type Readable } from 'svelte/store';
	import { points } from '@unovis/ts/components/topojson-map/style';
	import { WorldMapTopoJSON } from '@unovis/ts/maps';
    
    export let data: Readable<any[]>;
    let hydrated = false 
    
    const mapData: Readable<MapData<MapArea, MapPoint, MapLink>> = derived(data, ($data) => {
        // if(hydrated){
        //     return $data;
        // }
        if (!$data) {
            return { areas: [], points: [], links: [] }
        }

        const points = $data
            .filter((datum: any) => datum?.dd)
            .map((datum: any) => {
                return {
                    id: datum.relay.toString() ?? '',
                    latitude: datum.dd.lat,
                    longitude: datum.dd.lon,
                    label: '',
                    color: 'blue',
                    radius: 10,
                    position: MapPointLabelPosition.Center,
                }
            })

        hydrated = true;
        return { areas: [], points, links: [] }
    })

    type MapPoint = {
        id?: string;
        latitude: number;
        longitude: number;
        color?: string;
        label?: string;
        radius?: number;
        position?: MapPointLabelPosition;
        brightness?: number;
    }

    type MapArea = {
        id: string;
        name: string;
        color: string;
        cursor: string;
    }

    type MapLink = {
        source: MapPoint | string;
        target: MapPoint | string;
        color?: string | ColorAccessor<any>;
        width?: number;
        cursor?: string;
    }

    const pointLabel = (d: MapPoint) => d?.label;
    const pointLabelTextBrightnessRatio = (d: MapPoint): number => d.brightness || 0.9;
</script>

{#if $mapData && $mapData.points && $mapData.points.length > 0}
    <VisSingleContainer
      data={$mapData} 
      class="map-light dark:map-dark w-full h-[500px]"
    >
      <VisTopoJSONMap
        topojson={WorldMapTopoJSON} 
        disableZoom={true}
        heatmapMode={true}
        heatmapModeBlurStdDeviation={4}
        {pointLabel}
        {pointLabelTextBrightnessRatio}
      />
    </VisSingleContainer>
    {:else}
    <p>Loading map data...</p>
  {/if}
  <style lang="postcss" global>
    .body {}
  </style>



