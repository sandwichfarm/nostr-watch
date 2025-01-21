<script lang="ts">
    import { getContext, onMount, tick } from 'svelte';
    import Geolocation from 'svelte-geolocation'
    import { VisSingleContainer, VisTopoJSONMap } from '@unovis/svelte'
    import type { ColorAccessor } from '@unovis/svelte'
    import { writable, type Writable } from 'svelte/store';
    import { MapPointLabelPosition, type MapData, type MapLink } from '@unovis/ts'
    import { WorldMapTopoJSON } from '@unovis/ts/maps'
    import type { Monitor, Nip66CheckEvent } from '@nostrwatch/route66/models';
	  import { StateManager } from '@nostrwatch/route66';
    
    export let relay: string;
    export let monitors: Writable<Monitor[]>
    export let checks: Writable<Nip66CheckEvent[]>
    export let aggregate: any;

    let ready: boolean = false;

    type DD = { lat: number; lon: number }
  
    interface LinkDatum {
      color?: string;
    }
  
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
      color?: ColorAccessor<LinkDatum>;
      width?: number;
      cursor?: string;
    }

    const relayMapPoint: Writable<MapPoint> = writable();
    const currentUserPoint: Writable<MapPoint> = writable();
    const currentUserLink: Writable<MapLink> = writable();
    const monitorMapPoints: Writable<MapPoint[]> = writable([]);
    const monitorLinks: Writable<MapLink[]> = writable([]);
    const hasMonitorData = writable(false);
  
    let dd: DD | undefined = { lat: 0, lon: 0 }
    let data: Writable<MapData<MapArea, MapPoint, MapLink>> = writable({ areas: [] as MapArea[], points: [] as MapPoint[], links: [] as MapLink[] })
    
    let getPosition = false;
    let coords: [number, number] | [] = [];
  
    const pointLabel = (d: MapPoint) => d?.label
    const pointLabelPosition = (d: MapPoint): MapPointLabelPosition => d.position || MapPointLabelPosition.Bottom
    const pointLabelTextBrightnessRatio = (d: MapPoint): number => d.brightness || 0.90
    const linkColor = (d: MapLink): ColorAccessor<LinkDatum> => {
      return d?.color ?? 'gray'
    }
  
    const setRelayMapPoint = async(): Promise<void> => {
      ////console.log('relay aggregate', aggregate)
      if(!aggregate?.dd?.lat) return console.warn('Reglay aggregate does not have any geodata.')
      relayMapPoint.set({ 
        id: 'relay', 
        latitude: aggregate.dd.lat, 
        longitude: aggregate.dd.lon, 
        color: 'blue',
        position: MapPointLabelPosition.Center
      })
    }
  
    const setMonitor = (monitor: Monitor) => {
      if(!monitor?.registration) return;
      const { dd } = monitor.registration
      const monitorCheck: Nip66CheckEvent | undefined = $checks.find( check => check.pubkey === monitor.pubkey )
      if(!monitorCheck) return //console.warn(`${monitor.pubkey} could not find check data...`)
      const rtt = monitorCheck?.rtt || undefined

      ////console.log('monitor data', monitor, monitor.pubkey, dd, monitorCheck, rtt)
      if(!dd || !rtt || !monitorCheck) return //console.warn(`${monitor.pubkey} could not find data...`)
  
      const point: MapPoint = { 
        id: monitor.pubkey, 
        latitude: dd.lat, 
        longitude: dd.lon, 
        color: 'gray', 
        label: `${rtt}ms`, 
        radius: 3, 
        brightness: 0.1 
      }
  
      const link: MapLink = {
        source: $relayMapPoint.id || $relayMapPoint, 
        target: point.id || point, 
        color: 'black', 
        cursor: 'crosshair'
      }
  
      $monitorMapPoints.push(point)
      $monitorLinks.push(link)
  
      monitorMapPoints.set($monitorMapPoints)
      monitorLinks.set($monitorLinks)
    }
  
    const setMonitors = async (): Promise<void> => {
      resetMonitors()
      for ( const monitor of $monitors) {
        setMonitor(monitor)
      }
    }
  
    const updateMapData = (): void => {
      if(!$relayMapPoint && $monitorMapPoints.length === 0) return console.warn('No point data available.')
      data.update( (d) => {
        const points = [$relayMapPoint]
        if($currentUserPoint) points.push($currentUserPoint)
        if($monitorMapPoints.length) points.push(...$monitorMapPoints)
  
        const links = []
        if($currentUserLink) links.push($currentUserLink)
        if($monitorLinks.length) links.push(...$monitorLinks)
  
        const areas: any[] = []

        ////console.log(areas, points, links)
  
        return {
          areas,
          points,
          links
        }
      });
    }
  
    const resetMonitors = async (): Promise<void> => {
      monitorMapPoints.set([])
      monitorLinks.set([])
      ////console.log(updateMapData())
    }
  
    const setMapPoints = async (): Promise<void> => {
      setRelayMapPoint()
      setMonitors()
      updateMapData()
    }
  
    const addUserLocationToMap = (e: CustomEvent): void => {
      const {latitude, longitude} = e.detail.coords
      currentUserPoint.set({ 
        id: 'currentUser', 
        latitude, 
        longitude, 
        color: 'red', 
        label: 'you',
        radius: 10
      })
      ////console.log(currentUserPoint)
      if($currentUserPoint.id && $relayMapPoint.id) {
        currentUserLink.set({
          source: $relayMapPoint.id,
          target: $currentUserPoint.id,
          color: 'black',
          cursor: 'crosshair',
          width: 10
        })
      } 
      updateMapData()
    }

    const init = () => {
      ////console.log('RelayMap Hydrated')
      ready = true
      setMapPoints()
    }

    StateManager.once(`${relay}:hydrated`, init)

    const styles = {
      light: {
        '--vis-map-feature-color': '#dce3eb',
        '--vis-map-boundary-color': '#ffffff',
        '--vis-map-point-label-text-color-dark': '#5b5f6d',
        '--vis-map-point-label-text-color-light': '#fff',
        '--vis-map-point-label-font-weight': '600',
        '--vis-map-point-label-font-size': '12px',
        // '--vis-map-point-label-font-family': '', // Add a value if needed
      },
      dark: {
        '--vis-map-feature-color': '#5b5f6d',
        '--vis-map-boundary-color': '#2a2a2a',
        '--vis-map-point-label-text-color-dark': '#fff',
        '--vis-map-point-label-text-color-light': '#5b5f6d',
      }
    };

    
    onMount(init)

    monitors.subscribe(init)
    checks.subscribe(init)
  </script>

  {#if ready === true}
    <div class="relative pt-0">
      <VisSingleContainer data={$data} class="map-light dark:map-dark w-full h-[500px]">
        <VisTopoJSONMap 
          topojson={WorldMapTopoJSON} 
          disableZoom={true}
          {pointLabel} 
          {pointLabelTextBrightnessRatio}
        />
      </VisSingleContainer>
    </div>
    <!-- {/if} -->
  {/if}
  
  
    
  <style lang="postcss" global>
  .map-light {
    @apply bg-none;
    --vis-map-feature-color: rgba(255, 255, 255, 0.1);
    --vis-map-boundary-color: rgba(255, 255, 255, 0.2);
    --vis-map-point-label-text-color-dark: rgba(255, 255, 255, 0.8);
    --vis-map-point-label-text-color-light: rgba(255, 255, 255, 0.8);
    --vis-map-point-label-font-weight: 600;
    --vis-map-point-label-font-size: 10px;
  }

  .map-dark {
    @apply bg-none;
    --vis-map-feature-color: #5b5f6d;
    --vis-map-boundary-color: #2a2a2a;
    --vis-map-point-label-text-color-dark: #fff;
    --vis-map-point-label-text-color-light: #5b5f6d;
  }
  </style>
  