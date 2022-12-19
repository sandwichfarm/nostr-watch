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
      :lat-lng="getLatLng()"
      :radius="3"
      :weight="6"
      :color="getCircleColor(relay)"
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
      const ll = [this.geo[this.relay].lat, this.geo[this.relay].lon]
      this.center = ll
      return ll
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
      return 'black'
    }
  },
  async mounted() {},
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
      zoom: 2,
      center: [40.41322, -1.219482]
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
