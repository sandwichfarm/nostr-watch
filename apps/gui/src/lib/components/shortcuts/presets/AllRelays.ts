export default {
  title: "all relays",
  hash: "",
  payload: {
      "columnsShow": [
          "relay",
          "networks",
          "rtt",
          "operatorPubkey",
          "paymentRequired",
          "authRequired",
          "powRequired",
          "restrictedWrites",
          "geocode",
          "lastSeen"
      ],
      "filtersShow": [
          "networks",
          "rtt",
          "supportedNips",
          "hasNip11",
          "paymentRequired",
          "authRequired",
          "powRequired",
          "minPowDifficulty",
          "restrictedWrites",
          "geocode",
          "isp",
          "nip11IsValid",
          "nip11ValidationErrors"
      ],
      "sidebarCollapsed": false,
      "sortState": {
          "columnId": "lastSeen",
          "direction": "desc"
      },
      "activeFilters": {},
      "maxBadgeLength": 0,
      "pageSize": 65,
      "filtersActive": {}
  }
}