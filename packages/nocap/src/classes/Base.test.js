import { Nocap, ConfigInterface, ResultInterface, SessionHelper, TimeoutHelper, LatencyHelper, DeferredWrapper } from '../index.js'; // Update the import path accordingly
import { describe, it, expect, test, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { RelayAdapterDefault, InfoAdapterDefault, GeoAdapterDefault, DnsAdapterDefault, SslAdapterDefault } from '@nostrwatch/nocap-all-adapters-default'
import { fetch } from 'cross-fetch';

import { createMockRelay, faker, MockRelay } from "vitest-nostr";

let url = `wss://history.nostr.watch`
let nocap

beforeAll(async () => {});

afterAll(() => {});

beforeEach(async () => {
  
})

afterEach(async () => {
  if(nocap?.close)
    nocap.close()
  nocap = null
})

describe("Nocap class", () => {

  let nocap = new Nocap(url);

  describe("constructor()", async () => {

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
  })

  describe("getAdapterType()", async () => {
    
    it("should throw when given invalid key", () => {
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
      expect(Array.isArray(nocap.defaultAdapterKeys())).toBe(true);
    })
  })

  console.log(typeof nocap)

  // describe("useAdapter()", async () => {
  //   it("should be an object", () => {
  //     // expect(typeof RelayAdapterDefault).toBe('object');
  //   })
  // })

  describe("defaultAdapters()", async () => {
    
    it("should return an object", () => {
      const defaultAdapters = nocap.defaultAdapters()
      expect(defaultAdapters).toBeInstanceOf(Object);
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
  describe("checkAll()", async () => {

    it("checkAll() should exist", () => {
      expect(typeof nocap.checkAll).toBe("function");
    });

    it('checkAll() should run all checks', async () => {
      const result = await nocap.checkAll();
      expect(result).toBeInstanceOf(Object);
      expect(result).toHaveProperty('connect');
      expect(result).toHaveProperty('read');
      expect(result).toHaveProperty('write');
      expect(result.connect).toBe(true);
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.connectLatency).toBeGreaterThan(0);
      expect(result.readLatency).toBeGreaterThan(0);
      expect(result.writeLatency).toBeGreaterThan(0);
      expect(result.geo).toBeInstanceOf(Object);
      expect(result.dns).toBeInstanceOf(Object);
      expect(result.info).toBeInstanceOf(Object);
      expect(result.ssl).toBeInstanceOf(Object);
      expect(typeof result.url).toBeTypeOf('string');
    });
  });

  describe("check()", async () => {
    nocap.close()
    nocap = new Nocap(url);
    await vi.dynamicImportSettled() 

    it("defines check()", () => {
      expect(typeof nocap.check).toBe("function");
    });

    it("throws an error when called with an invalid key", async () => {
      await expect(nocap.check({})).rejects.toThrow();
      await expect(nocap.check([])).rejects.toThrow();
      await expect(nocap.check(1)).rejects.toThrow();
      await expect(nocap.check('invalid')).rejects.toThrow();
      await expect(nocap.check(null)).rejects.toThrow();
      await expect(nocap.check(undefined)).rejects.toThrow();
      await expect(nocap.check(true)).rejects.toThrow();
  });


    it("returns a promise when called with a valid key", async() => {
      expect(nocap.check("connect")).toBeInstanceOf(Promise);
      expect(nocap.check("read")).toBeInstanceOf(Promise);
      expect(nocap.check("write")).toBeInstanceOf(Promise);
      expect(nocap.check("info")).toBeInstanceOf(Promise);
      expect(nocap.check("geo")).toBeInstanceOf(Promise);
      expect(nocap.check("dns")).toBeInstanceOf(Promise);
      expect(nocap.check("ssl")).toBeInstanceOf(Promise);
    });


    describe("check('connect')", async () => {
      
      it("should returnn connect result", async () => {
        const response = await nocap.check('connect')
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('connect');
        expect(typeof response.connect).toBe('boolean');
        expect(response).toHaveProperty('connectLatency');
        expect(typeof response.connectLatency).toBe('number');
      })
    })

    describe("check('read')", async () => {
      it("should return read result", async () => {
        const response = await nocap.check('read')
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('read');
        expect(typeof response.read).toBe('boolean');
        expect(response).toHaveProperty('readLatency');
        expect(typeof response.readLatency).toBe('number');
      })
    })

    describe("check('write')", async () => {
      it("should return write result", async () => {
        const response = await nocap.check('write')
        console.log('write check', response)
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('write');
        expect(typeof response.write).toBe('boolean');
        expect(response).toHaveProperty('writeLatency');
        expect(typeof response.writeLatency).toBe('number');
      })
    })

    describe("check('geo')", async () => {
      it("should return geo result", async () => {
        const response = await nocap.check('geo')
        console.log('write check', response)
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('geo');
        expect(typeof response.geo).toBe('object');
        expect(response).toHaveProperty('geoLatency');
        expect(typeof response.geoLatency).toBe('number');
      })
    })

    describe("check('dns')", async () => {
      it("should return dns result", async () => {
        const response = await nocap.check('dns')
        console.log('write check', response)
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('dns');
        expect(typeof response.dns).toBe('object');
        expect(response).toHaveProperty('dnsLatency');
        expect(typeof response.dnsLatency).toBe('number');
      })
    })

    describe("check('info')", async () => {
      it("should return info result", async () => {
        const response = await nocap.check('info')
        console.log('info check', response)
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('info');
        expect(typeof response.info).toBe('object');
        expect(response).toHaveProperty('infoLatency');
        expect(typeof response.infoLatency).toBe('number');
      })
    })
  });

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
// });
});