<script lang="ts">
  import { onMount } from 'svelte'
  import Geolocation from 'svelte-geolocation'
  import { VisSingleContainer, VisTopoJSONMap } from '@unovis/svelte'
  import type { ColorAccessor } from '@unovis/svelte'
  import { writable, type Writable, get } from 'svelte/store';
  import { MapPointLabelPosition, type MapData, type MapLink } from '@unovis/ts'
  import { WorldMapTopoJSON } from '@unovis/ts/maps'
  import type { Monitor, Nip66CheckEvent } from '@nostrwatch/route66/models';
  import { StateManager } from '@nostrwatch/route66';

  export let relay: string;
  export let monitors: Writable<Monitor[]>;
  export let checks: Writable<Nip66CheckEvent[]>;
  export let aggregate: any;

  let ready: boolean = false;

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

  // (★) No reason to re-declare MapLink here if it’s imported from @unovis/ts
  //     Just ensure we keep the type consistent with your usage
  type MapLink = {
    source: MapPoint | string;
    target: MapPoint | string;
    color?: string | ColorAccessor<any>;
    width?: number;
    cursor?: string;
  }

  const relayMapPoint = writable<MapPoint | undefined>();
  const currentUserPoint = writable<MapPoint | undefined>();
  const currentUserLink = writable<MapLink | undefined>();
  const monitorMapPoints = writable<MapPoint[]>([]);
  const monitorLinks = writable<MapLink[]>([]);

  let data = writable<MapData<MapArea, MapPoint, MapLink>>({
    areas: [],
    points: [],
    links: [],
  });

  // (★) Single init call: we’ll rely on onMount + hydrated. 
  //     Remove repeated calls from store subscription for clarity.
  onMount(() => {
    StateManager.once(`${relay}:hydrated`, init);
    init();
  });

  // (★) If you REALLY need to react to changes in monitors/checks, 
  //     do a partial update. But do NOT re-run init (which resets everything).
  monitors.subscribe((val) => {
    if (ready && val?.length) {
      setMonitors();
      updateMapData();
    }
  });
  checks.subscribe((val) => {
    if (ready && val?.length) {
      setMonitors();
      updateMapData();
    }
  });

  // (★) Only define user’s location if needed. If you have a separate user-loc flow, that’s fine.
  //     Otherwise, you can let the user pass in lat/lon or do a geolocation subscription, etc.
  function setUserLocation(lat: number, lon: number) {
    currentUserPoint.set({ 
      id: 'currentUser', 
      latitude: lat, 
      longitude: lon, 
      color: 'red', 
      label: 'you',
      radius: 10,
    });
    // (★) Only create link if relay is valid
    const rmp = get(relayMapPoint);
    if (rmp?.latitude !== undefined && rmp?.longitude !== undefined) {
      currentUserLink.set({
        source: rmp.id,
        target: 'currentUser',
        color: 'black',
        cursor: 'crosshair',
        width: 10,
      });
    }
    updateMapData();
  }

  // (★) If you have the geolocation component, call setUserLocation in the event
  const addUserLocationToMap = (e: CustomEvent) => {
    const { latitude, longitude } = e.detail.coords;
    setUserLocation(latitude, longitude);
  };

  async function init() {
    // console.log('init called');
    ready = true;
    setRelayMapPoint();
    // (★) If monitors/checks are already loaded, we can set them here
    setMonitors();
    updateMapData();
  }

  function setRelayMapPoint() {
    const lat = aggregate?.dd?.lat;
    const lon = aggregate?.dd?.lon;
    if (lat == null || lon == null) {
      // Relay location not known => set to undefined
      relayMapPoint.set(undefined);
    } else {
      relayMapPoint.set({
        id: 'relay',
        latitude: lat,
        longitude: lon,
        color: 'blue',
        position: MapPointLabelPosition.Center,
      });
    }
  }

  function setMonitors() {
    // Clear existing
    monitorMapPoints.set([]);
    monitorLinks.set([]);

    const monitorsVal = get(monitors) || [];
    const checksVal = get(checks) || [];
    const rmp = get(relayMapPoint);

    // For each monitor, create a point
    const newPoints: MapPoint[] = [];
    const newLinks: MapLink[] = [];

    for (const m of monitorsVal) {
      const dd = m?.registration?.dd;
      if (!dd) continue;

      // find the check event for RTT
      const monitorCheck = checksVal.find((c) => c.pubkey === m.pubkey);
      if (!monitorCheck) continue;

      const rtt = monitorCheck?.rtt;
      if (!rtt) continue;

      // create point
      const p: MapPoint = {
        id: m.pubkey,
        latitude: dd.lat,
        longitude: dd.lon,
        color: 'gray',
        label: `${rtt}ms`,
        radius: 3,
        brightness: 0.1,
      };
      newPoints.push(p);

      // only create link if relay is valid
      if (rmp && rmp.latitude !== undefined && rmp.longitude !== undefined) {
        newLinks.push({
          source: rmp.id!,
          target: p.id!,
          color: 'black',
          cursor: 'crosshair',
        });
      }
    }

    monitorMapPoints.set(newPoints);
    monitorLinks.set(newLinks);
  }

  function updateMapData() {
    const rmp = get(relayMapPoint);
    const ump = get(currentUserPoint);
    const ulk = get(currentUserLink);
    const mmps = get(monitorMapPoints);
    const mlinks = get(monitorLinks);

    // Build final arrays
    const points: MapPoint[] = [];
    const links: MapLink[] = [];
    const areas: MapArea[] = [];

    // (★) If relay is valid, add it
    if (rmp && rmp.latitude != null && rmp.longitude != null) {
      points.push(rmp);
    }

    // user point (if set)
    if (ump) {
      points.push(ump);
    }

    // monitors
    if (mmps?.length) {
      points.push(...mmps);
    }

    // links (only if relay is valid)
    if (rmp && rmp.latitude != null && rmp.longitude != null) {
      if (ulk) links.push(ulk);
      if (mlinks?.length) links.push(...mlinks);
    }

    // (★) Update the store
    data.set({ areas, points, links });
  }

  // Accessors used by VisTopoJSONMap
  const pointLabel = (d: MapPoint) => d?.label;
  const pointLabelTextBrightnessRatio = (d: MapPoint): number => d.brightness || 0.9;

</script>

{#if ready}
  <div class="relative pt-0">
    <VisSingleContainer 
      data={$data} 
      class="map-light dark:map-dark w-full h-[500px]"
    >
      <VisTopoJSONMap 
        topojson={WorldMapTopoJSON} 
        disableZoom={true}
        {pointLabel}
        {pointLabelTextBrightnessRatio}
      />
    </VisSingleContainer>
  </div>
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
