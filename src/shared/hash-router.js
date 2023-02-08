//Shared Methods
const setupNavData = function(navSlug){
    return {
        navActiveContent: "",
        navActiveData: {},
        navItems: [],
        navSlug: navSlug,
        navType: ""
    }
}

const mountNav = function(navType, navItems){
    this.navType = navType
    this.navItems = navItems
    this.store.layout.setNavItems(this.navSlug, this.navItems)
    this.navActiveContent = this.store.layout.getActive(this.navSlug) || this.navItems[0].slug
    //console.log('route', 'setting active content', this.navType, this.navActiveContent)
    this.setActiveContent(this.navActiveContent)
    this.loadNavContent()
    //console.log('route', 'mount', this.navType, this.navSlug, this.navActiveContent, this.navItems, this.navSlug)
}

const setActiveContent = function(slug){
    this.navActiveContent = slug
    this.store.layout.setActive(this.navSlug, slug)
    //console.log('set active content', this.navActiveContent)
    //console.log('route', 'setActiveContent', this.navType, this.navSlug, this.navActiveContent, this.navItems, this.navSlug)
}

const loadNavContent = function(){
    //console.log('route', 'loadNavContent', this.navType, this.navSlug, this.navActiveContent, this.navItems, this.navSlug)

    const route = this.parseHash

    if(!this.routeValid(route[this.navType]))
        return
    
    //console.log(`route from ${this.navType} in ${this.navSlug}`, route[this.navType])

    if(route[this.navType])
        this.setActiveContent(route[this.navType])
    else 
        this.navActiveContent = this.store.layout.getActive(this.navSlug) || this.navItems[0].slug
}

//Computed
const routeValid = function(){
    return (slug) => {
        //console.log('route', 'routeValid', this.navType, this.navSlug, this.navActiveContent, this.navItems)

        if( !(this.navItems instanceof Array) )
            return false

        return this.navItems.map(item => item.slug).includes(slug)
    }
    
}

const contentIsActive = function(){
    return (slug) => slug == this.navActiveContent
}

const parseHash = function(){
    const hashParams = this.$route.hash.replace('#', '').replace(/^\/+/g, '').split('/')
    const result = {}
    result.page = hashParams[0] || null
    result.section = hashParams[1] || null
    result.subsection = hashParams[2] || null
    result.relay = hashParams[1] && hashParams[1].includes('.') ? hashParams[1] : null
    return result
}

export { setupNavData, mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive }