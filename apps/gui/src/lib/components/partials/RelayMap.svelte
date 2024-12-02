<script lang="ts">
    import { getContext, onMount, tick } from 'svelte';
    import Geolocation from 'svelte-geolocation'
    import { VisSingleContainer, VisTopoJSONMap } from '@unovis/svelte'
    import type { ColorAccessor } from '@unovis/svelte'
    import { WorldMapTopoJSON } from '@unovis/ts/maps'
    import { writable, type Writable } from 'svelte/store';

    import { MapPointLabelPosition, type MapData, type MapLink } from '@unovis/ts'

    type DD = { lat: number; lon: number }

    
    import type { MyRelayPage } from '$lib/core/MRP';
  
    import crosshair from '$lib/assets/images/crosshair.svg';
    import Badge from '$lib/components/ui/badge/badge.svelte';
  
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
  
    // type ColorAccessor<LinkDatum> = ((d: LinkDatum) => string | null) | string;
  
    // const MRP: Writable<MyRelayPage> = getContext(MY_RELAY_PAGE);
    const relayMapPoint: Writable<MapPoint> = writable({});
    const currentUserPoint: Writable<MapPoint> = writable(undefined);
    const currentUserLink: Writable<MapLink> = writable(undefined);
    const monitorMapPoints: Writable<MapPoint[]> = writable([]);
    const monitorLinks: Writable<MapLink[]> = writable([]);
    const hasMonitorData = writable(false);
  
    let dd: DD | undefined = { lat: 0, lon: 0 }
    let data: Writable<MapData<MapArea, MapPoint, MapLink>> = writable({ areas: [] as MapArea[], points: [] as MapPoint[], links: [] as MapLink[] })
    
    let getPosition = false;
    let coords: [number, number] | [] = [];
    export let key: string = ""
    export let id: string = ""
  
    const pointLabel = (d: MapPoint) => d?.label
    const pointLabelPosition = (d: MapPoint): MapPointLabelPosition => d.position || MapPointLabelPosition.Bottom
    const pointLabelTextBrightnessRatio = (d: MapPoint): number => d.brightness || 0.90
    const linkColor = (d: MapLink): ColorAccessor<LinkDatum> => {
      return d?.color ?? 'gray'
    }
  
    const setRelayMapPoint = async(): void => {
      if(!$MRP?.dd?.lat) return 
      hasMonitorData.set(true)
      relayMapPoint.set({ 
        id: 'relay', 
        latitude: $MRP.dd.lat, 
        longitude: $MRP.dd.lon, 
        color: 'blue',
        position: MapPointLabelPosition.Center
      })
    }
  
    const setMonitor = (monitor: MRPMonitor) => {
      const dd = monitor.dd
      const rtt = $MRP.nostr?.monitors?.discoveryEventsFor(monitor.pubkey)?.[0]?.rttOpen || undefined
  
      const point: MapPoint = { 
        id: monitor.geohash, 
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
  
    const setMonitors = async (): void => {
      resetMonitors()
  
      if(!showMonitors) {
        return console.log('no monitor points added to map')
      }
  
      const monitors = $MRP.nostr?.monitors?.all
      for ( const monitor of monitors) {
        setMonitor(monitor)
      }
    }
  
    const updateMapData = () => {
      data.update( (d) => {
        const points = [$relayMapPoint]
        if($currentUserPoint) points.push($currentUserPoint)
        if($monitorMapPoints.length) points.push(...$monitorMapPoints)
  
        const links = []
        if($currentUserLink) links.push($currentUserLink)
        if($monitorLinks.length) links.push(...$monitorLinks)
  
        const areas = []
  
        return {
          areas,
          points,
          links
        }
      });
    }
  
    const resetMonitors = async (): void => {
      monitorMapPoints.set([])
      monitorLinks.set([])
      updateMapData()
    }
  
    const setMapPoints = async (): void => {
      setRelayMapPoint()
      if(monitorVis === 'always') setMonitors()
      updateMapData()
    }
  
    const addUserLocationToMap = (e: CustomEvent): void => {
      // if(!e?.detail?.coords) return
      const {latitude, longitude} = e.detail.coords
      currentUserPoint.set({ 
        id: 'currentUser', 
        latitude, 
        longitude, 
        color: 'red', 
        label: 'you',
        radius: 10
      })
      if($currentUserPoint.id && $relayMapPoint.id) {
        currentUserLink.set({
          source: relayMapPoint.id,
          target: point.id,
          color: 'black',
          cursor: 'crosshair',
          width: 10
        })
      } 
      updateMapData()
    }
  
    $MRP?.$.signal.on('monitors:ready', setMapPoints)
    
    onMount( () => {
      if($MRP.nostr.monitors.isComplete) {
        setMapPoints()
      }
    })
  
    $: monitorVis = $MRP.loader.config.event.blocks?.[key]?.options?.showMonitors
    $: showMonitors = monitorVis === 'always' || monitorVis === 'onhover'
  </script>
  
  <Geolocation
    getPosition="{getPosition}"
    let:coords
    let:loading
    let:success
    let:error
    let:notSupported
    on:position="{(e) => addUserLocationToMap(e)}"
  >
  
  </Geolocation>
  {#if $MRP.nostr.monitors.isComplete && $MRP.nostr.monitors.monitorEvents.size && $hasMonitorData}
  <Block class="relative pt-0" headingClass="py-5 absolute top w-full mb-2" {key}>
    <svelte:fragment slot="title">
      geo
    </svelte:fragment>
    <svelte:fragment slot="content">
      <VisSingleContainer data={$data} style="width:100%;" class="mrp-map-light dark:mrp-map-dark">
        <VisTopoJSONMap 
          topojson={WorldMapTopoJSON} 
          disableZoom={true}
          {pointLabel} 
          {pointLabelTextBrightnessRatio}
        />
      </VisSingleContainer>
      {#if showMonitors}
      <Monitors {key} {setMonitor} {resetMonitors} {updateMapData} />
      {/if}
    </svelte:fragment>
  </Block>
  {/if}
  
  
    <!-- {#if notSupported}
      Your browser does not support the Geolocation API.
    {:else}
      {#if loading}
        Loading...
      {/if}
      {#if success}
        {JSON.stringify(coords)}
      {/if}
      {#if error}
        An error occurred. {error.code} {error.message}
      {/if}
    {/if} -->
  <style>
  </style>