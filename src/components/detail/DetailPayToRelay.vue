<template>
  <div id="status" class="block mb-8 px-5 py-8 rounded-lg text-center text-2xl" v-if="isPayToRelay(relay)"> <!--something is weird here with margin-->
  {{ relay }} is a <strong>Paid Relay</strong> and requires an admissions fee
  <span v-if="this.result?.info?.fees?.admission?.[0]">
    of <strong>{{ getPaidRelayAdmission(this.result, true) }}</strong>
  </span>
  for write capabilities. 
  <span v-if="this.result?.info?.fees?.publication?.length">
    <strong>Additionally,</strong> there are publication costs associated with this relay:
    <span v-for="publication in this.result.info.fees.publication" :key="`${result.url}-${publication.amount}-${publication.unit}${publication?.kind ? '-'+publication.kind : ''}`">
      <strong>{{ getPaidRelayPublication(publication, true) }}</strong>
    </span>
  </span>
  <br />
  <a v-if="this.result?.info?.limitation?.payment_required && this.result?.info?.payments_url" class="mt-6 inline-block button text-md bg-black/80 hover:bg-black/90 text-white font-bold py-2 px-4 rounded" :href="this.result?.info?.payments_url">
    <svg id="Layer_1" class="w-5 h-5 align-center inline-block" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" v-if="isPayToRelay(relay)">
      <circle style="fill:#f8991d" class="cls-1" cx="180" cy="180" r="179"/>
      <rect class="fill-white dark:fill-black" x="201.48" y="37.16" width="23.49" height="40.14" transform="translate(21.82 -52.79) rotate(14.87)"/>
      <rect class="fill-white dark:fill-black" x="135.03" y="287.5" width="23.49" height="40.14" transform="translate(83.82 -27.36) rotate(14.87)"/>
      <rect class="fill-white dark:fill-black" x="184.27" y="38.29" width="23.49" height="167.49" transform="translate(364.26 -36.11) rotate(104.87)"/>
      <rect class="fill-white dark:fill-black" x="168.36" y="98.26" width="23.49" height="167.49" transform="translate(402.22 54.61) rotate(104.87)"/>
      <rect class="fill-white dark:fill-black" x="152.89" y="156.52" width="23.49" height="167.49" transform="translate(439.1 142.78) rotate(104.87)"/>
    </svg>
    Pay Admission
  </a>
</div>   
</template>

<script>
import { defineComponent} from 'vue'
import SharedComputed from '@/shared/computed.js'
import RelayMethods from '@/shared/relays-lib.js'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'DetailPayToRelay',

  components: {

  },

  setup(){
    return {
      store: setupStore()
    }
  },

  beforeMount(){
    this.relay = this.result.url
  },

  data(){
    return {
      relay: null
    }
  },

  props: {
    result: {
      type: Object,
      default(){
        return new Object()
      }
    }
  },

  computed: Object.assign(SharedComputed, {

  }),

  methods: Object.assign(RelayMethods, {

  }),

  
})
</script>