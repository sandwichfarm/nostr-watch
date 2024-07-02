import rcache from "./relaydb.js"
import { chunkArray } from "@nostrwatch/utils"

const HeaderTags = [
  ['d', '']
  ['lastpage', ''],
  ['description', '']
]

const getEventTpl = () => {
  return {
    pubkey: process.env.DAEMON_PUBKEY,
    kind: 30111,
    content: "",
    tags: [],
    created_at: Math.round(Date.now()/1000)
  }
}

const parseATag = ( tag ) => {
  if(tag[0] !== 'a') return null
  const [kind, publisher, id] = tag[1].split(':')
}

const generateRoot = (pagesEvents) => {
  pagesEvents.forEach(event => {
    const tag = ['a', `${event.kind}:${event.pubkey}:${event.tags.filter(tag=>tag[0]==='d').map(tag=>tag[1])}`, `${config.publish_to_relay_url}`]]
  })
}

const generatePages = (relays) => {
  if( typeof relays !== 'array' || !relays?.length || typeof relays[0] !== 'string' ) 
    throw new Error('invalid relay, must be an array of strings')

    const eventTpl = getEventTpl()

  const events = {
    pageDir: {},
    pages: []
  }
  const max_tags = config.max_tags_per_page-HeaderTags.length

  // const relays = rcache.relay.get.all('url').map( relay => relay.url )
  const pages = chunkArray(relays, max_tags)
  const pdTags = []

  pages.forEach( (page, index) => {
    //`d`
    HeaderTags[0][1] = `/${rootSlug}/${pageSlug}/${index+1}`
    //last page
    HeaderTags[1][1] = `/relays/found/${pages.length}`
    const event = {
      ...eventTpl,
      tags: page.map( relay => [ 'r', relay ] )
    }
    events.pages.push(event)
    pdTags.push(['a', `30111:${process.env.DAEMON_PUBKEY}:/${rootSlug}/${pageSlug}/${index+1}`, `${config.publish_to_relay_url}`])
  })

  events.pageDir = {
    ...eventTpl,
    tags: [ 
      ['d', `/${rootSlug}/found`],
      ['about', 'Post-filtered aggregate of unique relays in relay lists. Not guaranteed to be free from error, mistyped relays or impossible URLs.'],
      ...pdTags
    ]
  }

  events.root = {
    ...eventTpl,
    tags: [ 
      ['d', `/${rootSlug}`],
      ['about', 'Post-filtered aggregate of unique relays in relay lists. Not guaranteed to be free from error, mistyped relays or impossible URLs.'],
      ...pdTags
    ]
  }

  return events
}

export default(relays) => {  

  const events = generateEvents(relays)

}