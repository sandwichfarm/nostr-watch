<template>

  <l-map
    ref="map"
    v-model:zoom="zoom"
    :center="center"
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
      :lat-lng="center"
      :radius="2"
      :weight="4"
      :color="getCircleColor()"
      :fillOpacity="1"
      :class="relay"
      >
      <!-- <l-popup>
        {{ relay }}
      </l-popup> -->
    </l-circle-marker>
  </l-map>

</template>
<script>
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LCircleMarker } from "@vue-leaflet/vue-leaflet";
export default {
  components: {
    LMap,
    LTileLayer,
    LCircleMarker
  },
  methods: {
    getLatLng(){
      if(!this.geo?.lat || !this.geo?.lon)
        return

      const ll = [this.geo?.lat, this.geo?.lon]
      this.center = ll

      console.log('lat long', this.relay, ll)

      return ll
    },
    getCircleColor(){

      const relay = this.relay

      //console.log(this.geo?.lat, this.geo?.lon)

      if(!this.geo?.lat || !this.geo?.lon)
        return 'transparent'

      if(this.result[relay]?.aggregate == 'public') {
        return '#00AA00'
      }
      else if(this.result[relay]?.aggregate == 'restricted') {
        return '#FFA500'
      }
      else if(this.result[relay]?.aggregate == 'offline') {
        return '#FF0000'
      }

      return 'black'
      
    }
  },
  async beforeMount() {
    console.log(this.geo)
    this.center = this.getLatLng()
    this.markerColor = this.getCircleColor()
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
    relay: {
      type: String,
      default(){
        return ""
      }
    },
  },
  data() {
    return {
      zoom: 5,
      center: [40.41322, -1.219482],
      markerColor: 'transparent'
    };
  },
};
</script>

<style>
.leaflet-container {
  margin:0;
  height:250px !important;
  width:100%;
}
.leaflet-control-zoom {
  display: none !important;
}
</style>
