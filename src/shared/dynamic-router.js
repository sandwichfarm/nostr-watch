
import RelaysHome from '@/components/relays/pages/RelaysHome.vue'
// import ByStatus from '../pages/ByStatus.vue'
import RelaysSingle from '@/components/relays/pages/RelaysSingle.vue'

export const setRouterPaths = function(page, navItems){
    let component 
    if(page == 'relays')
        component = RelaysHome
    
    navItems.forEach( item => {
      this.$route.push({
        name: item.name,
        component: component
      })
    })
  }