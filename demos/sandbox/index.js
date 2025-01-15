// import { torfetch } from '@sandwichfarm/torfetch';

// console.log(torfetch)
// process.exit()

// import { TorWebSocket } from "@nostrwatch/nocap-websocket-adapter-default";

// const relays = [
//   'ws://cuqjqfuqxqk4ktcpbi57fihcp3qbrbno4ztnfxxm6fquuzhkni6tsvyd.onion/',
//   'ws://j2tmmli3qu5sxtxv4wpx7vvdqyrw6d6oa3u4pp5qyiq4ishspdk5psad.onion:4869/',
//   'ws://lik2ypstv2nvbyfbhzve73p26boufugp3ygnwj2pkyob6avfhtlkxxid.onion/',
// ];

// const socksProxy = 'socks5://127.0.0.1:9050';
// const timeoutMs = 60*1000; // 10 seconds

// async function checkRelays() {
//   const checks = relays.map(async (url) => {
//     try {
//       const ws = await TorWebSocket(url, socksProxy, timeoutMs);
//       ws.on('open', () => {
//         console.log(`✅ ${url} is online.`);
//         ws.close(); 
//         process.exit()
//       })

//       ws.on('error', (error) => {
//         console.error(`❌ ${url} is offline or encountered an error: ${error.message}`);
//       })
      
//     } catch (error) {
//       console.error(`❌ ${url} is offline or encountered an error: ${error.message}`);
//     }
//   });

//   await Promise.all(checks);
// }

import { Nocap } from "@nostrwatch/nocap";
import NocapAdapters from "@nostrwatch/nocap-every-adapter-default";

