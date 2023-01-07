<template>
  <div :class="mapToggleClass">
    <div class="absolute top-0 right-0 width:100%"></div>
    
    <l-map
      ref="map"
      v-model:zoom="zoom"
      v-model:minZoom="minZoom"
      v-model:maxZoom="maxZoom"
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
        v-for="relay in getRelaysWithGeo.filter( () => this.showCircles )"
        :lat-lng="getLatLng(relay)"
        :key="relay"
        :radius="2"
        :weight="4"
        :color="getColorViz(relay)"
        :fillOpacity="1" >
      </l-circle-marker>
      
      <l-marker
        v-for="relay in getRelaysWithGeo.filter( () => this.showMarkers )"
        :lat-lng="getLatLng(relay)"
        :key="relay"
        :radius="2"
        :weight="4"
        :fillOpacity="1" >
        <l-popup>
          <div class="bg-slate-200 mb-10">
            <div class="text-slate-800 text-3xl w-64 block py-1 text-center">
              <span @click="copy" class="py-1px-2">{{ relay }}</span>
            </div>
          </div>
        </l-popup>
      </l-marker>

    </l-map>
    <button @click="this.handleToggleMap()">
      Open Map
    </button>
  </div>
  
</template>

<script>
import { defineComponent, toRefs } from 'vue'
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LCircleMarker, LMarker, LPopup } from "@vue-leaflet/vue-leaflet"

import { setupStore } from '@/store'

import RelaysLib from '@/shared/relays-lib.js'

