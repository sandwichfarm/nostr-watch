<template>

  <l-map
    ref="map"
    v-model:zoom="zoom"
    :center="[47.41322, -1.219482]"
    :minZoom="zoom"
    :maxZoom="zoom"
    :zoomControl="false"
    style="height:50vh"
    >

    <l-tile-layer
      url="http://{s}.tile.osm.org/{z}/{x}/{y}.png"
      layer-type="base"
      name="OpenStreetMap"
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
      >
      <l-popup>
        {{ relay }}
        meopw
      </l-popup>
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
    LCircleMarker,
  },
  methods: {
    getLatLng(geo){
      console.log('meow', [geo.lat, geo.lon])
      return [geo.lat, geo.lon]
    },
    getCircleColor(relay){

      if(this.result[relay]?.aggregate == 'public') {
        console.log('woof', relay, this.result[relay]?.aggregate)
        return '#00AA00'
      }
      else if(this.result[relay]?.aggregate == 'restricted') {
        console.log('woof', relay, this.result[relay]?.aggregate)
        return '#FFA500'
      }
      else if(this.result[relay]?.aggregate == 'offline') {
        console.log('woof', relay, this.result[relay]?.aggregate)
        return '#FF0000'
      }
      return 'transparent'
    }
  },
  async mounted() {
    console.log('GEO', Object.entries(this.geo))
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
  data() {
    return {
      zoom: 2
    };
  },
};
</script>

<style>
.leaflet-container {
  margin-top:37px;
  height:250px !important;
}
.leaflet-control-zoom {
  display: none !important;
}
</style>
