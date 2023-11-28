export const RelayCheckWebsocket = {
  url: "",
  connect: -1,
  read: -1,
  write: -1,
  connectLatency: -1,
  readLatency: -1,
  writeLatency: -1,
  checked_at: -1, 
  checked_by: ""
}

export const RelayCheckInfo = {
  checked_at: -1,
  error: false,
  reason: "",
  dropped_fields: [],
  data: {
    "description": "",
    "name": "",
    "pubkey": "",
    "software": "",
    "supported_nips": [],
    "retention": [
      {"kinds": [0, 1, [5, 7], [40, 49]], "time": 3600}
    ],
    "language_tags": [""],
    "tags": [""],
    "posting_policy": "",
    "relay_countries": [ "" ],
    "version": "",
    "limitation": {
      "payment_required": true,
      "max_message_length": -1,
      "max_event_tags": -1,
      "max_subscriptions": -1,
      "auth_required": false
    },
    "payments_url": "",
    "fees": {
      "subscription": [
        {
          "amount": -1,
          "unit": "",
          "period": -1
        }
      ]
    },
  }
}

export const RelayCheckResultDns = {
  Status: -,
  TC: false,
  RD: true,
  RA: true,
  AD: false,
  CD: false,
  Question: [ { name: '', type: -1 } ],
  Answer: [
    {}
  ]
}

export const RelayCheckResultGeo = {
  url: '',
  relay_id: '',
  checked_at: -1,
  data: {
    status: '',
    country: '',
    countryCode: '',
    region: '',
    regionName: '',
    city: '',
    zip: '',
    lat: -1.1,
    lon: -1.1,
    timezone: '',
    isp: '',
    org: '',
    as: '',
    query: ''
  }
}

export const RelayCheckResultSsl = ssl: {
  url: 'wss://history.nostr.watch',
  adapter: 'SslAdapterDefault',
  checked_at: '2023-11-28T21:32:45.416Z',
  data: {
        days_remaining: 57,
        valid: true,
        subject: { CN: 'history.nostr.watch' },
        issuer: {
          C: 'US',
          O: "Let's Encrypt",
          CN: 'R3'
        },
        subjectaltname: 'DNS:history.nostr.watch',
        infoAccess: {
          'OCSP - URI': [ 'http://r3.o.lencr.org' ],
          'CA Issuers - URI': [ 'http://r3.i.lencr.org/' ]
        },
        ca: false,
        modulus: 'CBEC1269F7D6E9BFA8F660E00896726D62E145BC2C4273C76171695D59C7E5E491A88CD72ADEDFEC2D2612F40BE9368F4D8F447EFA3D6E4F3A7682ABFFB81992030037E9BF0108A3A60F4F7EE0423A389DD0CB4490C1C92A028B622805771FAC4F5592A079BA066EE73390079C3287C79EC6B6442FA23E675664EB817ED6E4909226F3FEA88B24B40F6B658D4ABBAE1B97A0AA97D9A85ACC7C78AD540252C80B0F9A67FBB71F9B57520DA3DF7BDDD47ED11EEB70E7730945E6AB28DD94485413939E24655C8FF4BC4254F7EF02C25ADEA5C9AE86AE2EC05E7EC79839543BA2EB73D6151D059A2B733FF7D27C64E78C9C4B27829E21227A8C144BD35B8AE4C837',
        bits: 2048,
        exponent: '0x10001',
        pubkey: {},
        valid_from: 'Oct 26 10:20:36 2023 GMT',
        valid_to: 'Jan 24 10:20:35 2024 GMT',
        fingerprint: 'CE:ED:A8:7D:54:23:82:91:2A:C0:3F:7D:6F:80:5A:20:05:A2:71:C0',
        fingerprint256: '4E:15:BE:90:7F:95:A2:F0:5F:05:66:DB:EB:82:8E:23:41:37:7B:5A:69:AD:FF:99:11:D5:8A:45:23:AB:50:9C',
        fingerprint512: '94:94:83:88:B4:74:02:A9:44:52:46:DD:18:B4:4B:73:9A:AB:35:E1:25:82:53:F3:11:AD:42:B5:FA:BB:6A:37:5B:52:00:FA:05:31:87:74:BE:A4:D0:30:CD:16:B4:F9:16:B7:95:FD:3E:25:67:0C:34:19:08:95:0B:24:B8:F2',
        ext_key_usage: [ '1.3.6.1.5.5.7.3.1', '1.3.6.1.5.5.7.3.2' ],
        serialNumber: '04A4D68C5574C1C63FF243A5FC5DB26597F4',
        raw: <Buffer 30 82 04 f5 30 82 03 dd a0 03 02 01 02 02 12 04 a4 d6 8c 55 74 c1 c6 3f f2 43 a5 fc 5d b2 65 97 f4 30 0d 06 09 2a 86 48 86 f7 0d 01 01 0b 05 00 30 32 ... 1223 more bytes>,
        pemEncoded: '-----BEGIN CERTIFICATE-----\n' +
          'MIIE9TCCA92gAwIBAgISBKTWjFV0wcY/8kOl/F2yZZf0MA0GCSqGSIb3DQEBCwUA\n' +
          'MDIxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQswCQYDVQQD\n' +
          'EwJSMzAeFw0yMzEwMjYxMDIwMzZaFw0yNDAxMjQxMDIwMzVaMB4xHDAaBgNVBAMT\n' +
          'E2hpc3Rvcnkubm9zdHIud2F0Y2gwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK\n' +
          'AoIBAQDL7BJp99bpv6j2YOAIlnJtYuFFvCxCc8dhcWldWcfl5JGojNcq3t/sLSYS\n' +
          '9AvpNo9Nj0R++j1uTzp2gqv/uBmSAwA36b8BCKOmD09+4EI6OJ3Qy0SQwckqAoti\n' +
          'KAV3H6xPVZKgeboGbuczkAecMofHnsa2RC+iPmdWZOuBftbkkJIm8/6oiyS0D2tl\n' +
          'jUq7rhuXoKqX2ahazHx4rVQCUsgLD5pn+7cfm1dSDaPfe93UftEe63DncwlF5qso\n' +
          '3ZRIVBOTniRlXI/0vEJU9+8Cwlrepcmuhq4uwF5+x5g5VDui63PWFR0FmitzP/fS\n' +
          'fGTnjJxLJ4KeISJ6jBRL01uK5Mg3AgMBAAGjggIXMIICEzAOBgNVHQ8BAf8EBAMC\n' +
          'BaAwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMAwGA1UdEwEB/wQCMAAw\n' +
          'HQYDVR0OBBYEFLzgoSl6DdFQWjFMtd3pWH215KYhMB8GA1UdIwQYMBaAFBQusxe3\n' +
          'WFbLrlAJQOYfr52LFMLGMFUGCCsGAQUFBwEBBEkwRzAhBggrBgEFBQcwAYYVaHR0\n' +
          'cDovL3IzLm8ubGVuY3Iub3JnMCIGCCsGAQUFBzAChhZodHRwOi8vcjMuaS5sZW5j\n' +
          'ci5vcmcvMB4GA1UdEQQXMBWCE2hpc3Rvcnkubm9zdHIud2F0Y2gwEwYDVR0gBAww\n' +
          'CjAIBgZngQwBAgEwggEGBgorBgEEAdZ5AgQCBIH3BIH0APIAdwDatr9rP7W2Ip+b\n' +
          'wrtca+hwkXFsu1GEhTS9pD0wSNf7qwAAAYtrtv5LAAAEAwBIMEYCIQChMmtAw8TV\n' +
          'EWsBXvEV3Bexo2rBSAKwPCAKR/yINurv2QIhAJRsjLzlh5FpdF368SVgskLyAuec\n' +
          'SIi2Qdd2i0uHuJ5jAHcAdv+IPwq2+5VRwmHM9Ye6NLSkzbsp3GhCCp/mZ0xaOnQA\n' +
          'AAGLa7b+TwAABAMASDBGAiEAvJGBbMq8r156N7TE3YljcmLcEicH9p2B0ZYQNmKL\n' +
          'Lt4CIQD08u1F0+EWb6EWf/Y/fHNepZb7nMy0GKFCTOEvnNHwKzANBgkqhkiG9w0B\n' +
          'AQsFAAOCAQEALane7vgkqoeW0HUqm7mNlfiN08VkVLAC/7oAtaFPYwCRRdmPLp4j\n' +
          'anced/2vt0R2QH2ThqD6H+lxaykRkrFAA2N2l4bJvDlVxr5aYPUNH66KCQH22ARd\n' +
          '/ILAnO/mXGrQgYsqyDRHiw/M6XrgCckLtRzvbB36x/F1BnNMwvlv4naiHBVlsCtp\n' +
          'Dp/Z+Dwwl8wyoS4PgVO9a7cDVRUNMI6/yKyln6LyfAkVwDiaBILQXaZWQbnn6GHy\n' +
          'VbJtlBtllVVyTvDn7BIpcLBraL/fOcpoZuiqTaJq1MShpI7KeY4cByLrVKdevchF\n' +
          'kDkmRQlvbR+IqgP3vMzZ7Jz43iw3ahJcKQ==\n' +
          '-----END CERTIFICATE-----'
        }
      },
      sslLatency: 192,
      checked_at: 1701207165416
    }
},