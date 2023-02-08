<template>
  <div :class="mapToggleClass()" class="relative  min-h-screen">
    <l-map
      ref="map"
      v-model:zoom="zoom"
      :center="[34.41322, -1.219482]"
      :minZoom="minZoom"
      :maxZoom="maxZoom"
      >
      <!-- :maxBounds="[34.41322, -1.219482]"
      :maxBoundsViscosity="1.0" -->
      
      <l-tile-layer
        url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
        layer-type="base"
        name="OpenStreetMap"
        attribution='<a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      
      <!-- <l-marker v-for="([relay, result]) in Object.entries(geo)" :lat-lng="getLatLng(result)" :key="relay">
        <l-popup>
          {{ relay }}
        </l-popup>
      </l-marker> -->

      <l-marker
        v-for="relay in getRelaysWithGeo"
        :lat-lng="getLatLng(relay)"
        :key="relay"
        :radius="2"
        :weight="4"
        :color="getCircleColor(relay)"
        :fillOpacity="1" >
        <l-popup>
          {{ relay }}
        </l-popup>
      </l-marker>
    </l-map>
  </div>
  



</template>

<script>
import { defineComponent, toRefs } from 'vue'
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LMarker, LPopup } from "@vue-leaflet/vue-leaflet"
import { setupStore } from '@/store'
import RelaysLib from '@/shared/relays-lib.js'

export default defineComponent({
  name: "MapInteractive",
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LPopup,
  },
  data() {
    return {
      minZoom: 4,
      maxZoom: 7,
      center: [70.41322, -1.219482],
      expanded: false,
      relays: [],
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
    //console.log('results', this.results)
    this.geo = this.store.relays.geo
  },
  updated(){},
  unmounted(){
    //console.log('unmounted', '$refs', this.$refs)
    delete this.$refs.map
  },
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
    getCircleClass(){
      //console.log('the relay', relay)
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
  },
  methods: Object.assign(RelaysLib, {
    mapHeight(){
      return this.expanded ? "500px" : "250px"
    },
    getLatLng(relay){
      //console.log('geo', relay, [this.geo.lat, this.geo.lon])
      return [this.geo[relay].lat, this.geo[relay].lon]
    },
    getCircleColor(relay){
      if(!this.isRelayInActiveSubsection(relay))
        return 'transparent'

      if(this.results[relay]?.aggregate == 'public')
        return '#00AA00'

      if(this.results[relay]?.aggregate == 'restricted')
        return '#FFA500'

      if(this.results[relay]?.aggregate == 'offline')
        return '#FF0000'
      
    },

    isRelayInActiveSubsection(relay){
      //console.log(this.store.relays.getRelays(this.activePageItem).length, this.activePageItem, relay, this.store.relays.getRelays(this.activePageItem).includes(relay))
      return this.store.relays.getRelays(this.activePageItem, this.results).includes(relay)
    },
    toggleMap(){
      this.expanded = !this.expanded
      setTimeout(() => { this.resetMapSize() }, 1)
    },
    mapToggleClass(){
      return {
        expanded: this.expanded
      }
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
  position:absolute;
  z-index:900;
  margin:0;
  padding:0;
  top:0;
  bottom:0;
  width:100%;
  height:100% !important;
}
</style>
