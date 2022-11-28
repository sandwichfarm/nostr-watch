<template>
  <l-map ref="map" v-model:zoom="zoom" :center="[47.41322, -1.219482]">
    <l-tile-layer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      layer-type="base"
      name="OpenStreetMap"
    ></l-tile-layer>

    <l-marker v-for="([relay, result]) in Object.entries(results)" :lat-lng="result.geo.latlng" draggable>
      <l-popup>
        {{ result.uri }}
      </l-popup>
    </l-marker>
  </l-map>
</template>
<script>
import "leaflet/dist/leaflet.css"
import { LMap, LTileLayer, LMarker } from "@vue-leaflet/vue-leaflet";
export default {
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LPopup,
  },
  data() {
    return {
      markers: {
        type: Object,
        default(){
          return {}
        }
      }
    };
  },
};
</script>

<style></style>
