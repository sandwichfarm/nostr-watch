<template>
  <!-- {{ store.prefs.migration }} -->
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit">Welcome</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'

import SharedComputed from '@/shared/computed.js'

export default defineComponent({
  name: 'MigrationsJob',
  components: {},
  data() {
    return {
      slug: 'migrations', //REMEMBER TO CHANGE!!!
      currentMigration: 1
    }
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  created(){
    clearInterval(this.interval)
  },
  unmounted(){
    clearInterval(this.interval)
  },
  beforeMount(){},
  mounted(){
    this.Migrations(this.name)
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign({
    Migrations(force){
      const self = this
      console.log('invalidate:', self.store.prefs.migration >= this.currentMigration)
      if( self.store.prefs.migration >= this.currentMigration && !force ) 
        return
      this.queueJob(
        self.slug, 
        async () => {
          console.log('is function', !(self?.[`migration${this.currentMigration}`] instanceof Function))
          if( !(self?.[`migration${this.currentMigration}`] instanceof Function) )
            return
          await self[`migration${this.currentMigration}`]()
          this.store.jobs.completeJob(this.slug)
        },
        true
      )
    },
    async migration1(){
      await this.storageClearAll()
    },
    timeUntilRefresh(){
      return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
    },
    timeSinceRefresh(){
      return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
    },
  }, RelayMethods),

  props: {},
  
})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

