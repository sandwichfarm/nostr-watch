<template>
  <div :class="mapToggleClass">
    
    <l-map
      ref="map"
      v-model:zoom="zoom"
      :center="[34.41322, -1.219482]"
      :minZoom="zoom"
      :maxZoom="zoom"
      :zoomControl="false"
      :dragging="false"
      :touchZoom="false"
      :scrollWheelZoom="false"
      :doubleClickZoom="false"
      >

      <l-tile-layer
        url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
        attribution='<a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <l-circle-marker
        v-for="relay in getRelaysWithGeo"
        :lat-lng="getLatLng(relay)"
        :key="relay"
        :radius="2"
        :weight="4"
        :color="getCircleColor(relay)"
        :fillOpacity="1" >
      </l-circle-marker>
    </l-map>

    <button @click="toggleMap">
      <span class="expand">expand</span> 
      <span class="collapse">collapse</span>
      map
    </button>
  </div>
  
</template>

<script>
import { defineComponent, toRefs } from 'vue'
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LCircleMarker } from "@vue-leaflet/vue-leaflet"
import { setupStore } from '@/store'

import RelaysLib from '@/shared/relays-lib.js'

export default defineComponent({
  name: "MapSummary",
  components: {
    LMap,
    LTileLayer,
    LCircleMarker,
  },
  data() {
    return {
      zoom: 2,
      center: [40.41322, -1.219482],
      expanded: false,
      relays: []
    };
  },
  setup(props){
    const {activePageItemProp: activePageItem} = toRefs(props)
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
      activePageItem: activePageItem
    }
  },
  mounted() {
    this.geo = this.store.relays.geo
  },
  beforeUnmount(){
    console.log('beforeUnmount', '$refs', this.$refs)
  },
  unmounted(){
    console.log('unmounted', '$refs', this.$refs)
    delete this.$refs.map
  },
  updated(){},
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
    activePageItemProp: {
      type: String,
      default(){
        return ""
      }
    },
  },
  computed: {
    getCircleClass(relay){
      console.log('the relay', relay)
      return (relay) => {
        return {
          visible: this.isRelayInActiveSubsection(relay),
          hidden: !this.isRelayInActiveSubsection(relay),
          [relay]: true
        }
      }
    },
    getRelaysWithGeo(){
      return this.store.relays.getAll.filter( relay => this.geo?.[relay] instanceof Object )
    },
    isRelayInActiveSubsection(){
      return (relay) => this.store.relays.getRelays(this.activePageItem, this.results).includes(relay)
    },
    getCircleColor(){
      return (relay) => {
        if(!this.isRelayInActiveSubsection(relay))
          return 'transparent'

        if(this.results[relay]?.aggregate == 'public')
          return '#00AA00'

        if(this.results[relay]?.aggregate == 'restricted')
          return '#FFA500'

        if(this.results[relay]?.aggregate == 'offline')
          return '#FF0000'
        
        return 'transparent'
      }
    },
    getLat(){
      return (relay) => this.geo[relay].lat
    },
    getLon(){
      return (relay) => this.geo[relay].lon
    },
    mapToggleClass(){
      return {
        expanded: this.expanded
      }
    },
  },
  methods: Object.assign(RelaysLib, {
    getLatLng(relay){
      return [this.getLat(relay), this.getLon(relay)]
    },
    toggleMap(){
      this.expanded = !this.expanded
      setTimeout(() => { this.resetMapSize() }, 1)
    },
    resetMapSize(){
      if (this.$refs.map.ready) 
        this.$refs.map.leafletObject.invalidateSize()
    }
  }),
  
});


</script>

<style>
/* :root {
    --map-tiles-filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
}

@media (prefers-color-scheme: dark) {
    .leaflet-tile {
        filter:var(--map-tiles-filter, none);
	}
} */
</style>

<style scoped>


.leaflet-container {
  position:relative;
  z-index:900;
  margin:0;
  padding:0;
  height:250px !important;
  width:100%;
/*  -webkit-transition:height 300ms ease-in-out;
  -moz-transition:height 300ms ease-in-out;
  -o-transition:height 300ms ease-in-out;
  transition:height 300ms ease-in-out;*/
}
.expanded .leaflet-container {
  height:555px !important;
}
.leaflet-control-zoom {
  display: none !important;
}

button {
  position: relative;
  z-index:901;
  top: -30px;
  background:rgba(255,255,255,0.5);
  border:0;
  padding:3px 6px;
  color:#777;
  cursor:pointer;
}

button:hover {
  color:#222;
}

.expanded button .expand,
button .collapse {
  display:none;
}

button .expand,
.expanded button .collapse {
  display:inline;
}
</style>