const shuffle = (array) => {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

const run = async () => {
  shuffle(relays)
  for(const relay of relays) {
    try {
      const nocap = new Nocap(relay, { timeout: { open: 5000, read: 5000, info: 5000 } });
      nocap.useAdapters(NocapAdapters);
      const result = await nocap.check(['open', 'read']).catch(console.warn);
      if(result.open.data === false) {
        console.log(`FAIL: ${relay}`)
      } else {  
        console.log(`WIN: ${relay}`)
        console.log(result)
        console.log('---------------------------------')
      }
      
      // process.exit()
    }
    catch(e){
      console.log(`${relay} didn't work`)
    }
  }
}



// const relays = ['wss://i2uwfnqdfmfoahdwbs7nq55ss5l2sk7xigz6bbnyqv4njvcqujalxbyd.onion:4869']

const relays = ['ws://nfrelay6saohkmipikquvrn6d64dzxivhmcdcj4d5i7wxis47xwsriyd.onion/','ws://5yl4ixvx4s4zeewujriz4ytgr34w3dlql6u3xsljhlmtq3pdhfqewmyd.onion/','ws://vdlw3muqpoid5rfodvikdzb5qrtwsit6kw7yl24yjib2cfhbrzwi5had.onion:4869/','ws://7oqraq7546vmfhqn3bkvsbfpe2nbo4kzgddtouuajen7cqwumba72lyd.onion/','wss://i2uwfnqdfmfoahdwbs7nq55ss5l2sk7xigz6bbnyqv4njvcqujalxbyd.onion:4869/','ws://myd5rfj3sww2afdritthqdan7thvafjk474gyw665urtc7drll55dcad.onion/','ws://rhafx6xpsnqfsnpeabekxwbqiihmlawi6xvlffthxndsoq5ceyribhad.onion/','ws://pek67so6qk7lsqiwgd52ymqtmgiaoo4swch7fv25a5uaqxypc3j6kuad.onion/','ws://t3spsm3yomoemwpuyz4n5i6rgizpch45vjtalo4geqgabgomvk6nt3ad.onion/','ws://zxz3kdjqqnk7sh4omwbglxdi22rwmgr3n3y6w2sr64b65idgq42nn4qd.onion/','ws://bhv7styme4zl7piwxqxczhzfef5ov72ceydgd46iivv7zo25d2jrqtqd.onion/','wss://3hl5q6tkfe65alnho7x2zzzzuw7novxn3lnxw5g6kkw3qhh47zpk5gyd.onion/','ws://tjtywiotadahtkkcsbcqrtiemrtqqwtqjkbfwbhlrtpjhdwimsocusid.onion/','ws://eden.nostrland2gdw7g3y77ctftovvil76vquipymo7tsctlxpiwknevzfid.onion/','ws://juydmkoledexlmetqtnlik5spxzgo3vlsxqxgaomgtorsm2ja5ozluyd.onion/','ws://eubd65cpjln74tfujm2r3ndn3233yvmbplygzklfatyw7brtf2t7quqd.onion/','ws://bitcoinr6de5lkvx4tpwdmzrdfdpla5sya2afwpcabjup2xpi5dulbad.onion/','ws://4b43wjlcydaggsolnd2fwzpczaw4m62zl3hg4hwwwckuia5mmgyxjeid.onion/','ws://4m4wvofuoirtbfh6v246vzpu4holvvydxja53xmtmzq3zng3qwxf2bid.onion/','ws://tox4iynorkgm2mxjr3bxdjh2ak7enverpqx4ns3gvglpebrofukos6id.onion:4869/','ws://f3ya7xc3sr6lrpgffn5y7eiicwuesftrqz7flp7zasuwnokxtjnpgpqd.onion/','wss://mkbzoe4topckzshjdwwsrdqs2jqhbuma2s6f6po3be56n3rw4fdjtyqd.onion:5051/','ws://5kxt6jjfiji4caj6icr4a63pu2fjbvp7e66p6zdgcfbjykd2bdha53yd.onion/','ws://v57f6v3lrfkclny6jhcq6zcr4zxxduq55bygcqbozdc7ybjx2v7fkqqd.onion:4869/','ws://ko65at6bfw752qacnbmmoqtzl64iockbno6jv5xwpianugk6qcj3peid.onion/','ws://qy3nnwrgp4j2fqemgs6fzsu6vm6e3oqmmr2fvtbfset4cc4757xlsvyd.onion/','ws://dnicsuchgc7umn56q73ie7m55naisp6icknxrbwxyqehxaukaeersnid.onion/','ws://j2tmmli3qu5sxtxv4wpx7vvdqyrw6d6oa3u4pp5qyiq4ishspdk5psad.onion:4869/','ws://bvoy4re2vihngpt4bd3okauooj3nz2fzqincznc57cc2uwxytktqaiyd.onion/','ws://d3v3lqq6kzlbcurbfwe3bqc7nvunlatiflf5l4id2xr3rfrxuxxbhvid.onion/','ws://btbl4v34csjfver55jelbovutj5knzyon6xy26buzv35ejkk3uvdz5ad.onion/','ws://xn--2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4khn-wkf.onion/','ws://lik2ypstv2nvbyfbhzve73p26boufugp3ygnwj2pkyob6avfhtlkxxid.onion/','ws://7hx6act5y6aod4uazl4chfuj4fnxscw2l6ela5cfwyemibb3os53t5qd.onion/','ws://wf5jn47ev344huypmsdgs55ghziijsjwlmgtl5vc6o7trphj6sygdsid.onion/','ws://k6bzq5ajzauf3ai5cupzltnycmgfpjokosckcm3wje6cqokmca5rcgqd.onion/','wss://zosypufrikjkm4ommyfi3pkwerpvfdvjg5nhczvykpwero2ridd7rnyd.onion/','ws://bvmriiqt6llw24vsgvhgb2azp44bdtghio4gnjkiygf6xwribnokq6ad.onion/','ws://a35hle3v2gu3rcjty43f7iqkaramvzs7aufikr5peiyso5zyurscv7id.onion/','ws://22migtcu24lsnivl2iaboyqlksr7gnaisbcu4wqw5p4zmmcicb5tcxid.onion:4869/','wss://ljjrqq6frnm56oeowjzqfzfniwqqpohyg4l6adawekgh4vligfcg2lyd.onion/','ws://t57bl762uvksj5vkj2a4pvt4hcmfvwabl2o6nfxlfhztcblpowi6itqd.onion/','ws://usofzykj7jttshorelnteyhrt4hctw6isdprp6oiol6kgmewa57uizid.onion/','ws://vy2klfczk2tca4pkgdrvqrt4kmlvcnqz6cmwszrohb2yl2bk3xhgztyd.onion/','ws://znwu44n74shn2byicqfmmzcs4aed4gzplahtixkzktejrjq2ccaw4oid.onion/','ws://jayo7rsujqhsyatz2wy3k72yijfvnezoxtfeh6xgmq2wruusmksdgvid.onion/','ws://cuqjqfuqxqk4ktcpbi57fihcp3qbrbno4ztnfxxm6fquuzhkni6tsvyd.onion/','ws://q5mltfv3vw33qoamly2l6e23funha7c33fr2hxflz6wwup3pw7cmsiad.onion/','wss://nk5rwyupoifysh4w3cb7hvwnkmrl5cfjymh2yk6ioecjidbokogq3wqd.onion:5051/','wss://nostrhhbwvjydjk7jms2idskcjiwwper56ybnrjkkuqf2uhpks4zaxad.onion/','ws://7dxfjgqlnh4ywlb2qt2qhktxol2khnwkj4emlq24ms3mzstio6ma6iyd.onion/','wss://in73gzmzzm5g5z6mvblu4wo24r7s6zxqdgexfc2xpnnvxcyp22ypolad.onion/','ws://icpbkp4nagnwiamref4vn3unmuexj7hplf374mmjhcl6kayxnknky2qd.onion/','ws://q3zaylwjjhq77yzx34lbydz26szzjljberwetkjgxgsapcekrpjzsmqd.onion/','ws://gx25hcmidmt522ofm6wdmbhzg6i4p5ygp4ovyxbgsql4ylrwjweibyyd.onion/','ws://ab3w43g76lfczosxso7tp7gcada6hge6uw4uk4mu54mebynu2dj5fvid.onion/','ws://smsjgbxrmz6d6wzefqj3ii2oxvjccsaiyia5in4ve5k2u73paligatqd.onion/','ws://enszu7i6dl66iy3gaso4qhpq27oeb3b27klwr42aaqjytgrgdde3etqd.onion/','ws://ozarjrnsopcn75cggnkkuoqolz3wfwj4kmpjo7iz5crk3mbvxf3gheyd.onion/','ws://cdnwsn74epoqwgqit43zcqot2apjtwhrsnp5iqvad52qekokogjtcwad.onion/','ws://2awyxzdmh2gvwoc2ot4nt3ih3kbtb3tc4axwhdbkftrhumtqzz4i2kad.onion/','ws://7yndbucactpvu3vfvmcfj4jkqahdydxbhyzsaiqgpsgx5wrrwoqytuqd.onion/','wss://oszxnul6sljymfoykzfwuhegzfi57vqlvgowxb3zc4773wcpp322cpid.onion/','ws://ftlbxnswg7ted6uxn46wwyyknevlwgth657ukio6pzmqxkneebygpzid.onion/','ws://kjpvbrf2d6icnkkpr7h7zs3fsrr2urqu3i26ienqeyf6zab72v4brbqd.onion/','ws://hzuxbff4kkczhocrqgvxzs4wde7tkvpga3wwth3t4bj4t2xeulhhgeqd.onion/','ws://xm2rzi7qztesbl7xe4alz4rrx7wd5ydgihk3yp5y6deffdalplhqmyad.onion/','ws://n64eywckzs4bhofce3ckvfqdhiiispq4kipa44pwbyvqv5rlrt7faoyd.onion/','ws://45ucjgphayw5vxmewlbsw7gu4h7ehcqeu7zthum2n5q4t74vbmagx7ad.onion/','ws://yihlw4k7pcslvmxslwiooxa5hvfxo7onsa57by7j2aao4z2cgdnab6id.onion/','ws://j7dngxb5bkjbfbsjwoufqy663nmtqnhsgpixtbp4cwgk46px2daszjyd.onion/','wss://sovbitm2enxfr5ot6qscwy5ermdffbqscy66wirkbsigvcshumyzbbqd.onion/','ws://oarnx6xdrq5mygfdrbmzsvh3is3holefpz2x4qwbopwcicwd63gcivid.onion/','wss://7ab7qqbj2dw3pjnkoskgsfn4ikqc7orwnkpmcfjmeobw63kf4zgykjid.onion/','ws://m275iixwsnldfh7govpgoimd4djkoy4lh6pvmodqy7ryilebc3qo4yid.onion/nostrclient/api/v1/relay','wss://nostrnetl6yd5whkldj3vqsxyyaq3tkuspy23a3qgx7cdepb4564qgqd.onion/','ws://fhjagnbzpef2rsqhcrrl3uci7ph7z6nlrxxebptal2rnvav3pmvf3yyd.onion/','ws://sovbitm2enxfr5ot6qscwy5ermdffbqscy66wirkbsigvcshumyzbbqd.onion/','ws://yuxmydk7bbmr3ymnzmumnkmh3iqzaoj5kcrqzanuozvev7zvxv6sktqd.onion/','ws://auuynp7xntdmupguvibspt7tmwprpbfeyqot2ny56gyariihestwjvyd.onion/','ws://muzhhjy7wlg2q5lre3kdnowiiseahewhplzyz6vexsssywf354inibad.onion/','ws://jy6wwnhquwwcfbcjvqmpjtiat54fz7x4q3vabrtxmdh3zymb5b23jzyd.onion/','ws://vkd6kcdjkxxjmzeoxs6ivmf42kob2a75r6cwtmxs4v46iraxgflwziqd.onion/','ws://5dzvuefllevkhk7miqynaviguedxfnofrayu2xwfwtlkdg4radjdlyqd.onion/','ws://vwgpwqlyro7koztendk74s4d5bu3pmwbqlvw4f6ehxfmy6hnplgtvlqd.onion/','ws://dfkovnokk6373zpag3jbijrde3mbc23wd7tzgeb5lkbfz66q6t64roid.onion/','ws://iog7o6t2vs42rgopovyj4d3o36ux7kn64vhwsnmanaitnpnavn2dijqd.onion/','wss://4m4wvofuoirtbfh6v246vzpu4holvvydxja53xmtmzq3zng3qwxf2bid.onion/','ws://zjbarb4mugnmgxzoryyhkssudjwrilkzl2ezp2kxk5rfqlwruov7hvyd.onion/','ws://diovxuu7x6ap5r66syror6xajn2i6qwotpz7clvzelo5h2vxucxtsrqd.onion/','ws://x2eidxmku36cvw5pjlka5f2x3uchojnzshxkakd3vhwp5bw7rjupa5id.onion/','ws://mzpvksiq2j4ac5ug7oh3xtmztrdsrtigt3mcrmvjqcsw6rxcntmhu6ad.onion/','ws://nsx27pxkjuh7tk7q2vfejgfbwor5vm7lhvus3ybamoroburljhyjvkqd.onion/','ws://oif67vbszaijw742iueskyhs46dnnfcyjk6eskotfynkkswvzgcevzid.onion/','ws://pzfw4uteha62iwkzm3lycabk4pbtcr67cg5ymp5i3xwrpt3t24m6tzad.onion:81/','ws://abntlfyrpbqb3nxiqmtdtzmvgtvf2qfd4v6jtjaik5ipqdupumhy3nad.onion/','wss://v2j32ygjaayg7iyivnecmsg4hkh6ix3jat47feh755dlo3t7kyqemnid.onion/','ws://mcja3k7s7godsfe6n5cji5tvh3nbhacbb2kl7j5sisias4s3uls5cjid.onion/','ws://wsx3d5pjgnjsd4m5iuk7m5bspazwr3wosmhji52xtqzxhrwztkg3tyid.onion/','ws://yx2f47jak7jad2ecktuq7mso74elgdevaawnsockjfrqbahikpkvorad.onion/','ws://e45sscni6e6y64bmla3yznokekcco2jfldvh5ptkbd3ljqqj23zb5hid.onion/','ws://rxyqutipcxvjoeoeopubrmo6mrpgupxpgtubsxtrpofke2kjz7ju3aqd.onion/','ws://vmw4ikdrt65hn2hykk264irq7nugdewuo7z7tjqhxikntnvylqyr3nid.onion:4869/','ws://nostrhhbwvjydjk7jms2idskcjiwwper56ybnrjkkuqf2uhpks4zaxad.onion/','ws://g75eao7f5g4dikcfjuduuduwxhd6fshatt2skit7dfy6oby7t7rrywid.onion/','ws://mjs2u3k75y7gdcj4tg2w6wiylddpkddai6azmqnfgfnb2z36n3x3gfad.onion:4869/','ws://fusk2dvndb6jvivng6nmwqbtgh56w4kqsxweownpwtgcslbntwrpcoqd.onion/','wss://2yhm25jcezzxh37apz2redaq3oaetupc44l4rp2o36iaowcvjoivzgid.onion:5051/','ws://pditpx3fnqvrvcqvkaw3xqgnoigyaydfqijvo272wb2gx46girdjxsyd.onion:4869/','ws://brgziqv33b6ipisc44nwrk7ckqfxe6nylsapp62ke5zgfibaw3asqlqd.onion/','wss://rs25akytzmo4uj25jrq55rjqs4qcncxjmcrvdncibuopflcmf3y7orqd.onion/','ws://y525vus2qdgdcxvx6l4nfl6gi4sihphxdaqdbzikquo7jhth4cfhibid.onion/','ws://4iacxvnvyeezie32fefgcfbeq3mfgmhw3uvfcvdwjur6ktjgh4g3lwyd.onion/','ws://f4ayibdko4zx5do75htku6upy2frzpfn6kiiiemzjuitgclzauijd5yd.onion/','wss://zz74rqc6u3tqdtnjfsslsg67s5dvq44v3komw5t36fazulsdfhlputad.onion:4869/','ws://iqsf76ezyops6zpnidpsvs2latnbncsjqzzbi6mlr34pxj4ng6buqpyd.onion/','wss://pk6v4wk4p5dcfs32sdzavi7qnrcmweini24iiwaprpswp6ingj7hp5yd.onion/','ws://ttkwv2iczmlaf6fqexd7ddpdp3kvdyw4wi5gbd3bhjalosezi4xuqbqd.onion/','ws://23iqbrti2qx4dxftkrmi7l2k4cguyovofixwelrttp6q5v2dxvn3p7id.onion/','wss://w2do75kvolcihgcsad2ftpswl2z2e6eckrvzeajyfrzpzdr7rc37x4yd.onion/nostrrelay/cyberpunkhardware','ws://btcys3jbk3ao3d5pevhttjfmx5g3chvmdf6c4gyqxdaqvh74erqdchad.onion/','ws://sx763d3jfy2h23m3roenppvf76nqdcaycs2ylw4udpfmnarspsx7said.onion/','ws://22gqcvl3hf42j3galf4vl6pilbrb3qjk5qpbzrjphrr5xxybtmknvnid.onion/','wss://nbvo5bnn2a3rtdrgmwodehauywia7nppuzgp4pge7u5hapop54vv6lqd.onion/','ws://6mu64eabtlkbl5ihfcdg4nnkig5ykfkdv3ge6mgq3prvarrlpjdxamad.onion/','ws://6lehhydsrthagmis6uu6tucndvzw7cubpqkhvxyy7joioc45mksr4ead.onion/','ws://bp3ga2unzykgfxajixhwqwm57r2uqovzv5ok5hmubcaozyhy5mxhpcad.onion/','wss://5dzvuefllevkhk7miqynaviguedxfnofrayu2xwfwtlkdg4radjdlyqd.onion/','ws://xcsawr6vjyko2a6td5iqa3itdxl52wxriucmdz5vb7khznr4evrq62yd.onion/','ws://h463uge4enisyfcgitx34mc6lmymkob5fpyh4u34nbsaqmki2ffkroad.onion/','ws://m6nvdzwm2zuzb2bmp6dgdmgnwpsp62fljwhebedyhwfngg4azobxfwid.onion/','ws://tiqjalwh2u6r5honpfg7rrwswuord7mkamew3hxf2wh7do3nt2jglvad.onion/','wss://geeafhmczfy5jmfc36ud2vgfotsrdnc2vwrp2kczjka4afx42quc3qqd.onion/','wss://n3k6eji4sqcwpsb6wzsqkwtapvis3buoiagbh2jzpc6h6mziblu7dnqd.onion/','ws://ahq6jwkipmknrz4lbo5uy3wogly3htuoo7ss2rkgcg4ra7ykbyahmrqd.onion/','ws://feljdt7lcsnfg7nu3ml757kdq2udohg7xzl6rroqbdjv3ou4fx4zmgid.onion/','ws://r4o5h6s3cayezqlyskizaz4oq7csmgqjhdkvhuux5f6bynqkp7qcreid.onion:4869/','ws://g5fwqkv72mahnp7rin3wa726qnz5xnlzcy676epunwewxdi3vlccb2ad.onion/','ws://2xh3zwaxrbqn4fxpreaywvotucmsxgt7ptumqysktng5fuk3jheaekqd.onion:4869/','ws://wdoyvomi7rw6pr6ehxjj2ryefxdftacbammwayqckx6wbciifpq7q7qd.onion:5050/','wss://6xgsnrw6cs7eumqz7az7uyklzoarxljmtfkqkavykopvdbeualuqaxyd.onion/','ws://t7i7zqhm5hs3owzxqwubhtjlbyjlhclogq6muz6dbsydn7skza2xfdyd.onion:4869/','ws://qm5lz5sywmytd7253omwj67dxr3rgk2wghumdmyh6ukrmo4mkv7rbbad.onion/','ws://vhyixjtb6ikap4guhemjsln2dy33u7rem54fplsmq5g6xdnkr6ufvvid.onion/','wss://skzzn6cimfdv5e2phjc4yr5v7ikbxtn5f7dkwn5c7v47tduzlbosqmqd.onion/','ws://rs25akytzmo4uj25jrq55rjqs4qcncxjmcrvdncibuopflcmf3y7orqd.onion/','ws://h3avzcsyhvpi2mtmh5d3yqhz65cwsmbdlud37hk5gbnxi2gkajwoczqd.onion/','ws://hjar34h5zwgtvxr345q7rncso3dhdaryuxgri3lu7lbhmnzvin72z5ad.onion/','ws://qie5s3tiwcfplx2vu2qsblrbtt25haa6zwosdougxg56jec7jny4iwad.onion/','ws://sp5qhwxluuzwgyiehhhrd3tqcrzsa7m27luzwbsomvm4yhuxpqdkvxid.onion/','wss://ypmwkd7mqlcxt3dg4ersmenoiqkcn3jyv6gnwuzrtiweg2zhjovojhqd.onion/','ws://e2asnpsqmxck25oiqgq5mkjpjh4lcymzygcwzxjkrwp3puh373scjjid.onion/','ws://qnryx5tyrhfdjj2hipl66xv3ylizcqhtzqfsx5evbrbg4reripaxf7ad.onion/','ws://xijc6ritptasvgjdevrkpz25mgbczldudw7bcctlbecc4xvsd44mcjid.onion/','ws://qnd3iyzu2b7t7a35ybqbvzt4ctdop6rt36qx4pdikyhrjzprw2rx3qyd.onion/','ws://i2uwfnqdfmfoahdwbs7nq55ss5l2sk7xigz6bbnyqv4njvcqujalxbyd.onion:4869/','ws://xcuilkybdeag6t4o2t2v4qb3bkpsvg5vuprziiak5osurrmv3u5hjkid.onion/','ws://tsqdakwo4dh5ej3llsi52ftxfbialteu3jm4cmvxaksl3psbyeoyxxqd.onion/','ws://gxpkj3yevbeo4gctxuh2ocvcbwx4tyjy7ph7mqlbbl4jw5vyktpv6zyd.onion/','ws://vl6y3pudhkljy3gp47nld536gsvqb6wk2rltmbusuyunzaryg3wou3yd.onion/','ws://zdtnkj7z32kewwzpjfuohnj4v33cjx6p653jngymln6qxouxoa65f3qd.onion/','ws://wwtnzstplim6qhhrhei65fu34gll4eilfji43v7opr2gsyb4du2ecuqd.onion/','ws://svso3ifnoqfmbnwsj3mucy3xy3bmgrp3hud642f272tfw4mxf5qoemad.onion/','wss://3epscgcczfzxwixurznccs4xhk7uhayelu7jr4bpgwnqege2f6mrsnid.onion/','ws://6gztoe5bwohkf2lbnx2jm5rvslyg7okkllnln3ju25zhs6eftlr5miyd.onion/','ws://shsav65a3mt4mdbsp7i6gitl3vn2353ahxy3f6hc2dikzql4bdltx4id.onion/','ws://zatrrv2yw2z33ngbzhpcc7xyu46lyqcgpft4bmxafcvsscla6odljyad.onion:4848/','ws://f3ya7xc3sr6lrpgffn5y7eiicwuesftrqz7flp7zasuwnokxtjnpgpqd.onion/chat','wss://ihjxvuvlkjetdqpwm6fpbehyhabxgaz3yuzhwmrsdf71gnxppiuy36id.onion/','ws://cva5we324xeaib3nfov74e6kij72dkmtxujeis2wi57i5mbvqctv77id.onion/','ws://xstwpaseqivgj2c5eny6pchheci2zl3qrg4zh6qlttww3hd4wtl2f3ad.onion/','ws://4d3jlsjmcqs63uewor6tltxhcgeip6sxo42xorchehr7ycpkxpzabuqd.onion/','ws://dyeqag2wryjvrf3d7unprb3ntgwe4z7ibiak6r5lmpy6l3sscotcqyqd.onion/','ws://j4ccyq7dkspkfqlruokvjm5qwbjtmatatsao75yofatpyo5gfj3u6iad.onion:4869/','ws://g3ybuutvdzkjlgeyxkjzdxq2tganqfshu6ysg7vhqrjfqinh55o67yyd.onion/','ws://pkpnfo64ssmeoqriwmaoq6zt4btcvstdrwthbr5rsr3kqxhrsyvcx5id.onion/','ws://6mwlh35a6oe4xzvorvx4wwxsvh3d5ztt5xw7yd6lc4wb66fpwyt76zqd.onion:4869/','ws://6ww5r66yh3tf2wueasybkk7cx7mq6q3bixmhqsxuaxmesby4mwa2gfqd.onion:4869/','ws://ixtkbdyw7yvozddjgfvgu6xxdvo7velvphzvhvpomjsjexql44vpqcyd.onion/','ws://rxdoptuahmg23ff5xnauopj2xtijo4gfpflgtounteqrbnnog7zxaiid.onion/','ws://35lqpdgvfvwapmah7nc3744mseoewifsam6xuhvescdkwvojt3cdqvqd.onion/','ws://qr66tn22lwwbm2lewwpit4qojaxv7xbypl5a4dsrrk3xtpurhmotmgad.onion/','wss://jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion/','ws://sr2v6vd5v7aithbcf4cflbdbxn7ylj2ivzjwttabjtcrhvredqje7iid.onion/','ws://notkjeagswwttgjpvdjt7vjsr2vowqfshs7l5sdvmjb3k642em5vb7ad.onion/','wss://gxi2qpd5kul6b4ivusccdtfmzg5rsfsz2kzrnwj45ycnpegq5d5zjhqd.onion/','ws://nbvo5bnn2a3rtdrgmwodehauywia7nppuzgp4pge7u5hapop54vv6lqd.onion/','ws://khftmxqt5epeyze2qkyxf7mcrmg6wvijse4xqz2ab5b4ja6opdepcxqd.onion/','ws://6xgsnrw6cs7eumqz7az7uyklzoarxljmtfkqkavykopvdbeualuqaxyd.onion/','ws://finkneenlygbv5a24gmi3o23uhcnsohssuybb4ahzngxxs63whfmftad.onion/','ws://dqmozl6rpwkvbtgeh7yzqdfj5benrwfpurbovrxtuj4fxg6c24omsoid.onion/','ws://ajblllimmpwxquawxcliahjl4qhkibc7t2fybdz2sergpjm62qxnh5yd.onion/','ws://o6ga6lxnax2z7pgkkenifollohkrv55r36mdzdtofi7d5yyif2f4o5yd.onion:5050/','ws://t7ep7h4zl5syxlpbkifbxmuyy6spzfymo46qsat65voja3htzcehbuyd.onion/','ws://dnze4ekho2kuiejwatjw5omeprtmdaum2ukok52roiu5rztii3rp2aid.onion/','ws://b4zf4l2seienji5p475yo7yudghjrsgpt7nwdd6atn7qmcaoyj3hu7yd.onion/','ws://f4dpws23kwrgwiy3golfvtb3cdlnku2t44vhznppadfswvmjhnwxbfad.onion/','ws://p5fsm4xwkimew7kwzkfaiikhanfx4uktznooqnbnn74zgcqfy4pdzeyd.onion/','wss://oicprksrqs6lngfyx7pqqa6xnggr2t3j7oor7f2uzqe57t45lzmveyyd.onion/','ws://7ls2j6d3ze5653wjz7bnzvxm6m35tpram4eecjs7ja3jzq3vzhqbigid.onion/','ws://yi5rlialbntmojs22cbkquohlta3pm4pdyjf6vsk5gz5fxw5qg3mdjad.onion/','ws://pdq2fsqlxkrf5sputw7siq4qf2bahsfntjtoohinzu2kjde4pdis4tyd.onion/','wss://nkfcxvztbfausguxevwkzbyzxvkpqkcjcmrcrsynvn2sqcjzojjctlyd.onion/','ws://dbr2shw4lng4of2vcphytf4wsfohx4lj6jizktnltyfhdtr65a4v6hyd.onion/','wss://7l5k5ip7j5l7jokfzav3qemk7d3eaurj3lqkmluzsey72p4hsvcgdpyd.onion:4848/','wss://iq2nbjtlihqbvskgx37rq6kwxkz42jxe4q5ulfewh3zkxgywflbvo6yd.onion:4848/','ws://ixgozfrakokii67gptetyhlbmicbogg7n7bol6tupr4pbpzhszcejmid.onion/','ws://mumbs3cfaceofpnbwthjqwreffwkuj3l3cjyuyathbqag4hs6jol6oqd.onion/','ws://hveqyte6redmnvsvo7w6jbz7xcfv6w2a677bzjcihgawe6wds6xpikad.onion/','wss://o6ga6lxnax2z7pgkkenifollohkrv55r36mdzdtofi7d5yyif2f4o5yd.onion:5051/','ws://tfhcnny6kqvlv364lnjjohcibriedadk7noejbvhnuntn3vc62bacyid.onion/','ws://jmxrwti7y5inou2myue5ubebfvhqk6n6drsoi5i6v4knq7o4afmasfid.onion/','ws://fnxwipsg3lfzij64lvjgmutvkkpd7eo2mr2khxkofyywf3vsvbk73jad.onion/','ws://unmyimyq2gq4i5ovzahqvuphdhqa6i52dfebr4mdgom6njwpkqum3nad.onion/','wss://zseqg6ldkdvumzr73jkjfsrozej47b6jmy7kcmuhd7e7u23ud2kh2zad.onion/nostrrelay/ipsd5w4x','ws://zb3bfar44ylgc4hknrepbsm6hlstxr2zwkes7z3lgld6dit7inqpcpid.onion/','ws://e2pgnxdhol3be55c35oype2q6ovzm2d5ft6nrliecjdkgvmoyrkyhvad.onion/','ws://qr67qsp53joueyufs76ai3t7ramp7vgl2h4bvh76wmgycjuo7vb5x6ad.onion/','ws://niqpwkaxsdfw5cnkxgek76qncrvzmfluqhbaehi4hnetywbywykesvid.onion/','ws://ht2jgnqgg5qhv4in34yiaglvxr53v23jkgr3yrynekdceblcizuwotqd.onion/','ws://dd7duvbsv42ej3eibnbqpnxuw4wkn2lxmdihabfkg7tefny4p5lcatid.onion/','wss://iykjvbzukrdz6vog2hocawf3mcofkqrfad3iyoawcukmwnmas77dajad.onion/','ws://xxdxsnxjzvpbiaizaohxvaybrn4pprofay6pkggfdvftq25zwq7hffid.onion/','ws://1414gzx2dtlzbqz2g25xutfimwerayi2yb7wfmcjqpzyw3bh3wa6tiyd.onion/','ws://hdd6dyp3zlacouocjjk4fix4wcd66dugibmyrfqqza6exnljr2fypxqd.onion/','ws://y7czvmhzcsmlglpsg4c2tyrlxf6o26ri4bqsd3pfpkyzl64inxvaqead.onion/','wss://4b43wjlcydaggsolnd2fwzpczaw4m62zl3hg4hwwwckuia5mmgyxjeid.onion/','ws://bjvwreadcagtnk6krn5zv3vfigd5emvx26bnpc5bs3uc5qbwf5kvqjqd.onion/','ws://3acpdpmce66dy7baaatows2ifesvo2kq3jsdqci4dkbpdpyb5kweqfyd.onion/','ws://meew2vwnvjw4xknnx26ozqryfpcjlk5dw7mfd4qx3fhioiwgdjcudrad.onion/','ws://ufwzu2cu5zisvu7l6fma5jmggztswontvdpcdniqs7l5jjliwp3e4wad.onion/','wss://ykfmoqnmdhjaw4qkihvqigrayiusclfqxfh2lt3frtlykody5wwvcfid.onion/','ws://queqnjmgfqngqx6ebi2eeahwtszm2qli2xghznl4ne2ke4x44b5sinqd.onion:4869/','ws://ez7f7maseaqflyo4c7v5korgrmeljmt4qs2rkskp2lcfrzjswpgd2had.onion/','ws://z4mf4irie7bo3l6c24lqu5stvgm5mfl5vuqjdc6mfhmddzzvcutvaqid.onion/','ws://iidatxheluygxee7b2so2ehpu5sbubaxmpyj637tefp2mntdlnd4abqd.onion:4869/','ws://75uo4vn7dwqthkz2cxxb3rtpik7j7a5jlqppdlg22oz4o2737kudxzqd.onion/','ws://avu5v6i7s7yz7mhbaueswtv5nzifgrhqiic6vqvhcr7ucmdsf2zhhsid.onion/','ws://7fvtb63nbejaiuacmvllb3qatmkydtjxlxkvi3z7zsjoijcinyc3b6id.onion/','ws://7jfgu2smh6lvw2wfixartnjcvfgfk47m5elv2y4oimkpizkrn5saz3ad.onion/','ws://kacnoyjerii57gkue4hiieaog66pw4nontzsqcmu5j3icfef5pnip3id.onion/','ws://lclcivrmmdlrw2xbgnla3fb3wuchx7mqkczkwybcn2bodyo4xtiwxtyd.onion/','ws://l4l4gzx2dtlzbqz2g25xutfimwerayi2yb7wfmcjqpzyw3bh3wa6tiyd.onion/','ws://xzvagvn3txqzjepoemtaxlkb7fp4gnjjtaxbkrlhetyunpbugvwt4zid.onion/','wss://xijc6ritptasvgjdevrkpz25mgbczldudw7bcctlbecc4xvsd44mcjid.onion/','ws://zl462guecor6cdx6hlgdvwssxtqgn46bykq6x54j3ngnebtk2st7jsqd.onion/','ws://wfubazxxhuavpoqa2vy4rbzxysb2irbosmitdeh6jbhr2hclxfg5lmid.onion/','ws://ql6ndne73fy6v2qr27i5kbbxowajv45fwcbloqc3ayasxpd7wh2hgoyd.onion/','ws://qque5k3a7uyujs3xu4nlrzgg7ivpekcjx5mfgnq6nbzdz5tsorzrzuqd.onion/','wss://mkbzoe4topckzshjdwwsrdqs2jqhbuma2s6f6po3be56n3rw4fdjtyqd.onion/','ws://i367cduwox7aenkacekioenijlz37huxfwmantymetyb4262zfugtdyd.onion/','ws://r3q73q4piuoadx7yvjyp4opqzwfnnqltn4t5rcezkzpavbzhtbanfkyd.onion/','ws://fihkwz47fairbjpuatg3hrfbsdrq35327idadcdr34ufvzmpdq2ib4qd.onion/','ws://mmg5suaa6rhs4spehrb37lm4ljpmbuxdwvrcsvdkgkjvkjqdmcgqfgyd.onion:4869/','ws://binwxjynk35zwnqsma44gigbkxiugalwvvne62ikj2be74oc3z7zklid.onion/','wss://xodpdwcomyfwnhnwja674roe4gcuov5psdyrrkexe4ay7qizn2xtkpid.onion/','ws://bdw66dqsr6cqpqiny47h2c23tskaxhkgzk3f6py5wzr5q5wa2g4fpkqd.onion/','ws://akseuzyizvorpc6ndazpjmxuyi4kkp5lm6z7sfje6zvkfxg2em4cn7id.onion/','ws://rrvgi3fsztko2kfjyabd4celdayxljf3xrs2x6m2j5oma5tsxwymwhqd.onion/','ws://mwpnwvq755ryn5uby2ld3367bx6k7ej4tfyipocr6viorljgunilbayd.onion/','ws://nkc5huzfta7elaconlm4als7oe7ppis4hdlgr5dunm6ksu36ap4b5pyd.onion/','ws://mamjlwflfqbghwu3ax424hyo5f4m6smcdbqjtgd57x6qpu7oamqwa6ad.onion/','wss://2pbkpndvpeebljfvjew6auq63lndzszqnntct5aqfmazslerzxe75kad.onion/','ws://nostrwinemdptvqukjttinajfeedhf46hfd5bz2aj2q5uwp7zros3nad.onion/','ws://fsggm3wkqb3nrmsvjfrsywhqee2555apt6mkkikd7uujz5v53nasvmad.onion/','ws://cmuqxreb6oma3x3iq3zh62im7w4266uo3txac6e75qtlfqs7scwqyqyd.onion/','ws://ch4dwx6x47hfoqa6cbq3qriln62koikhpukcdikrew4m5auj2s2qr7ad.onion/','wss://2f64re32nd2dixfuaapmymsj3u4alvbydlnesm3h3dd3majafce3glid.onion/','ws://j5coedofbrxdnj34d7t3fw2dvplagfw362ji7jdffaiu5qxoaeaixkid.onion:4869/','ws://4kyeh7owcdx56delz5mn6lm6t3pdld3x3s6747ntgxjp5r5gfwjffbid.onion/','ws://foqlktnvqpeo5jkpkjw7qslwbgzl43atesu7m4pevfdmg4nkl45dlwid.onion:4869/','wss://7otrzettas4b6cw6kdp7w2gjpoapkt6qgbkwq7elguw4ujvoj2ueagad.onion/','ws://tmwtgezt6pe65pzhhojxwfhny2yachic6vrf4tfaxwoc3gdbtwy5yyid.onion/','ws://dmsupermax.onion/','ws://z2qr7h3532kpbhb2y5g4odwsbm3ydvk6dee3bx2bym4ome7n5y6phtid.onion/','ws://fxfzk2xgaoxauynfzzgzjz7iozipovzeoeu5i7otmscerkkg5vaz2lid.onion/','ws://ljjrqq6frnm56oeowjzqfzfniwqqpohyg4l6adawekgh4vligfcg2lyd.onion/','ws://u7clbc3ltppxgzwjq272vbizja2doy6xjbkwafalehxa6ygj7awg7tid.onion/','wss://xvgox2zzo7cfxcjrd2llrkthvjs5t7efoalu34s6lmkqhvzvrms6ipyd.onion/','ws://d26dnqchswfetz34gd7gcgzdsuprtnvrdvlo5iexm6phqhx7bqellnad.onion/','ws://u55roajevrqir5a4tqb7debawpmuxph2bduxce2dcyw3zilczitapcad.onion/','ws://z4gowyxmqebsw3jgnc2tzomdx2frypu7rm5ttqae3uj5ffsgwj77rvad.onion/','ws://jx2ldrqijasxdm4p4ln6g6ygthaebmym2bkurnqa3z2kvel7kadxvfad.onion/','wss://cmuqxreb6oma3x3iq3zh62im7w4266uo3txac6e75qtlfqs7scwqyqyd.onion/','ws://sxnhqltphv4wlspoc26hiwforbh6do5wbeutbi7c4y27egizzgadvjyd.onion/','ws://kadylrdet2g3ig3kdcnpab2oau4fgrihlu54266676e7xok7riijagyd.onion/','ws://mag7xfot7rhg7ixt3ijhei55vwy4u4ayevgivijbnd6fgvt4rxponhqd.onion/','ws://fkeci63bpjfzycup4tsdnu43fun5bswdpuhgxptnobj3a7bxwq62z4ad.onion/','ws://2pbkpndvpeebljfvjew6auq63lndzszqnntct5aqfmazslerzxe75kad.onion/','ws://iwrrbjyhvrir56vpd4gn5nh7hdwnxp4lziz757hrk3gpcueit5tnd5yd.onion/','ws://j3crlspvmzyko5sdpdsjxwfkcc6gpxdljovt24tuqwc76kwxdrs4o5ad.onion/','ws://thvxnhmmuayyj6e4df3rm5klpo4n2vapwoops4khxlkrliiw243axsqd.onion/','ws://n3k6eji4sqcwpsb6wzsqkwtapvis3buoiagbh2jzpc6h6mziblu7dnqd.onion/','ws://vklqeod4doj46t5p2kxjxlcr4idjikuir3u2gyydfun54rwr2akyatad.onion:4869/','wss://iq2nbjtlihqbvskgx37rq6kwxkz42jxe4q5ulfewh3zkxgywflbvo6yd.onion/','wss://wjh5tppbvw5w7rlqnmhs4er26ny4l6ptzo2ojhybvp73xqs7kjylcjid.onion/','ws://3aolo3xlvbysumxq3nepdo7s5fzjzbcrjkbvtqliymicw6ym2ptxynyd.onion/','ws://nnp4belzj6nc5m2iiwecbv3dwdbtzdzznjjaxryyugdemm5sjh7smyqd.onion/','ws://rkm3gpuwsjofapvzzp7w3x5d5geflhjgapwe4ihqlvs2pddebtqtezad.onion/','wss://7dxfjgqlnh4ywlb2qt2qhktxol2khnwkj4emlq24ms3mzstio6ma6iyd.onion/','wss://7nj3e5opqjcpyaoxi56c5yvgzc3b3dmubbk4c6nrdq5lnzn64g5jwuad.onion/','ws://o4xkxicyuk7pvdd7e642ufjvpbq2tlu7liwfbebh26hacgpjail4ffyd.onion/','ws://k4ukeqbjowbtycmczygg25chfsnyag5dfiwnxafnork4cyi2xsklouyd.onion/','ws://pl2qmvbi6y5yoxy5dfzgd7x4moq7afcg7b7hsvwtl7ttgdefred6coqd.onion/','ws://jdqldw6hffnjdymzo5bikc75xuc7kg5zex23yuhczyacqcth5hxw2sid.onion/','ws://f3ya7xc3sr6lrpgffn5y7eiicwuesftrqz7flp7zasuwnokxtjnpgpqd.onion/private','wss://dnppj4kopczovvzvpzmihv2iwe5wt3gbrxjnltjc2zdjpttrdz4owpad.onion/','wss://3vp46rj4ahp5ghcng3ukjoewi76c7eerg5hve3rj7ekbj5dbmv3mcaqd.onion/','ws://abyxvaq3lpuqtpbzjlcmujt2rcfiybjjd5rlnhqtjkuf54wpzxsq45qd.onion/','ws://7welkrpfbulm5pqn7srlewgd265z7v4x6aljgyjc3ej35jmdfwpjoqqd.onion/','ws://hhrfhfntuvhm4u6wly5g5eip37k7i5xygsfnga6z4liogdxvuroxjmad.onion/','ws://koghcfthoscxznqmfq2vgi44rc5pnznjxx56i7k3toxorn4arkf65pyd.onion/','ws://ty3zdjkwlxo4zah6tgdoolznjcbvkhxpcvjyqe2buxeg23hbeyvr3rad.onion/','ws://jyfrigr5re7pf3qcvmz2mi726ovhqsdztfdy5v6maq4yji5tfzdwejid.onion/','ws://tuzjh7ieudnjyj4shebeky5bgph7osyow64y5kdd74vuolcvc6lknyqd.onion/','ws://477owryal642ydnsqwuznwxw6vsalcsdt7nag5s3xgkan4kopavrqcyd.onion/','ws://2gs647qsmbui4ipmcivlkrbuhyx53apnhiy2tsedwgnqx2lgkjruujad.onion/','ws://2oosmca4zw72w5qrup5k7oa2uv5f7lttvmeicpfetgiqwijizcqi3cid.onion/','wss://if4nmnw5vasc4yxw557zqxacmc3dc5z43zv6uzhcjzgrgr777onnzxyd.onion/','ws://2g2jzcfgq5lcrceuq23lmya2drm3ku5qmqimr3bvu3amol55vidctrad.onion/','ws://b6mgqfzqc52uaurk3y4cazxjia6ygdzt7rbnfawbvor4b4shchiarmyd.onion/','ws://skzzn6cimfdv5e2phjc4yr5v7ikbxtn5f7dkwn5c7v47tduzlbosqmqd.onion/','wss://3hgkywrlrvg4p6qqa7ekamgc42hcbyucf75pas3cdg3dvyixhqyzx7yd.onion/','ws://4dby26llm54aczb56r5q656ongq2zmnsu5u4v7tzevdi7kibavqu6qyd.onion/','ws://fv32viuaao7ubnjdmel6rp6pbd3u5ed5lq2cbl7am2g54j4rbx6nl4id.onion/','ws://phgmbsc6luq5ivkp4ixsxjbddw2m5qwroi65otauzf3suopzkfsiieqd.onion/','ws://5wvf5zsjziwl7i6wnakzidckoep4osnr667dyvq3yhut3r6q7co7aoid.onion/','ws://ttpho5dac6aodlkgx4xqzraosk7ydqoic3ibpqjzrkag6mjcp3wvohyd.onion/','ws://qvexolnki2gqw5xquqqxybxr7lw2zalg2xrbpaffpatlegfjj6wlfzad.onion/','ws://5311734526860758.onion:4869/','ws://srtxt4xf6mecuncru7oy5a3irvelvfmsk6t44kosk6ab2cbwdg5ukgyd.onion/','ws://y5bwjj6phwhr7k7kfra2ataky62maapzv722nyjauacyn3naysr234id.onion/','wss://lqkp34fuevmuj7pogl6nvrx3w2xkmlkutqtipf4pg6m46zqde3azbcqd.onion/','ws://yd7qqrkvaozyosvo2qjppvxe36y5bgr5n74yqjtyxbbur6fpuiz5djqd.onion:4869/','ws://ghitngnog66sfrnfvu7ihiyw2hllg2gmryjzzy5we3luqqzdxdu2gjgd.onion/','wss://mcja3k7s7godsfe6n5cji5tvh3nbhacbb2kl7j5sisias4s3uls5cjid.onion/','ws://ypa7lw6drnlpfrzch6yf6munw4oxmvkx2tib6pgvcyy6uz3o7owbz3id.onion/','ws://oawrnxgy562dfio634kgl7b6sea3xpkfiy5hox2o5wxidhg5wv2uxxid.onion/','ws://qdfwxxteda7w2yfhvezxg5sfiopzqhrobubibwmqhpinu3aplweyz2yd.onion/','ws://25ilupgaihbfy5dg34owxn5o4ghw5hrsk3sxivgzbh42eugelu2qg2yd.onion/','ws://rl3bpvj4r23chkiqmukexzm75zhikhrfkq3ay3yfocht2spca7oglyyd.onion/','ws://j6cmhm4aypm5w3zmimi3piyxtagsf6johddpoy52nzk54mmttlsisvyd.onion/','ws://kvxyckhnt5o65kj5j7glq5zcyydo3th6s2vfmuvgn4kejewcc6xsymqd.onion/','ws://sugbb2ac6ulihspoyrpzhfq4t3tlleetos4maurmad5qxuyupsdjqbqd.onion/','ws://7nliil3y4br6mgi6ppdaeohvwully5zcjq6k2psmhxsrfzvrt6fgqpyd.onion/','ws://7mgdw6fx3dnrerfp7qi7ougawae64hhvyxxlnal5pbhk42egl2ahsyad.onion/','ws://kapow6myzlfw3bp4mtg7gnk7goivqj53khux3gaahzsx4bk5tvd43myd.onion/','wss://i2se3mgakoo72wtz4kxmsb2qhtq5npe4eqmtd546j3c2tkqnhpatq5id.onion:5051/','ws://7ab7qqbj2dw3pjnkoskgsfn4ikqc7orwnkpmcfjmeobw63kf4zgykjid.onion/','ws://fkoylst3427fhppg5exfqgcncfl77pacc4whox3w3fxcp5gaxexv46yd.onion/','ws://i5vwqx2m4ofabmjo2oedqqcxh2sxyr7eaqhw44xp4dsmbuio2tkcfxqd.onion/','ws://s3olzsl4e5kjfeojqlwq5m4d2olzhqe27lokex2uaat5x45uvip2sjyd.onion/','ws://nlmymyoxcuahgqdsc64d5rsfpi3ahb4aji7t4xu24xnzpp75cdrv6wad.onion/','ws://i2se3mgakoo72wtz4kxmsb2qhtq5npe4eqmtd546j3c2tkqnhpatq5id.onion:5050/','ws://ov47d3zum5w3p6vfsuxrei662ys2jop4kspootuaeo7ph2mwt2rxwnqd.onion/','wss://d463rbo7dgbfuxvvxpory2og2etl4gttfzmqcixdq7rpts47lpgolkyd.onion/','ws://oicprksrqs6lngfyx7pqqa6xnggr2t3j7oor7f2uzqe57t45lzmveyyd.onion/','wss://fkeci63bpjfzycup4tsdnu43fun5bswdpuhgxptnobj3a7bxwq62z4ad.onion/','ws://sgetzc5xa7cemaizxgje3m2ls3h7crgpymivfoocoaduja5ytbixbrad.onion/','ws://udy6vqpe7ff2wnrnlcnqofxwyehukfhwhnk75dmojpgnvuvkmny4jvqd.onion/','wss://3gkpphcfwb6w5iq6axnmlbvr7pz2t37uy4ofocyijzttzrbz4jy43fid.onion/','wss://oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion/','ws://k6dpciogx4fabnipku6wlce4rjv3ffjhv6gcundcxvxn6poeq2hcn3id.onion/','wss://vwuag7l3fezlzb7rgvdtwml4pdolc55m6raixhde2vsbnzb2wu2dmpad.onion/','ws://p2k545myk7kczlkxplvtxbdngmmzdiy43dfbufhyjmbcsdq2hor6bpid.onion:4869/','ws://rwuyq3f3cvazsurkplwuzh3nvkeet7mkwenjkyr5erydr2fajxjresyd.onion:2121/','ws://b6ctguuizhc24ufke7qnci7mmjyqiweobxckuhdxbd7kei4jlhilzjyd.onion/','ws://hgiwxyrrcuid5oczsbpp6junnv5obkgp5e3qtxydnliyubbzui7psyad.onion:4848/','ws://l6rv62icsq342ae5wvq6ixy5p7xh4qqpbwyurdcs5spebkwicajbmhid.onion/','ws://cn3l5hy5clqdy56nzgxvd6hjxk5yebdonrj6ovjzxqrdyuyftteansad.onion/','ws://obm5w3eou5ctanp2hjgria7saca3rd7jckzhj2ypf7dzflvpik22pcid.onion/','ws://ng4jk6yiqgfczo4wyxszuj7w6jok3fptehu533o3mlzs3vph3dvjfdid.onion/','ws://vzipcmpoozslbs3mu3lf7suytbg37f6cbsfnrx6mchlwwx3js7mlo6yd.onion/','ws://hqg4akteavutf6yvqlvdzlp42dikbiwbzze5e2u74h5nmzcck4kkztad.onion:4869/','ws://4zrunebih57emdhkjs4f54lka6cjrfvttcxqrrm6qp453n5zkdc6m4id.onion/','ws://klj2kw3nisdymeklnqqq3qspweytflea7vuvtiz5fojkjxuczveqi3qd.onion/','ws://x2u4kycsvzjnaxi6p7xrujnjkt4ydkg7ajmocoqruhngjzbzrmaisiyd.onion/','wss://eilztymyqseral57oyise5ai4jhrrwntet62nzdw2bxri25x2atmjpad.onion/','ws://cxipyc5yextcvgu7j5roc2wf47cmj3475dg5d2ynyof4ejrjx3emngyd.onion/','ws://x35dl3rejgyzaydvbggfhlo4obqab6szgdcmk6c4jmu5wewumtcyohad.onion/','ws://l6vwv4pvllodkrzsykc2bxkm6tz7ixva7dvgqwoffaxgqkfockeiisqd.onion/','ws://jdesvazz3mmhcc4fzefmpy5o5yelmyqwp5zav6434tdnsuej5bqxkjyd.onion/','ws://westbtcebhgi4ilxxziefho6bqu5lqwa5ncfjefnfebbhx2cwqx5knyd.onion/','ws://hvip2ofosdx4d4nbc37si2pzshzvfhdak27kj7fp3fuoiic5m7wfcyyd.onion/','ws://2vsxusqjz3r3yw62vrr5bzfwgvoznq572bn7yc2vupeme4q6ldk25rqd.onion/','ws://xvgox2zzo7cfxcjrd2llrkthvjs5t7efoalu34s6lmkqhvzvrms6ipyd.onion/','wss://jgqaglhautb4k6e6i2g34jakxiemqp6z4wynlirltuukgkft2xuglmqd.onion/','ws://yfwysqog4uq4h5in4p23ijb7uvbk5n3ngduexuernr4dgmra6y7hfrqd.onion/','ws://ppavybjpqjft5slnpeovehbegomhwtvvxtesvwwdrfndz6qe2c5kf2ad.onion/','ws://umlud4dibjxvxnnuh52bnewz5lhbcy5nur4djivdqzfc4kgafxn6fxyd.onion/','ws://cxx3pcj247nbjh25rhcftsuf6q3j66fodqlbqxnhzcahtsneplp7mdyd.onion/','wss://bitcoinr6de5lkvx4tpwdmzrdfdpla5sya2afwpcabjup2xpi5dulbad.onion/','wss://w2do75kvolcihgcsad2ftpswl2z2e6eckrvzeajyfrzpzdr7rc37x4yd.onion/nostrrelay/cyberpunkhardwarepublic','ws://uwite3qj3gbaowgwt6f2zh5c467vsmltv5smt7ikjnyickait5dsoiyd.onion:4869/','ws://dqvxkinwgigory4vd6jxydoefae5peg75pndpqpjtmrem5i3lzcfzeqd.onion/','ws://wcl2meyp236fa3dmfzfyq6aacbdoixrlocb6zozjs6xklxizschj2did.onion/','ws://ggnqqbsrrvl3s3rbo2zmdgdrezrwiws5y5iwnpgnucw27yjb2vccriid.onion/','ws://d463rbo7dgbfuxvvxpory2og2etl4gttfzmqcixdq7rpts47lpgolkyd.onion/','ws://lujwz3erjdmajtydlujhu6lqwahabiwpd2s6mfzdf2ukv6mflw7vvyad.onion/','ws://pk6v4wk4p5dcfs32sdzavi7qnrcmweini24iiwaprpswp6ingj7hp5yd.onion/','wss://v4ecnsac73aeirl2klgqbb75xyeyiugul5jfanhgv32ohzx7qz7nfxqd.onion/','wss://mmg5suaa6rhs4spehrb37lm4ljpmbuxdwvrcsvdkgkjvkjqdmcgqfgyd.onion:4869/','ws://i6adjqrnqagzghleyrn24y2euzuy2fvfqacryuo7qh3zy2e2jg2jxdid.onion/','ws://t57bl762uvksj5vkj2a4pvt4hcmfvwabl2o6nfxlfhztcblpowi6itqd.onion:4869/','wss://esspnm65ivmmszm6qvygntgms3ogpeivhtf26wasrn4urifaqnetp5yd.onion/','ws://wot7hxow45khs7xnnb76t3t6vb47spksek5asl5mnuxj2mcdspmmiiyd.onion/','ws://5qhodnpamhdzvecljhck2xs5namu7ahxse6cx33m3gjadlvwciiq4zid.onion/','ws://jqiwgflfw4dezjsy42frompmknrlcfazoiyngftgknj7yrmnhtobd7id.onion/','ws://4aqscgfx7jdjj3paqxzovdt4doghwbju6gdmdlipcoeoyxgfqoubfyid.onion/','ws://rmm2vvgdfhvzlt44ik5f5talxvfh7v2qukxwsxhwxky3vatpelqifpid.onion:4848/','ws://q3eny3xn2y75yfgz5ycazpjurdfpedetbm3vijwep3d4br3rbpwehqad.onion/','ws://b4rvhevt7zohqml5bc3padjlrfufsa7nnvtodjt7a7vmsptsu73pcnid.onion/','wss://vdlw3muqpoid5rfodvikdzb5qrtwsit6kw7yl24yjib2cfhbrzwi5had.onion:4869/','ws://6mca6tdeymuhr7zbljuahigp7fao2dxqc5hp26mr2suagslnafbbubqd.onion/','ws://vcgcgfajhyaj3rmh63v7ibyh5rkwl7lht7r2f2rag3pjb4omesseu7ad.onion/','ws://gru6s5jsamoohmiyjs36rou2tdq6tda636gpick5ajkz7pis36flwyid.onion/','ws://5fjh7va2fdzzjzbrm7crih7l34dvcvkrp2j46puiw4etared3evwq5ad.onion/','ws://lmlpluzuzw3d5aoe5rq6p7qph7h63vch73odjeyk4mx2fc56d4nfxhad.onion/','ws://dgtn42cklknz7epgeg7lb3hbcqedf5zkhq53xqhhrnxrs3weicsiy7id.onion/','ws://bsvkcspelzam6txidecavetbo2fbf6dk3fw5wxzlilkp2otd4upa5xad.onion/','ws://6dazb237b6h6oxko7n2ctb342aa73hcvs6dhd5qswyco53ctledw7dyd.onion/','wss://nostrland2gdw7g3y77ctftovvil76vquipymo7tsctlxpiwknevzfid.onion/','ws://qmvzswzhog3b6y3t4mscke7h6bkgjowbguuwkcztt3763ks3wpqepkqd.onion/','ws://f7fwz6e6byoou4mv23cdaga77kqs6zbqigksh6fprdjufyjio4f43dyd.onion/','ws://j62yn4s26abq56ppuhlqh4ybknmzcxhafer6qgf2tbvvrn3aqcos2gyd.onion/','ws://sjau3dsbizxnyafx26h23gaxhtkloul5l4ybcyisi2j2mnvzripwwmyd.onion/','ws://izj3isbk3pmade74ontdijodhehsytnw2iokdhh6k3flk4mq2pau6sid.onion/','wss://nlmymyoxcuahgqdsc64d5rsfpi3ahb4aji7t4xu24xnzpp75cdrv6wad.onion/','ws://3epscgcczfzxwixurznccs4xhk7uhayelu7jr4bpgwnqege2f6mrsnid.onion/','ws://ukoxfsiyclnd6qvv2sgkl4xawe3bnty3hq6itbgubaj55opwavczwnad.onion/','ws://iykjvbzukrdz6vog2hocawf3mcofkqrfad3iyoawcukmwnmas77dajad.onion/','ws://7nj3e5opqjcpyaoxi56c5yvgzc3b3dmubbk4c6nrdq5lnzn64g5jwuad.onion/','ws://rgy7djn4e7syquo3rn5rggtjr517rerms4ydzeengchmjzjd45pfi2id.onion/','ws://ulouqm7xil34hhxqjt53i37mu6iu447cglxl4yiilda5d74ndvgvshyd.onion/','ws://relay7me5uwxovnleekyfke6u7lzto4sbahori3gnegcu67gzctmugad.onion/','ws://btcqspp5dl4rlgl5pomcyv3odfeki7a5zrmjoekyu5vsoqz5bth4e7yd.onion/','ws://2afa3r7pos7lenfcuifskc76wyxqub23w4rxc3nvqgtfuig6skm47lqd.onion/','wss://6bfgmgklzieeckgs2dfe3wfn46pllwxfax2i67n5kibahso2sdhghyid.onion:5051/','wss://hexvpo6qah53lnpwdrjpxpwcf4qzdyhxhw5fj7revkuyezge4rjabsid.onion/','ws://zvq7etgmqqzmn6k4xhxelyjmqx7j2wqffszlcqudxgy2ugg2uw553eid.onion/','ws://pqivpgdg4jffr3pn6wpii2o6nwhqkrm6lonqxcr5j6v4uu77kw7tp2qd.onion/','ws://nostrjwmqsxeopjgjukebpzupf55ko463c4j4c3pztum3o6lvuib4gyd.onion/','ws://hw7ncgn7rojohajvtlezmhvadlfsk5yeg5fmv6rv44duvcmhr5oc5vad.onion/','ws://bvmokmzngnsfmm7qvytcevxxyx4peilyh74tyhx3xdcuhkzelf6o5kad.onion/','ws://zwvn636mfcvjyur43xksphhc35ebz26vhrmd6kuf4k5dk2bmndkssrqd.onion/','ws://b7q7f6opgqzzlnmd65a3tqlitqgvamj733wfog5o2o2kst2zffix5pad.onion/','ws://fhxk45g5ylv3zukxj3uhmtvl77wruhme3up6a7tzdw3tpifapb6vx4id.onion/','ws://bmlxyy7zgcveunwxyplvf5hhr7k7qndcholx3hceqn5polhkf6dtkdyd.onion:5050/','ws://6czvv6vyhbyns4ntc7jm2v27datee5xytqx5x3q3gesdgtywcmmqzyyd.onion/','ws://4edeaurvgbfsokkh52oofj3imr6mx3rtojhc7xufq2eld7fx23jdpzyd.onion/','wss://zptnjyomn3v6kxcpfd5j5x7kbgnjm7a6crl6mz76tv6333nhzjpyx5ad.onion/','ws://b7x64dnaort5kxbxd6gjxuste25is2vedmn6paao2wen7ktjiukusvid.onion/','ws://4ynamw47z4fiyusrqo75q6wzncyqni3ut6io5qm5sze5nblhgxlclgid.onion/','ws://qrfx6l5ks7f4f7hg5lajtam3nekwau2juyj637rryarnvdc5ab7bjsad.onion/','ws://3vp46rj4ahp5ghcng3ukjoewi76c7eerg5hve3rj7ekbj5dbmv3mcaqd.onion/','ws://v2lx5637lc2myerp2kirxcsfdu5helke2ozk4latqoem5q2mws3z6fad.onion/','ws://nerostrrgb5fhj6dnzhjbgmnkpy2berdlczh6tuh2jsqrjok3j4zoxid.onion/','ws://nostrnetl6yd5whkldj3vqsxyyaq3tkuspy23a3qgx7cdepb4564qgqd.onion/','wss://6phpk6vlfctkqxmei2zou6zxaaa5ccbt2zqfbt75cxbfsfwgnqlmi7qd.onion/','wss://binwxjynk35zwnqsma44gigbkxiugalwvvne62ikj2be74oc3z7zklid.onion/','ws://3rpykuwfpgjijym45svczvzpbur6t6x4b67lnvp6wxdre2cqoy6a4dyd.onion/','ws://owb3g2kebnoqpl5junsj3q6j6tf5tekx44pdj65o3rtlvlhxmvvskiid.onion/','ws://atlrk4jzycjfbyukwuzzav66oxifxrmvgyamnsfn3c32zj7dgarfz2yd.onion/','ws://qy3nnwrgp4j2fqemgs6fzsu6vm6e3oqmmr2fvtbfset4cc4757xlsvyd.onion757xlsvyd.onion/','ws://okqluho2oqtyzynqqido373cy4rgjvbqsew6xtopehzf7l3qjvxpgiid.onion/','ws://qf6zhc2xczigbclcashehojjlz2wscmhtdcbkqrkshowm2dddxnmfwid.onion/','ws://74iflv7zt4t2biqr2wcxug3u4zoe275wmkyyxxe5exycsjeydmfekjad.onion/','ws://1414gzx2dt1zbqz2g25xutfimwerayi2yb7wfmcjqpzyw3bh3wa6tiyd.onion/','ws://ek3dyxxbdirsifmmt3sawvxhahsbjj4fvagmopuoof63wzy7moifg5yd.onion/','ws://i2uwfnqdfmfoahdwbs7nq55ss5l2sk7xigz6bbnyqv4njvcqujalxbyd.onion/','ws://umha4zl6xk62a4dous6e7tq4qlmt462hlzs2su33en6qrvtvs3hkjgid.onion/','wss://kpa4k6acxzjv2m2p72keftbpaymwpq2h67jqnin3d4y3djxyheuifoqd.onion/','ws://ehktfcbvjhk4skh64o2lj6342pj4d6z3mceu3i7st2f5ftiile6omtad.onion/','wss://2vsxusqjz3r3yw62vrr5bzfwgvoznq572bn7yc2vupeme4q6ldk25rqd.onion/','ws://qdbx2tzm2hz5krns52twqnt46jm2xmqe7e42wa7eqdp2kf7eaqgbnxyd.onion/','wss://ehsc3vsoqugf5dyzvop2o4ii7nos3yccirirlxmycx4hle5epbxppnad.onion/','wss://67b2dgcshvxmyuucrrkgzy6i5vmvet5fx4ebdpugd2vjndqgksy4q5yd.onion/','ws://ihb3kvmkg3mdh3j2oxkllfilmuhvx3f2sdvhqsqqtne7377562hbvvad.onion/','ws://4ieqdv5i2gtgez5lavwsxlhtctywwmgdrctpxhwz46jqxxymc3bx3rid.onion/','ws://46zhxb2vjjc5qjqkroyysfgi6p6nju45flmw6kzwjef7is6rswikciad.onion/','ws://ylnwtd4yfsitbz5jewir236z7ffomofngktt7e6neb4nvssxmry52iyd.onion:8008/','ws://ohrgzu2gacnhoxbi6ehgf7k3r22qr2pmby5cvtuzoszw64lc3wbuwtyd.onion/','wss://t35sz3walldt3zwqyed4zjm4kjmcpou3un5ikakisse6ir34cxizw5qd.onion:5051/','ws://bostr7z7fbtc7bp4i4qh2jktpttzi42vwrjckpdbbwdzobo4aqmf5yid.onion/','ws://2wxu34354im3lycfmvtu2osvibdjcxelxcpcslst7gg5bsqc2svqt4qd.onion/','ws://cn7qdz7afhilv7xlq4hyexnuecaorb6efb2mo4dc6o4vycyk2t2bo2id.onion/','ws://ojx2ioc3l3q2fhi54yrhonyhnokkmlngqsh2amqpahpa3knrqocm5rad.onion/','ws://cmqmg2g6dnrcplbt4njtg5mgp6lbz6miwx2kdr7dqqfkmwgceicivsad.onion:4869/','ws://2egsfnj5yc2rhcsw5e2mjbrhxa73kejr4neuosnaaoft6zohvqp5daid.onion/','wss://d6egak3woofrixu26gr3utb5qezhkktavsuwlrfqaauu55lmpudxudqd.onion:5051/','ws://647bdrgbj7rthwwumwlyhnqetcs2lmffolhcutzuvxd56v2moeu6pfad.onion/','wss://vcaearxukmnnqsdvplz4m3ae3audlwjqo7uibrrh3cgkjin2gm3ha4qd.onion:4869/','ws://wrfc4thnhfw64rfjzggngssjsv7e3mhzsdm5pfnxvf7hmugylxtpwqid.onion/','ws://bywinhck627337ft6nbfv66v4jn42e2arcuai4jhizzdn3dgtruop4id.onion/','ws://maqjy352gudc766qivysr6dq6h6vjvxjyuvuv3xtztijvvuq3xunbiid.onion:4869/','ws://ehsc3vsoqugf5dyzvop2o4ii7nos3yccirirlxmycx4hle5epbxppnad.onion/','ws://vt7tikkj6ibrmju4ruza3c7jerplphnc65h4wkewmxxkjpjfi3b3lzqd.onion:5050/','ws://53snncs7vegargpaardbxjnii2oan3xpmbeaf6czwoqa2axz5mvbsjid.onion/','wss://4rcmjk2q45msnlbiipqa5nkinknu37qyczmngfvfk763yunabpsykmqd.onion/','ws://76f67qcwxsxpz7cfozlzunota2ejqznpldc5pnqtyq233hjpjzrmlfid.onion/','ws://relayg5ops3gemlsfl4o2hhx3vdqxg4mxh5aueyuoni2lbctx55cnsyd.onion/','wss://qr66tn22lwwbm2lewwpit4qojaxv7xbypl5a4dsrrk3xtpurhmotmgad.onion/','ws://lyomqwsk2h3e2cph225qcjas6r24x376q5sj3ctfifot76yc2oly6mqd.onion/','wss://dvonomnnj3n4dpqjvc4lekxpjdm77f3dp3xvixhiedihr5xncpwecxid.onion/','ws://gr2x3expnkqegonqtuxksaur6afnt5tymyfxh3n4yjvla5tdofjcx4ad.onion/','ws://breoqyymb3xyraoq4iboypsqtokgbcikpesba75yegtyy4y5zkc7h3ad.onion/','ws://dnoum2f5ivlfwk4swzb6xgvatu2pyrbcmbtxt47obqjzyqtzuhlsklyd.onion/','ws://3hkcdv6ehg54yje2hgosvskm4pvrdb56prdakjio6vzzgf76pc2kq6id.onion/','ws://oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion/','wss://cxipyc5yextcvgu7j5roc2wf47cmj3475dg5d2ynyof4ejrjx3emngyd.onion/','ws://5qwp5ey6douuadmsagzsiiavrvkrz5uabq6e2hngacrhqc5thm7vawad.onion/','ws://in73gzmzzm5g5z6mvblu4wo24r7s6zxqdgexfc2xpnnvxcyp22ypolad.onion/','ws://relay7hxnovxvj4g55qrkcdqc2wkmfmimpuhuzrznslohumwmacwcjad.onion/','ws://4twcbwijaghwexlvd4aozjohq5u7j43u6skk4exvjq5a2b3pd57sxead.onion/','ws://6cfq3vs6m22vbrq2z55xpyr4ypps7sy7bmqwf54tcazeyo6pxndpirid.onion/','ws://frnbaon54mrm3js6lyjp4ootj4nhr3lbxlsnlffrko3xds5qb7fajzqd.onion/','ws://kvvw5ianmn3vzk22mrcacbrpidrq4ihu5xyngvtvioqgqobnvxuskayd.onion/','wss://k6dpciogx4fabnipku6wlce4rjv3ffjhv6gcundcxvxn6poeq2hcn3id.onion/|','ws://wot.sovbitm2enxfr5ot6qscwy5ermdffbqscy66wirkbsigvcshumyzbbqd.onion/','ws://xaq4u4zuvmlgkdfjpkljli5lvecyobluu2565y772mtfxv3edwbk7eqd.onion/','ws://aiel6fjhmprjjtbmqolncmlkrjsqd6vudyn2yc7pml2akwvsgn2kokqd.onion/','wss://ps4gsesp2r2qxnc3umw5wni7mic67zpy54c5kad6mt4fp5dc6dq7kiyd.onion/','ws://722ihefsiouraoef3tiwo3tnu5v6g2paofu7mcxolrk75s7imeifarad.onion/','ws://k6bzq5ajzauf3ai5cupzltnycmgfpjokosckcm3wje6cqokmca5rcgqd.onion/inbox','ws://3cuplfdpvmx56a6l4c5jf3556fbd6obxaiceiuqlhfshy6uj263sjcid.onion/','ws://frhyu2enatdah5xnruu7ofeldh6y7ade2u6bpszlvsnfro7qo5lhcsyd.onion/','wss://6vnnhyxo2pkayko7pbn5njadaslizibrvctm6fxgusjn5oxpgjo747ad.onion/','ws://3nfl3gjoigjtwawja7g7ak4inz5usx7bzgyyzoint3mhpqf5qmdjtbad.onion/','ws://mtmophznxnuduly62owrlrjgtxwko25rzv7nz75w7bvkwabqy4ksdeqd.onion/','ws://kqw2sqxzd3x3szmnema7oexn423fg6tsmrtdca72jz3futz3uzbcnzqd.onion/','wss://6tzty4fhvkwtcbzsapbdbipgre4szcrhucatr6dqxdyfzfnkma2nryqd.onion/','wss://cgatsgfmygcukvs7e5u4ka2n2fbx4b5togvxn5k4vzulo2mg6iqdysad.onion/','ws://f4xyivffubak4tlyg3jmnd2lumrq4cxgwr2ce3xyln4ldfxtypnqhkid.onion/','wss://5kxt6jjfiji4caj6icr4a63pu2fjbvp7e66p6zdgcfbjykd2bdha53yd.onion/','ws://m7fagtdhz3ewcm3kkrroiy4y5ny4wb6dirj5yxa4ysil3iju6rfpwqqd.onion:4869/','ws://5xosjztyh7s5jfjpanpkyvhoncl7iqpzuolzrfxnmbi5lsf3x3kmbfid.onion/','ws://zemwdxq6p3p2ma7hsz7ru44ftq6kkbaxrc4k3sgwlyyhn5jyhll4zaid.onion/','ws://4dtulxzurcziwofjyud2y4rwiivggrdgdfhtvlu6gk5ip75lglceljyd.onion/','ws://uec2cmjauzufrtlq6wq6l2ujfncdvo3suezz423gsvz5xvhehm2mcgid.onion/','ws://ewhcuggsqtwhqydlhgibgczj2apajdmdi747xaxgmjlv7gpj7twwgeqd.onion/','ws://tmmowpg336a4c443rffdv5ozzhnios4wxqiidbmp53xwtb6svlclxlyd.onion/','ws://bwvv22uvjyauk2gqpaee3fd2i5pdgaq537kw4j2ddomfsjdpr7jq7pyd.onion/','ws://thqznwwkm7ast3b4fzyodksvgdsu4gy6lzpgflpdis3gyigqefbi2had.onion/','ws://7yczz2hzvfpykoqaai5vjsulnoynfnlg5mlxrbfhli3konwnnxvn3sqd.onion/','ws://uan3fdcrsmc2khy6wex6e7swotgbv7swgtnvoih4o6v6f4yib2lmp7yd.onion/','ws://7l7zn2oc76uzuvxfykau4fkmtipbgs4msqvl4cn5f3s4i2puwuopz3yd.onion/','ws://kft4yriwr4gmb65o7lfs5zbyycplh44yqrukt7s2rvts6sdiecddxsad.onion/','ws://t24f3xdqj5qeorh2u2r4hqpqybbk347u7franp4jck5mdojkqmywlmad.onion/','ws://2u667tb3jvjynlpkzp5cngutfn4hhzgljjw6xnho5uabvx3fz7jzdgid.onion/','ws://gynultrkibmesqeckt56nj3gav4qbisanfgg3idg6faj35nt32ryjoad.onion/','wss://x2eidxmku36cvw5pjlka5f2x3uchojnzshxkakd3vhwp5bw7rjupa5id.onion/','ws://fyvnu5jecszlmepjcsna62osmxrqiyhr4u5qmhimmyd4spmjrk6utsad.onion/','ws://lc55mp5hpkv5bq3bsfcsj4ibhhvtifdjuqmjtgktsx2tvkuqxzsgybad.onion/','ws://cjueyu244i5h35pfgsdobqdf3veugiz7chb4e57ww4pnrdmt7owh3uid.onion/','ws://gmwcombkmjnylbrluo2jq257nz3adhqqhdc3wxrhtgawpnoftect7tqd.onion/','wss://t3tw27pclwxbzuzc57vgwjivkdsdban466mjp4s5sskyp2oj7sey7zad.onion/','ws://4mz636v2nyvpg6lapl6ldyxp7clb4gw7r4itmxfpc6hqiaxpffuzx4qd.onion:4869/','ws://jettqjajeaneorliem7bxfcslzoagkxwv3bcb6ylstouv2hanz2crgqd.onion/','ws://ua3i75lsj64xx3nlfqq67w4rcgup2ti5vrjhsx3tfpqvamplotcqvyqd.onion/','wss://pbkvi3ku4aagmxlwlrieaqw2cfpoqrfmrtjfutpwq4uxm7sdx5zv2gqd.onion/','ws://66jnldboj7c5dibbuy46bz2ynlxjiwb5qwfkxfkjuqg67ipc6rq2e4id.onion/','ws://5laki7ronqaju5yrck73big7mf7q3bctqlyzpuw7qsjqhl7ynisltqad.onion/','ws://t3ognyww3r2dxx42zudzzwjxllu3u4jrjq56itkbtw23tvmnb7z4x7qd.onion/','ws://ebnqcyniiqlcnod4ml4q2rgyflcndgazo77biszf2kperxxgnwdm27id.onion/','ws://tlbgm4jo7xnofobuph3bnlrf5mjeeaeuwvfe4dv5rtyv3gaiev4rzmad.onion/','ws://r6o5pkz7i3j5jkdqwj2cb2u7gjbynp2fyikcgkvn5zfdooeir2zgttyd.onion:4869/','ws://paqnvs7eqxwckk7ohejsfv4lrr77jsiirkfooy4nlq2gulmxoajhlhqd.onion/','ws://oifvb7zmrb5rqohezk2x5t7bki7xcphiheteajxn5uultycxnanvx3ad.onion/','ws://emxbdrx75hemwytukd4upieln7tdwgam5u7leri2wrtmck7qrgwdmuid.onion/','ws://f3ya7xc3sr6lrpgffn5y7eiicwuesftrqz7flp7zasuwnokxtjnpgpqd.onion/inbox','ws://4wicgruy7qoi2ht6cjakzwrljlz4vkraos7l45khjpve3p5cyxhocdad.onion/','ws://sovbitgz5uqyh7jwcsudq4sspxlj4kbnurvd3xarkkx2use3k6rlibqd.onion/','ws://relay7s3bd755i5jkav4q7uxpdulnn23dpyiiyeqjwuxjwyyyvkmfwad.onion/','ws://m2mb4s7g6ljubrxqyucs53tbsvwqr6qxrec5ohkgo3eujcd3dvem2fid.onion/','ws://hq4s42nukq5mwo5ncrcnvnvpq24qxleg7zdjavve2gcefdpkzztpm6qd.onion/','ws://uizdc3nrqznwngo5dsc6a5wvblpp2iksnsqjrvlrykijg27ixzssedad.onion/','ws://gxi2qpd5kul6b4ivusccdtfmzg5rsfsz2kzrnwj45ycnpegq5d5zjhqd.onion/','wss://icwglcrp7dee5htyv34mufmiygjjrnts2htu3boler5r3vwlqykekryd.onion/','ws://dnppj4kopczovvzvpzmihv2iwe5wt3gbrxjnltjc2zdjpttrdz4owpad.onion/','wss://u5n3bl6kdyfrfnqkzxr4o23a2vrr6dzrbracf7tmtugypsmg2gg725yd.onion/','ws://xbnzpoia6zk363zwguzrzbp35u7pawrpuhieshk675ihxleak3bja5yd.onion:4869/','ws://gcvp5n6rqxuzy3efmsl53biwgvbz2tbyj3425edobqy5tyovniktsrid.onion/','ws://gppks67wkunusq6umbbpktq43kdlhtc6di4imk37kpp55vzoo253mjad.onion/','ws://qyepd3umtqgr33zq7drx4xkfxvaojq37pal5b7dva6eu5qb2hi4ykdqd.onion/','ws://su5ll3reaz32er6v4ndwfm6vewj4donchrb4vbsfymqiwc36fad7whqd.onion/','ws://zge4ljdrqzuffwn5tie53yfnr2ct7va7tbygnhs35mxx7zzsvrlxlrqd.onion/','ws://qsmym4jzgfvfh73ggl6las7wzhahhtlljmi4oha5fhqsywmhfanckfid.onion/','ws://thohd2q34agprpzybcmgrj7aky5tapuwkinj3zbiowe6k5asnnas7bad.onion/','ws://t7jvqwu35hneszx7fihsprbcpwonlcfnsjr4xtn6shqgwbv324w4gdid.onion/','ws://7au3i2gf3kgxseson3bqitzy326bioodm72uf24bzg5wsnwqgntjsgid.onion/','ws://l3iybjimtzt5hx4y2wk622hgvu4b5cthykmdof2i6j3w5lbpnbh7w3yd.onion:4869/','ws://r5vfqpn6u7d5yhdcmaxgtjntcgx6ltf2ign4c6jojd43fprfpzwnzsqd.onion/','ws://mr3hxrdqv4fez57bgjt2bohdmplek63x7tjqseyuywbnnpt45v475vyd.onion/','ws://eyijqxausq54tyebmuywgwshils66fyr4qqbdcmn2iaqqesls25ad3id.onion/','ws://4h2arjbtkl65ievdid6x3xcruuv4khnrvdsa5ayanm6opus3pwxcskad.onion/','wss://pzfw4uteha62iwkzm3lycabk4pbtcr67cg5ymp5i3xwrpt3t24m6tzad.onion:81/','ws://yhres7o4n7frrhhmfhtw5odtbhthfaid5xdvmaos3loxrlzbhrdsigyd.onion:4869/','wss://2dnpfszhci6v4k3pkn5bpozapcikahq5acscwbt3djqgfha2hyvqjiqd.onion/','ws://3vsqo4dydblqcqjb6xbcrm5gjorublvsvn6xsdweze2wwis4t3kn7pyd.onion/','ws://ehpe44o7vcsew7bigqcalpsmxz7j6xa67ctnxywz5is422jqtqax5oad.onion/','ws://r52ejnree5gsbvoq6vouwuf5dwdmm3plgyepwdhuwqsmk5xh7u42kiid.onion/','ws://wfevz2ytptlqnfmvybajxs4elldwkvbdipshom52xdlabqnp747at6qd.onion/','ws://27ypi3pict42qgvutvkg5gjv353aasaqfkn6ifntilqwzizz55c2ilqd.onion/','ws://bx3txkzwgwq5y3oa2rwt2px5h5g7ollfrxz7h57c7gpwammliutqjfyd.onion/','ws://3aqu63p7tpclydcvzmendfozel4twpbldsu7aau64d2pu553pu7nibyd.onion/','ws://6phpk6vlfctkqxmei2zou6zxaaa5ccbt2zqfbt75cxbfsfwgnqlmi7qd.onion/','ws://nybmrt2dpgfqbgsqrih2grcifko5w6jyef2xhulv5t2nbq35o7mtd4ad.onion/','ws://e4tts43z3nngt5kyspptuaizqboemfaoj3dxliakmg57i3thnptcpcad.onion/','ws://wineinboxkayswlofkugkjwhoyi744qvlzdxlmdvwe7cei2xxy4gc6ad.onion/','wss://647bdrgbj7rthwwumwlyhnqetcs2lmffolhcutzuvxd56v2moeu6pfad.onion/','ws://2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion/','ws://wd7jku4nt4ubsvfx6s5tvfwwftcje6byayiidnniqfcu3kqjqoqubqad.onion/','ws://6vnnhyxo2pkayko7pbn5njadaslozibrvctm6fxgusjn5oxpgjo747ad.onion/','ws://ps4gsesp2r2qxnc3umw5wni7mic67zpy54c5kad6mt4fp5dc6dq7kiyd.onion/','ws://wyro4ob5632pkpyd2mketkv7ovagxp56vbsdvt5gfn4aveazacyk4iqd.onion/','ws://z47nu2k7ghwv2sdku4eq7jvtnagoqusy7cbzacnb3f33aqazehl647ad.onion/','ws://q55o2swpnv343nbkjsiwq4fnworsxy7ydc2pitoo42nhq23zy4pdboid.onion/','ws://ofotwjuiv7t6q4azt2fjx3qo7esglmxdeqmh2qvdsdnxw5eqgza24iyd.onion/','ws://emk3cqkhswpzb2kaqvhlhi45bxz3pmyhidgcit4qsez6x36pk4jyj2ad.onion:4869/','ws://5puk33lhdr7j65tjphn477zmba6ipptrb5rsnrknrw2hkxvxg6hkwvyd.onion/','ws://isysjt6qb7nqg2cfede37kaykoo7dyb4plo63emuyisbkmiqhrgk4oqd.onion/','ws://kxcuxu62s7j2tgkzjhazch7mcg6pg3uyxc5suj4smjnpdqdzbk5xmrad.onion/','ws://6ntduxfibtmsi5jm3nasrltssjhf6zkjz67niogu7giqfsbbfl52unyd.onion/','ws://jgqaglhautb4k6e6i2g34jakxiemqp6z4wynlirltuukgkft2xuglmqd.onion/','ws://yvggf5r2tenx2l3zcj3hpwb36mshore3nzrsattqusleg3apfsfbpsid.onion/','ws://anou62kg7dxjiq3o2los5pqjhmqxndrpbyazxw6cmgjrs6f3jm6vhkid.onion:4869/','ws://lproxnb5xpeomugwmbhxywrihu46cimm2ikutcuvzkg4d7gvw5nn7sqd.onion/','ws://u76rjyiefi6omf6nwi33op7gfuqvzwhoj2uwlir3v7amqb6butikcvid.onion/','ws://4rcmjk2q45msnlbiipqa5nkinknu37qyczmngfvfk763yunabpsykmqd.onion/','ws://chdqvqhx5dayjfmzql3qxf3rp7vntvjmcv2sxxzgrn3jels3rxga5qid.onion/','ws://nk5rwyupoifysh4w3cb7hvwnkmrl5cfjymh2yk6ioecjidbokogq3wqd.onion:5050/','ws://ppva2qoo1473retxesxknanniqsk3bkdscm1447iedffrj5d4igptiid.onion/','wss://lchdldwpnkzugmipaxkzo5dazeblieegp5txcueryn7eqyjbpawaprid.onion/','ws://xmmim5ecsjtrdcdpaygeshdmuiicedjwbrjhwfg2lnbmcqfqhuyi3yyd.onion/','ws://relayzkp35s4kq3lfamv7brpgwtungry3ysiqf5sspslqncffwbuwaad.onion/','ws://ykfmoqnmdhjaw4qkihvqigrayiusclfqxfh2lt3frtlykody5wwvcfid.onion/','ws://z2u4gkq6khqhwnfr2hwi5sbwva4hdq2ath7sncw61s4w3fq3gxtxxuqd.onion/','ws://s2ofpiay3yozmqqxjyvsmzrptypaxujqfuid7uh3u5un6izv5khkrkqd.onion/','ws://if4nmnw5vasc4yxw557zqxacmc3dc5z43zv6uzhcjzgrgr777onnzxyd.onion/','wss://vaos7ctb6sc2qt4s6aua4nidfcrsalnetsmyprqp25rlvl7emm52soid.onion/','ws://531xtye57ws2oncbix6e5zmshcpt34bwshmhqeixewuurxhhxhs5mqqd.onion/','ws://amfenmirzxbvq5zy726sg2tdmoyc4i7tabzkh3lobhjn7vfiyvmcw3id.onion/','ws://geeafhmczfy5jmfc36ud2vgfotsrdnc2vwrp2kczjka4afx42quc3qqd.onion/','ws://udnuxcb2aig2spfu5d5qbfkwzww3vhyldjceqvwzv73azzmr7hg2zqid.onion/','ws://v3ajublh3kx5pcx3nz334v6y2wmshrf27mnato4mj7iucnayppxuwpid.onion/','wss://b6ctguuizhc24ufke7qnci7mmjyqiweobxckuhdxbd7kei4jlhilzjyd.onion/','ws://hqn6i5qd4r7aaqhqu572mygp63oqec6dsqqgbzfkznckx7chw656zfad.onion/','ws://winefiltermhqixxzmnzxhrmaufpnfq3rmjcl6ei45iy4aidrngpsyid.onion/','wss://u5epuanp2fbie4phw6zekzna6zotvsffji4td4ee7iwgwdxlz4kwqqad.onion:5051/','ws://lmgfxsrx2quwhqcxvlpl4iley4vbqsm74nrg45uxghcjho2t5a3d6qid.onion/','ws://txmx2idbsp6upsfvdamnag7hsz3ct2do3enym5ee25cqncycnrfqmjqd.onion/','ws://lopntm2isiposxq4sqkn3zyhgk2kb7bwovorgmap2qiyr4f3zmpa34ad.onion/','ws://nazseaearii5kl6e4h47ohf7rebdtx2h7gc2uaaila2gwevtu7v6xoid.onion/','ws://w5iw7zprgonlb2aqi4ict4bu4rhiu7fceshoxbztchwic6bc4lzdr6qd.onion/','ws://rhrjskh7c334oy461fsqkuktui4qtdhpgpq4cl7uajvbdkhmvz2biqd.onion/','wss://bmlxyy7zgcveunwxyplvf5hhr7k7qndcholx3hceqn5polhkf6dtkdyd.onion:5051/','ws://z6nbwb23fuvoj63nv2a5x4eggnl4rfetfme4cdo5z2hluzqqzsgp4pid.onion/','ws://hcutzbpxawnnl25233nwxwyhevud6ymoyv326bk3rgzfqbixb555asyd.onion/','ws://qlfng4my5odwppmgudedxw35ol7pdthvjnjryjp54kkbutwn2673baqd.onion/','ws://wjh5tppbvw5w7rlqnmhs4er26ny4l6ptzo2ojhybvp73xqs7kjylcjid.onion/','wss://56coknty2a2enoxe2bai5bij3ob5u2m3hx3drk66ia5sjqfxwjwztfyd.onion/','ws://sgnquoqdfljnk2t4s22k6ldqm4dj5ftdz7wn6vfjlupuon2r5omq5zad.onion/','ws://kan5zbpwgmsour6tzufpbht36ehb4dgqu4csiy6qyfv56hfn2tjoorad.onion/','wss://skhb4oi27zl6lhdgvhmcxqovxflzpdb6fnyaxr6l3omilty3w76udtqd.onion:4869/','ws://nfx577qh5gbe45wc7xbmog63zi5wwjxkzlw35cuikyhxcufhct3rzqid.onion/','ws://mrz2q7vklkwcpgojmcyuq4pstyiclcvkovvjfy2yfz3gznmsgsqafead.onion/','ws://43e5so7ttmuyhtx4ygzdqt555rc6rzaqgezszvzzmftgjcw2jwvtjuyd.onion:5050/','wss://k6dpciogx4fabnipku6wlce4rjv3ffjhv6gcundcxvxn6poeq2hcn3id.onion/','ws://ovf66cg4yh2gpcykp4256grgxarefyrrx6tsndmb6qyqw4yfp5da54ad.onion/','ws://xxtuszipqskgbt54leaj5okc5cljnu4s6xevznzwwa4lniydkxsor3id.onion/','ws://oh5ooqlm2wqfs4bwp7th3drxskzbatrupqfvmahrbpgfkscidbophbad.onion/','ws://fylz6yz7dz7trwsnawvtw2vzegrbwu7b3ypcxkolcgy4pasbe3d3ysyd.onion/','ws://rvqkqr5kl3dvvxyn67rfowcnvoflx4zby5tjbysavym4ycckti4dbjyd.onion/','ws://moauxczxwvggzqhtgjjyjqzmdmnwoxaa7mmgk5veljylj6yev4lqddad.onion/','ws://vxlw4rlg7go34ol43g4gxbvfu4txdzjauquvnbptzwjflezs3vik55id.onion/','ws://spunnu5rjf6us3x4sh532dvetq2zybdnp3p5fhdpek4c433rezrq26qd.onion/','ws://sjlsht4e7omwvyzec4yevtiqsur6sexpg4q4zftmx7x6cyl4nlds3tid.onion/','ws://rgy7djn4e7syquo3rn5rggtjr5l7rerms4ydzeengchmjzjd45pfi2id.onion/','ws://2tzupknv7zect4ihwbnqv6may7sxdx42yw2x6y5xzp2yazedhnug23ad.onion/','ws://kfmajpsnnektp3oirtyhmwsfnpnupvq6s2ddz6yvwsgfhnmjkuewwjad.onion/','ws://uhbmn2awydhnac4gwxj5kgnjxmt6ze3nixan7ytjp2ng4jhyuqeqfbid.onion/','ws://wzpkfsf65abkmj42izjqigzvrjbc7lnfscb7hjp4eh6u3wboefmyopad.onion/','wss://ikjblknho6nvh5r7f5jg33hn7ga6x4r7rjoazck4srkzaoewno3bcyid.onion:5051/','ws://cqz6fnvxxyzpy5d24s4yo5flnshkoko5jnk27aylbw5bdmzo4m25rbqd.onion/','ws://d6egak3woofrixu26gr3utb5qezhkktavsuwlrfqaauu55lmpudxudqd.onion:5051/','ws://2iq4jyqifoq5odsndtkfenzh3sxagg5rmnzzlbdee2cdjxygcsyfqsyd.onion/','ws://vjmvsoo2bds3n3zkce2kbqnthqf3hladazrirjhumribi6gk4lcif6qd.onion/','ws://6vwjdv5sq2eyicstwplwhbuvukep7xasfocxde7ddfqcpaexvmtkccyd.onion:4869/','wss://nfrelay6saohkmipikquvrn6d64dzxivhmcdcj4d5i7wxis47xwsriyd.onion/','ws://hjpktedkl5e4vkpmtjrcxqr3wmjl2rwwbfmpkevzzgct4k7eogespryd.onion/','ws://pbkvi3ku4aagmxlwlrieaqw2cfpoqrfmrtjfutpwq4uxm7sdx5zv2gqd.onion/','ws://yhres7o4n7frrhhmfhtw5odtbhthfaid5xdvmaos3loxrlzbhrdsigyd.onion/','ws://6d4sxdtqbdrp4flb6sduf3ekt7lwceaejonlw3s26say4pjeose2whid.onion/','ws://lpxyewdhgf4p26yjxl65e4in45q5qrtvyfn5bxgekl5gbytgdjjtd6yd.onion/','ws://eqsopudplbytocihxfbpg3ljfg2p2hlw4s4nmnj54ol7tvub7e5fwlid.onion:4869/','wss://zatrrv2yw2z33ngbzhpcc7xyu46lyqcgpft4bmxafcvsscla6odljyad.onion:4848/','wss://qygq6dxz2wipyq525k6ghkyr7c4a3zoahuq3zwjol7qslqaf6gj26had.onion/','ws://mhqr5h5s2sta4azvfjxohvkz77gz2pw4bqlcil7trw3weqohmjlzdmyd.onion:2121/','wss://5rhgx2gszlyb6i6v2axmm7fdfitsxvbhjfocdocoje6xfssd3eubg7id.onion:5051/','ws://zynplvfwld43e6jr73yr2q245nu22claastclhxzum56xqpkzn2vxryd.onion/','ws://gmgf5bfm24wpnz3abli7szqat36kk36lyd5nibuolgjp2mvzw5bzlryd.onion/','wss://2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion/','ws://kbkd7ws6jq6hrg4r4vl2psrsgllejhwgnrikzgeuvesr3nsutqmgylad.onion/','ws://ne3znr2wgns2bcsbyfemtxqpibusozfe7dhsgmfocbbdvyzzb6qthsad.onion/','ws://5begxlssgzlquewmbrvhdu7efzwqoomlgt6pymftdtbdiy5ypnjizjyd.onion/','ws://vdkdkgvggj3d3upo4i7fvcu4pap7dxia7mcvtvr3uin6guunnemncjqd.onion/','ws://pzfw4uteha62iwkzm3lycabk4pbtcr67cg5ymp5i3xwrpt3t24m6tzad.onion/','ws://2dq3k2yxxfdcw7qyqq7ncee7m3j7dquh5erimkficnje3rggf2i6fqqd.onion/','ws://dn3b4y7sbo3u7lrnceeks6y3udjbja55r5sm7k3s22qoum3p5y56o6id.onion:4869/','ws://de3pu275evdbfhzwsngc2abapypg52y733oijuovgfpkhjdu2lfnv4id.onion/','ws://lzybsdznklr56a5qnvj6qy45xx7qeh73ckv6yrww5ehxofinqn7kydqd.onion/','ws://ecxk5akrdstvpok7npcp7d4yplucqz3hs52z7m4pndh5ssdmesgjasqd.onion/','ws://wbsh3gg7zxcdhamsnm4jqr46gzuxca72ly34wxxtwb5365q4k62hqcyd.onion/','ws://wbpqxh4ye6oz7w7jc4g6p73sxcsoaez34p7lak4iu4jsbvgo5rhxycqd.onion/','ws://nostrland2gdw7g3y77ctftovvil76vquipymo7tsctlxpiwknevzfid.onion/','ws://zatrrv2yw2z33ngbzhpcc7xyu46lyqcgpft4bmxafcvsscla6odljyad.onion/','wss://5ppsdhepo6uugomjqh7clrkb7xvwr3dprx3mprctn627tyk4tvxixfid.onion/','ws://j65alpmkqz7tdwiwbtg4yciqga3lrd2pssb5hhzss2rx2punauj6skad.onion/','ws://vmsob7aj6r3ertwdyki5jbhzw7mdqqimccw6u5dlx3haaltncruszhad.onion/','ws://gqn3cjgqs5rwg6ib4z7bnbdlxczucod6p2yxmjslr2s2euqtguikk5yd.onion/','ws://4fl3alpefjomesawikniipflfzhzihayr6vhd5ivtcoqb2qy2v2sipyd.onion:4869/','ws://fwenvmjyzfghzvjghgck4hxng5v5unyddxvoz5itxddgvzxnucuwypad.onion/','ws://423rsvf7hhesybirx6gu2jjsedge5lqw5apnuallfgn4gdbk2ix6jjid.onion/','ws://2gl2cmmjhyarzbsv2oi2mjvugftwb7hvsnrkzddmoqbkrgkqip3waxqd.onion:4869/','ws://f5g46kofzifr32tgdr4m7otehkvsxefxh74uxci6izgj2kuvmg2t3yyd.onion/','ws://3amnnymetkm6wgd23tjkb3pyees4kkapltmuya5tol7bgvsdhnx7ffid.onion/','ws://a2x4kcxfmh2lm2cpnynpslkoilwynuzsh4zxdas7mwujkwr3xgru4ayd.onion/','ws://enq3ujvssbbypmjhzfkb7ogaadjvadep5tcbmiw6eruvu6yzjutc6cad.onion:4869/','ws://6j5ishs424tjolvaggoaklm2q62uzmmjc7mvug4hr27xixonxoklh6qd.onion/','ws://ggnu2qtf3434aqr3cehzbqbpszarnph3bsre2r5gskhbizmcne2bzcid.onion/','ws://vkhp7vozcjdorghj67qsu6tlweqjzgdxy2jyt67jhgwsh2hq4bivoeqd.onion:4869/','ws://3gkpphcfwb6w5iq6axnmlbvr7pz2t37uy4ofocyijzttzrbz4jy43fid.onion/','ws://5kx2iruvdo6hp26q42pea27r5piphdn2rn2fa5rqahslrrsp7sijc7ad.onion/','ws://hf6gzwr74rebwstmphb7jjhbg6cfak4glxjsuv5ptbhz4662zyaervid.onion/','ws://id2naxwmy573ic4swwmad7nbebfmbg2rvy5iykf7fluvejf76rpmioad.onion/','wss://wdoyvomi7rw6pr6ehxjj2ryefxdftacbammwayqckx6wbciifpq7q7qd.onion:5051/','ws://lyvlabe6zt4kctssdvq3qh3nsfgndmofuii7x5plxf2ssaph2ic22hqd.onion/']
  
// checkRelays();
run()

// // import { SimplePool } from "nostr-tools";
// // import { NostrFetcher } from "nostr-fetch";
// // import { simplePoolAdapter } from "@nostr-fetch/adapter-nostr-tools-v2";
// // import xportRelays from "./xport.js";
// // import fetch from "node-fetch";

// // let relaysOnline = 0;

// // async function nwAPIRelays() {
// //   try {
// //     const response = await fetch(`https://api.nostr.watch/v1/online`);
// //     return response.json();
// //   } catch (error) {
// //     console.error("Error fetching the URL:", error);
// //     return [];
// //   }
// // }

// // async function nwN66Relays() {
// //   const RELAY_MONITORS = [
// //     "9ba1d7892cd057f5aca5d629a5a601f64bc3e0f1fc6ed9c939845e25d5e1e254",
// //     "9ba6484003e8e88600f97ebffd897b2fe82753082e8e0cd8ea19aac0ff2b712b",
// //     "9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923",
// //     "b2c949c0fb79eaa2837d38e3ef4fe7d57fede6cfc3c00f2cf75c8ccbdad2c8a1",
// //   ];

// //   const pool = new SimplePool();
// //   const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));

// //   const relayUrls = [
// //     "wss://relaypag.es",
// //     "wss://relay.nostr.watch",
// //     "wss://history.nostr.watch",
// //     "wss://monitorlizard.nostr1.com",
// //   ];

// //   const postIter = fetcher.allEventsIterator(
// //     relayUrls,
// //     { kinds: [30166], authors: RELAY_MONITORS },
// //     { since: Math.floor(Date.now() / 1000) - 24 * 60 * 60 },
// //     { skipVerification: true },
// //   );

// //   const onlineRelays = new Set();

// //   console.log("loading online relays...");

// //   for await (const ev of postIter) {
// //     let url, urlStr;
// //     try {
// //       const val = ev.tags.find((t) => t[0] === "d")?.[1];
// //       url = new URL(val);
// //       urlStr = url.toString();
// //     } catch (e) {
// //       console.log(
// //         "invalid url",
// //         ev.tags.find((t) => t[0] === "d"),
// //       );
// //       continue;
// //     }
// //     if (url.protocol !== "wss:") continue;
// //     if (onlineRelays.has(urlStr)) continue;
// //     onlineRelays.add(urlStr);
// //     relaysFound.set(onlineRelays.size);
// //     console.log(urlStr, "online");
// //   }

// //   console.log(onlineRelays);
// //   process.exit();

// //   return Array.from(onlineRelays);
// // }

// // const run = async () => {
// //   console.log((await nwN66Relays()).length);
// // };

// // run();


// // // import { Nocap } from "@nostrwatch/nocap";
// // // import nocapAdapters from "@nostrwatch/nocap-every-adapter-default";

// // // const sslData = (data) => {
// // //   const result = {}
// // //   result.pem_encoded = data?.pemEncoded
// // //   result.subjectaltname = data?.subjectaltname
// // //   result.fingerprint = data?.fingerprint
// // //   result.pubkey = data?.pubkey.toString('hex')
// // //   return result
// // // }

// // // const run = async () => {
// // //   const nocap = new Nocap('wss://relaypag.es');
// // //   nocap.useAdapters(Object.values(nocapAdapters));
// // //   const result = await nocap.check('ssl')
// // //   const data = sslData(result?.ssl?.data || {})
// // //   const str = JSON.stringify(data)
// // //   console.log(result)
// // //   console.log(data)
// // //   console.log(str)

// // //   const jsonBuffer = Buffer.from(str, 'utf8');
// // //   const base64Encoded = jsonBuffer.toString('base64');
// // //   console.log(base64Encoded)
// // // }

// // // run()



// // import import2 from "import2";
// // import { is_node } from "tstl";
// // if (is_node()) {
// //   globalThis.WebSocket ??= import2("ws");
// //   globalThis._Websocket = import2("ws");
// // }

// // import { Nocap } from "@nostrwatch/nocap";
// // import nocapAdapters from "@nostrwatch/nocap-every-adapter-default";
// // import { SimplePool } from "nostr-tools";
// // import { NostrFetcher } from "nostr-fetch";
// // import { simplePoolAdapter } from "@nostr-fetch/adapter-nostr-tools-v2";
// // import xportRelays from "./xport.js";
// // import fetch from "node-fetch";

// // let relaysOnline = 0;

// // async function nwAPIRelays() {
// //   try {
// //     const response = await fetch(`https://api.nostr.watch/v1/online`);
// //     return response.json();
// //   } catch (error) {
// //     console.error("Error fetching the URL:", error);
// //     return [];
// //   }
// // }

// // async function nwN66Relays() {
// //   const RELAY_MONITORS = [
// //     "9ba1d7892cd057f5aca5d629a5a601f64bc3e0f1fc6ed9c939845e25d5e1e254",
// //     "9ba6484003e8e88600f97ebffd897b2fe82753082e8e0cd8ea19aac0ff2b712b",
// //     "9bbbb845e5b6c831c29789900769843ab43bb5047abe697870cb50b6fc9bf923",
// //     "b2c949c0fb79eaa2837d38e3ef4fe7d57fede6cfc3c00f2cf75c8ccbdad2c8a1",
// //   ];

// //   const pool = new SimplePool();
// //   const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));

// //   const relayUrls = [
// //     "wss://relaypag.es",
// //     "wss://relay.nostr.watch",
// //     "wss://history.nostr.watch",
// //     "wss://monitorlizard.nostr1.com",
// //   ];

// //   const postIter = fetcher.allEventsIterator(
// //     relayUrls,
// //     { kinds: [30166], authors: RELAY_MONITORS },
// //     { since: Math.floor(Date.now() / 1000) - 24 * 60 * 60 },
// //     { skipVerification: true },
// //   );

// //   const onlineRelays = new Set();

// //   console.log("loading online relays...");

// //   for await (const ev of postIter) {
// //     let url, urlStr;
// //     try {
// //       const val = ev.tags.find((t) => t[0] === "d")?.[1];
// //       url = new URL(val);
// //       urlStr = url.toString();
// //     } catch (e) {
// //       console.log(
// //         "invalid url",
// //         ev.tags.find((t) => t[0] === "d"),
// //       );
// //       continue;
// //     }
// //     if (url.protocol !== "wss:") continue;
// //     if (onlineRelays.has(urlStr)) continue;
// //     onlineRelays.add(urlStr);
// //     relaysFound.set(onlineRelays.size);
// //   }

// //   console.log(onlineRelays);
// //   process.exit();

// //   return Array.from(onlineRelays);
// // }

// // function findMissingItems(...arrays) {
// //   const sets = arrays.map((arr) => new Set(arr));

// //   return arrays.map((arr, index) => {
// //     const otherSets = sets.filter((_, i) => i !== index);
// //     const combinedOthers = new Set(otherSets.flat());
// //     return [...combinedOthers].filter((item) => !sets[index].has(item));
// //   });
// // }

// // const run = async () => {
// //   let index = 0;

// //   let nwAPI = await nwAPIRelays(),
// //     route66 = await nwN66Relays();

// //   const xportOnlineRelays = [];

// //   console.log("---overview---");
// //   console.log(`nostr.watch API (online): ${nwAPI.length}`);
// //   console.log(`NIP-66 (online): ${route66.length}`);
// //   console.log(`xport.top (unchecked): ${xportRelays.legnth}`);
// //   console.log("-------------");

// //   for await (let relay of xportRelays) {
// //     relay = `${relay}`;
// //     const nocap = new Nocap(relay, { logLevel: "debug", timeouts: {} });
// //     nocap.useAdapters(Object.values(nocapAdapters));
// //     const res = await nocap.check("open");
// //     const online = res.open.data;
// //     if (online) {
// //       relaysOnline++;
// //       xportOnlineRelays.push(relay);
// //     }
// //     index++;
// //     console.log(
// //       `#${index} [${relaysOnline} online]`,
// //       relay,
// //       online ? "online" : "offline",
// //     );
// //   }

// //   const mapNormalizeURL = (string) => {
// //     new URL(string).toString();
// //   };

// //   nwAPI = nwAPI.map(mapNormalizeURL);
// //   route66 = route66.map(mapNormalizeURL);
// //   xportRelays = xportRelays.map(mapNormalizeURL);

// //   const missing = findMissingItems(nwAPI, route66, xportRelays);

// //   console.log("---RESULTS---");
// //   console.log("  ");
// //   console.log("****************************************");
// //   console.log("+++missing from nostr.watch API list+++");
// //   console.log(`total missing: ${missing[0].length}`);
// //   console.log(missing[0]);
// //   console.log("  ");
// //   console.log("****************************************");
// //   console.log("+++missing from nip-66 list+++");
// //   console.log(`total missing: ${missing[1].length}`);
// //   console.log(missing[1]);
// //   console.log("  ");
// //   console.log("****************************************");
// //   console.log("+++missing from xport.top list+++");
// //   console.log(`total missing: ${missing[2].length}`);
// //   console.log(missing[2]);
// //   console.log("  ");
// //   console.log("-------------");
// // };

// // await run();