export default defineComponent({
  name: "MapSummary",
  components: {
    LMap,
    LTileLayer,
    LCircleMarker,
    LMarker,
    LPopup,
  },
  
  setup(props){
    const {activeSubsectionProp: activeSubsection} = toRefs(props)
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
      activeSubsection: activeSubsection
    }
  },

  data() {
    console.log(this.store.layout.mapIsExpanded, {
      zoom: this.store.layout.mapIsExpanded ? 4 : 2,
      minZoom: this.store.layout.mapIsExpanded ? 4 : 2,
      maxZoom: this.store.layout.mapIsExpanded ? 7 : 2,
      // center: this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [70.41322, -1.219482],
      expanded: false,
      relays: []
    })
    return {
      zoom: this.store.layout.mapIsExpanded ? 4 : 2,
      minZoom: 2,
      maxZoom: 7,
      // center: this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [70.41322, -1.219482],
      expanded: this.store.layout.mapIsExpanded ? true : false,
      relays: []
    };
  }, 
  beforeMount(){
    // this.shiftMap()
  },

 async mounted() {
    this.geo = this.store.relays.geo
    this.store.layout.$subscribe( mutation => {
      console.log('mutation.key', mutation.events.key)
      // if(mutation.events.key == "mapExpanded") 
        // this.refreshMap()
    })

    setTimeout(async () => {
    await this.$refs.map.leafletObject
            .flyTo(
              this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [35.41322, -1.219482], 
              this.store.layout.mapIsExpanded ? 4 : 2
            )
    }, 500)
    console.log(this.$refs.map.leafletObject)
    // this.$refs.map.leafletObject.setView(
    //   this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [35.41322, -1.219482],
    //   4
    // )
      

    // this.refreshMap()    
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
    activeSubsectionProp: {
      type: String,
      default(){
        return ""
      }
    },
  },
  computed: {
    subsectionRelays(){
      return this.sortRelays( this.store.relays.getRelays(this.activeSubsection, this.results ) )
    },
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
      
      return this.store.relays.getAll.filter( relay => this.geo?.[relay] instanceof Object && this.subsectionRelays.includes(relay) )
    },
    isRelayInActiveSubsection(){
      return (relay) => this.store.relays.getRelays(this.activeSubsection, this.results).includes(relay)
    },
    getColorViz(){
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
    showCircles(){
      console.log('map is collapsed', !this.store.layout.mapIsExpanded)
      return !this.store.layout.mapIsExpanded
    },
    showMarkers(){
      console.log('map is expanded', this.store.layout.mapIsExpanded)
      return this.store.layout.mapIsExpanded
    },
    getLat(){
      return (relay) => this.geo[relay].lat
    },
    getLon(){
      return (relay) => this.geo[relay].lon
    },
    mapToggleClass(){
      return {
        'expanded relative min-h-screen': this.store.layout.mapIsExpanded
      }
    },
  },
  methods: Object.assign(RelaysLib, {
    getLatLng(relay){
      return [this.getLat(relay), this.getLon(relay)]
    },
    async handleToggleMap(){
      console.log('toggle state', this.store.layout.mapIsExpanded, this.$refs.map.leafletObject)
      this.store.layout.toggleMap()

      if(this.store.layout.mapIsExpanded)
        this.$refs.map.leafletObject.dragging.enable()
        

      // // this.$refs.map.leafletObject.setZoom();
      // this.$refs.map.leafletObject.setView(
      //   this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [35.41322, -1.219482],
      //   this.store.layout.mapIsExpanded ? 4 : 2
      // )

      await this.$refs.map.leafletObject
            .flyTo(
              this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [35.41322, -1.219482], 
              this.store.layout.mapIsExpanded ? 4 : 2
            )
      
      // await this.$refs.map.leafletObject
      //         .flyTo(
      //           this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [35.41322, -1.219482], 
                
      //         )
      this.refreshMap()
        // .panTo(this.store.layout.mapIsExpanded ? [40.41322, -1.219482] : [70.41322, -1.219482])
      // this.shiftMap()
      console.log('toggle state', this.store.layout.mapIsExpanded)
    },
    resetMapSize(){
      console.dir('reset map size?', this.$refs.map.leafletObject)
      if (this.$refs.map.ready) 
        this.$refs.map.leafletObject.invalidateSize()
    },
    shiftMap(){
      if(!this.store.layout.mapIsExpanded) {
        // this.center = [70.41322, -1.219482]
        this.minZoom = 2
        this.maxZoom = 2
      }
      if(this.store.layout.mapIsExpanded) {
        // this.center = [34.41322, -1.219482]
        this.minZoom = 4
        this.maxZoom = 7
      }
    },
    refreshMap(){
      // this.shiftMap()
      setTimeout(this.resetMapSize(), 1 )
    },
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
  position:absolute;
  z-index:900;
  margin:0;
  padding:0;
  top:0;
  bottom:0;
  width:100%;
  height:100% !important;
}

/* .expanded .leaflet-container {
  height:555px !important;
} */
.leaflet-control-zoom {
  display: none !important;
}

.expanded .leaflet-control-zoom {
  display: block !important;
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
  background-color: white;
}


/* button:hover {
  color:#222;
}

.expanded button .expand,
button .collapse {
  display:none;
}

button .expand,
.expanded button .collapse {
  display:inline;
} */
</style>


<!-- 
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
        v-for="relay in getRelaysWithGeo.filter( () => !this.expanded )"
        :key="`${relay}-circle`"
        :lat-lng="center"
        :radius="2"
        :weight="4"
        :color="markerColor"
        :fillOpacity="1"
        :class="true" >
      </l-circle-marker>

      <l-marker
        v-for="relay in getRelaysWithGeo.filter( () => this.expanded )"
        :key="`${relay}-marker`"
        :lat-lng="getLatLng(relay)">
        <l-popup>
          {{ relay }}
        </l-popup>
      </l-marker>

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
      relays: [],
    };
  },
  setup(props){
    const {activeSubsectionProp: activeSubsection} = toRefs(props)
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
      activeSubsection: activeSubsection
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
    activeSubsectionProp: {
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
    getMarkerClass(relay){
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
      return (relay) => this.store.relays.getRelays(this.activeSubsection, this.results).includes(relay)
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
  position:absolute;
  z-index:900;
  margin:0;
  padding:0;
  top:0;
  bottom:0;
  width:100%;
  height:100% !important;
}

.expanded .leaflet-container {
  height:555px !important;
}
.leaflet-control-zoom {
  display: none !important;
}
.expanded .leaflet-control-zoom {
  display: block !important;
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

/* .expanded button .expand,
button .collapse {
  display:none;
}

button .expand,
.expanded button .collapse {
  display:inline;
} */
</style> -->
