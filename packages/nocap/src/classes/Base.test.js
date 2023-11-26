import { Nocap, ConfigInterface, ResultInterface, SessionHelper, TimeoutHelper, LatencyHelper, DeferredWrapper } from '../index.js'; // Update the import path accordingly
import { describe, it, expect, test, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { RelayAdapterDefault, InfoAdapterDefault, GeoAdapterDefault, DnsAdapterDefault, SslAdapterDefault } from '@nostrwatch/nocap-all-adapters-default'

import { createMockRelay, faker, MockRelay } from "vitest-nostr";

const url = `wss://relay.damus.io/`
let nocap 
let relay

beforeAll(async () => {
  // relay = createMockRelay(url);
  // await relay.connected;
});

afterAll(() => {
  // relay.close();
});

beforeEach(async () => {
  nocap = new Nocap(url);
})

afterEach(async () => {
  nocap.close()
})

describe("Nocap", () => {
  
  describe("constructor()",async () => {

    it("is defined", () => expect(Nocap).toBeDefined());
    it("is a class", () => expect(typeof Nocap).toBe("function"));
    it("is instantiable", () => expect(nocap).toBeInstanceOf(Nocap));

    it('should instantiate with url', () => {
      expect(nocap.url).toEqual(url);
    });

    it("defines constructor()", () => {
      expect(typeof nocap.constructor).toBe("function");
    });

    it("config is an instance of ResultInterface", () => {
      expect(nocap.config).toBeInstanceOf(ConfigInterface);
    });

    it("results is an instance of ResultInterface", () => {
      expect(nocap.results).toBeInstanceOf(ResultInterface);
    });

    it("session is an instance of SessionHelper", () => {
      expect(nocap.session).toBeInstanceOf(SessionHelper);
    });

    it("timeouts is an instance of TimeoutHelper", () => {
      expect(nocap.timeouts).toBeInstanceOf(TimeoutHelper);
    });

    it("latency is an instance of LatencyHelper", () => {
      expect(nocap.latency).toBeInstanceOf(LatencyHelper);
    });

    it("promises is an instance of DeferredWrapper", () => {
      expect(nocap.promises).toBeInstanceOf(DeferredWrapper);
    });
  });

  describe("getAdapterType()", async () => {
    
    it("should throw when given invalid key", () => {
      console.log(nocap.getAdapterType('invalid'))
      let type = nocap.getAdapterType('invalid')
      console.log(type)
      expect(() => { nocap.getAdapterType('invalid') }).toThrow()
    })

    it("should return the correct key", () => {
      let validtype 
      
      validtype = nocap.getAdapterType('GeoAdapterDefault');
      expect(validtype).toBe('geo')
      
      validtype = nocap.getAdapterType('DnsAdapterDefault');
      expect(validtype).toBe('dns')
      
      validtype = nocap.getAdapterType('InfoAdapterDefault');
      expect(validtype).toBe('info')
      
      validtype = nocap.getAdapterType('SslAdapterDefault');
      expect(validtype).toBe('ssl')
      
      validtype = nocap.getAdapterType('RelayAdapterDefault');
      expect(validtype).toBe('relay')
    })
  })

  describe("defaultAdapterKeys()", async () => {
    it("should return an array", () => {
      const result = nocap.defaultAdapterKeys();
      console.log(result);
      expect(Array.isArray(result)).toBe(true);
    })
  })

  describe("useAdapter()", async () => {

    it("should be an object", () => {
      console.log(typeof RelayAdapterDefault);
      expect(() => typeof RelayAdapterDefault).toBe('object');
    })
    
  })

  describe("defaultAdapters()", async () => {
    // nocap.defaultAdapters();

    it("should be a function", () => {
      expect(typeof nocap.defaultAdapters).toBe("function");
    })

    it("should instantiate default relay adapter", () => {
      expect(nocap.adapters.relay.check_connect).toBeTypeOf("function");
      expect(nocap.adapters.relay.check_read).toBeTypeOf("function");
      expect(nocap.adapters.relay.check_write).toBeTypeOf("function");      
    })

    it("should instantiate default info adapter", () => {
      expect(nocap.adapters.info.check_info).toBeTypeOf("function");
    })

    it("should instantiate default geo adapter", () => {
      expect(nocap.adapters.geo.check_geo).toBeTypeOf("function");
    })

    it("should instantiate default dns adapter", () => {
      expect(nocap.adapters.dns.check_dns).toBeTypeOf("function");
    })

    it("should instantiate default ssl adapter", () => {
      expect(nocap.adapters.ssl.check_ssl).toBeTypeOf("function");
    })

  })

  describe("check()", async () => {
    
    it("should return an object with specific structure", async () => {
      const response = await nocap.check('connect')
    
      // Check if it's an object
      expect(typeof response).toBe('object');
    
      // Check if specific properties exist and their types
      expect(response).toHaveProperty('connect');
      expect(typeof response.connect).toBe('boolean');
    
      expect(response).toHaveProperty('connectLatency');
      expect(typeof response.connectLatency).toBe('number');
    });

  })


  // describe("all()", async () => {
  //   const nocap = new Nocap(url);
  //   await vi.dynamicImportSettled()

  //   it("check_all() should exist", () => {
  //     expect(typeof nocap.check_all).toBe("function");
  //   });
  //   it('check_all() should run all checks', async () => {
  //     nocap.check_connect = vi.fn();
  //     nocap.check_read = vi.fn(); 
  //     nocap.check_write = vi.fn(); 
  //     nocap.check_geo = vi.fn(); 
  //     nocap.check_dns = vi.fn(); 
  //     nocap.check_ssl = vi.fn(); 
  //     await nocap.check_all();
  //     expect(nocap.check_connect).toHaveBeenCalled();
  //     expect(nocap.check_read).toHaveBeenCalled();
  //     expect(nocap.check_write).toHaveBeenCalled();
  //     expect(nocap.check_geo).toHaveBeenCalled();
  //     expect(nocap.check_dns).toHaveBeenCalled();
  //     expect(nocap.check_ssl).toHaveBeenCalled();
  //   });
  // });

  // describe("check()", async () => {
  //   const nocap = new Nocap(url);
  //   await vi.dynamicImportSettled() 

  //   it("defines check()", () => {
  //     expect(typeof nocap.check).toBe("function");
  //   });

  //   it("throws an error when called with an invalid key", () => {
  //     expect(() => nocap.check({})).toThrow();
  //     expect(() => nocap.check([])).toThrow();
  //     expect(() => nocap.check(1)).toThrow();
  //     expect(() => nocap.check('invalid')).toThrow();
  //     expect(() => nocap.check(null)).toThrow();
  //     expect(async () => nocap.check(undefined)).t();
  //     expect(() => nocap.check(true)).toThrow();
  //   });

  //   it("returns a promise when called with a valid key", () => {
  //     expect(nocap.check("connect")).toBeInstanceOf(Promise);
  //     expect(nocap.check("read")).toBeInstanceOf(Promise);
  //     expect(nocap.check("write")).toBeInstanceOf(Promise);
  //     expect(nocap.check("info")).toBeInstanceOf(Promise);
  //     expect(nocap.check("geo")).toBeInstanceOf(Promise);
  //     expect(nocap.check("dns")).toBeInstanceOf(Promise);
  //     expect(nocap.check("ssl")).toBeInstanceOf(Promise);
  //   });

  //   it('check() should run named check', async () => {
  //     const nocap = new Nocap('url');
  //     await vi.dynamicImportSettled()

  //     nocap.check_connect = vi.fn();
  //     await nocap.check('connect');
  //     expect(nocap.check_connect).toHaveBeenCalled();
  //   });

  //   it("returns correct results when called with a valid key", async () => {
  //     const nocap = new Nocap(url);
  //     await vi.dynamicImportSettled()

  //     const connect = await nocap.check("connect");
  //     expect(connect).toBeInstanceOf(ResultInterface);
  //     expect(connect).toHaveProperty("connectLatency");
  //     expect(connect).toHaveProperty("connect");

  //     const read = await nocap.check("read");
  //     expect(read).toBeInstanceOf(ResultInterface);
  //     expect(read).toHaveProperty("readLatency");
  //     expect(read).toHaveProperty("read");

  //     const write = await nocap.check("write");
  //     expect(write).toBeInstanceOf(ResultInterface);
  //     expect(write).toHaveProperty("writeLatency");
  //     expect(write).toHaveProperty("write");

  //     const info = await nocap.check("info");
  //     expect(info).toBeInstanceOf(ResultInterface);
  //     expect(info).toHaveProperty("infoLatency");
  //     expect(info).toHaveProperty("info");

  //     const geo = await nocap.check("geo");
  //     expect(geo).toBeInstanceOf(ResultInterface);
  //     expect(geo).toHaveProperty("geoLatency");
  //     expect(geo).toHaveProperty("geo");

  //     const dns = await nocap.check("dns");
  //     expect(dns).toBeInstanceOf(ResultInterface);
  //     expect(dns).toHaveProperty("dnsLatency");
  //     expect(dns).toHaveProperty("dns");

  //     const ssl = await nocap.check("ssl");
  //     expect(ssl).toBeInstanceOf(ResultInterface);
  //     expect(ssl).toHaveProperty("sslLatency");
  //     expect(ssl).toHaveProperty("ssl");
  //   });
  // });

//   describe("start()", () => {
//     const nocap = new Nocap(url);
    

//     it("defines start()", () => {
//       expect(typeof nocap.start).toBe("function");
//     });

//     it('start() should connect before other checks', async () => {
      
//       const nocap = new Nocap(url);
//       vi.spyOn(nocap, 'isConnected').mockImplementation(() => true)
//       vi.spyOn(nocap, 'check_connect').mockImplementation(() => true)
//       nocap.isConnected = vi.fn().mockReturnValueOnce(true); 
//       nocap.check_connect = vi.fn().mockReturnValueOnce(true);
//       await nocap.start('read');
//       expect(nocap.isConnected).toHaveBeenCalled();
//       expect(nocap.check_connect).toHaveBeenCalled();    

//     });
//   });

//   describe("finish()", () => {
//     const nocap = new Nocap(url);

//     it("defines finish()", () => {
//       expect(typeof nocap.setRule).toBe("function");
//     });
//   });

//   describe("subid()", () => {
//     const nocap = new Nocap(url);

//     it("defines subid()", () => {
//       expect(typeof nocap.setRule).toBe("function");
//     });
//   });

//   describe("keyFromSubid()", () => {
//     it("defines keyFromSubid()", () => {
//       expect(typeof nocap.setRule).toBe("function");
//     });
//   });

//   describe("throw()", () => {
//     it("defines throw()", () => {
//       expect(typeof nocap.setRule).toBe("function");
//     });
//   });
// });
});