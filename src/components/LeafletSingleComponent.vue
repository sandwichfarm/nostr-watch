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
      :lat-lng="getLatLng()"
      :radius="3"
      :weight="6"
      :color="getCircleColor(relay)"
      :fillOpacity="1"
      :class="relay"
      >
      <l-popup>
        {{ relay }}
      </l-popup>
    </l-circle-marker>
  </l-map>

</template>
<script>
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LCircleMarker, LPopup } from "@vue-leaflet/vue-leaflet";
export default {
  components: {
    LMap,
    LTileLayer,
    LCircleMarker,
    LPopup
  },
  methods: {
    getLatLng(){
      console.log("geo", this.relay, this.geo[this.relay].lat, this.geo[this.relay].lon)
      // if (!geo[this.relay]) console.log("no geo?", geo, this.relay, geo[this.relay])
      return [this.geo[this.relay].lat, this.geo[this.relay].lon]
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
  async mounted() {
    console.log('GEO', this.geo[this.relay])
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
      zoom: 2
    };
  },
};
</script>

<style>
.leaflet-container {
  margin:0;
  height:250px !important;
  width:1000%;

}
.leaflet-control-zoom {
  display: none !important;
}
</style>
