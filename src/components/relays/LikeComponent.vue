<script>
console.log(window.nostr)
// func make_like_event(pubkey, privkey: String, liked: NostrEvent) => {
//     { 
//         content: "+", 
//         pubkey: pubkey, 
//         kind: 7, 
//         tags: tags 
//     }

// }
//     NostrEvent {
//     var tags: [[String]] = liked.tags.filter { 
//     	tag in tag.count >= 2 && (tag[0] == "e" || tag[0] == "p") 
//     }
//     tags.append(["e", liked.id])
//     tags.append(["p", liked.pubkey])
//     let ev = NostrEvent(content: "+", pubkey: pubkey, kind: 7, tags: tags)
//     ev.calculate_id()
//     ev.sign(privkey: privkey)
//     return ev
// }
</script>