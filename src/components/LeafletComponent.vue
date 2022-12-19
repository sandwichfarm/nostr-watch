<template>
  <div :class="mapToggleClass()">
    <l-map
      ref="map"
      v-model:zoom="zoom"
      :center="[34.41322, -1.219482]"
      :minZoom="zoom"
      :maxZoom="zoom"
      :zoomControl="false"
      >

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

      <l-circle-marker
        v-for="([relay, entry]) in Object.entries(geo)"
        :lat-lng="getLatLng(entry)"
        :key="relay"
        :radius="3"
        :weight="6"
        :color="getCircleColor(relay)"
        :fillOpacity="1"
        :class="relay"
        >
  <!--       <l-popup>
          {{ relay }}
          meopw
        </l-popup> -->
      </l-circle-marker>
    </l-map>
    <button @click="toggleMap">
      <span class="expand">expand</span> 
      <span class="collapse">collapse</span>
    map</button>
  </div>
  
</template>

<script>
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LCircleMarker } from "@vue-leaflet/vue-leaflet"

export default {
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
    };
  },
  methods: {
    mapHeight(){
      return this.expanded ? "500px" : "250px"
    },
    getLatLng(geo){
      return [geo.lat, geo.lon]
    },
    getCircleColor(relay){

      if(this.result[relay]?.aggregate == 'public') {
        return '#00AA00'
      }
      else if(this.result[relay]?.aggregate == 'restricted') {
        return '#FFA500'
      }
      else if(this.result[relay]?.aggregate == 'offline') {
        return '#FF0000'
      }
      return 'transparent'
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
  },
  async mounted() {
    
  },
  props: {
    geo: {
      type: Object,
      default(){
        return {}
      }
    },
    result: {
      type: Object,
      default(){
        return {}
      }
    },
  },
  
};


</script>

<style scoped>
.leaflet-container {
  position:relative;
  z-index:1000;
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
  z-index:1001;
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
