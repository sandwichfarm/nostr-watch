import { describe, it, expect, vi } from 'vitest';
import { Nocap as Base, ConfigInterface, ResultInterface, SessionHelper, TimeoutHelper, LatencyHelper, DeferredWrapper } from '../../index.js'; // Update the import path accordingly
import { RelayAdapterDefault, InfoAdapterDefault, GeoAdapterDefault, DnsAdapterDefault, SslAdapterDefault } from '@nostrwatch/nocap-all-adapters-default'

describe("Base", () => {
  const url = `wss://relay.damus.io/`
  

  describe("constructor()",async () => {
    const base = new Base(url);
    await vi.dynamicImportSettled()

    it("is defined", () => expect(Base).toBeDefined());
    it("is a class", () => expect(typeof Base).toBe("function"));
    it("is instantiable", () => expect(base).toBeInstanceOf(Base));

    it('should instantiate with url', () => {
      expect(base.url).toEqual(url);
    });

    it("defines constructor()", () => {
      expect(typeof base.constructor).toBe("function");
    });

    it("config is an instance of ResultInterface", () => {
      expect(base.config).toBeInstanceOf(ConfigInterface);
    });

    it("results is an instance of ResultInterface", () => {
      expect(base.results).toBeInstanceOf(ResultInterface);
    });

    it("session is an instance of SessionHelper", () => {
      expect(base.session).toBeInstanceOf(SessionHelper);
    });

    it("timeouts is an instance of TimeoutHelper", () => {
      expect(base.timeouts).toBeInstanceOf(TimeoutHelper);
    });

    it("latency is an instance of LatencyHelper", () => {
      expect(base.latency).toBeInstanceOf(LatencyHelper);
    });

    it("promises is an instance of DeferredWrapper", () => {
      expect(base.promises).toBeInstanceOf(DeferredWrapper);
    });

    // it("logger is an instance of Logger", () => {
    //   expect(base.logger).toBeInstanceOf(Logger);
    // });
  });

  describe("getAdapterType()", async () => {
    const base = new Base(url);
    
    it("should throw when given invalid key", () => {
      expect(() => { base.getAdapterType('EveryAdapterDefault') }).toThrow()
    })

    it("should return the correct key", () => {
      const validtype = base.getAdapterType('GeoAdapterDefault');
      expect(validtype).toBe('geo')
    })
  })

  describe("defaultAdapterKeys()", async () => {
    const base = new Base(url);
    it("should return an array", () => {
      const result = base.defaultAdapterKeys();
      console.log(result);
      expect(Array.isArray(result)).toBe(true);
    })
  })

  describe("useAdapter()", async () => {
    const base = new Base(url);

    it("should be an object", () => {
      console.log(typeof RelayAdapterDefault);
      expect(() => typeof RelayAdapterDefault).toBe('object');
    })
    
  })

  describe("defaultAdapters()", async () => {
    const base = new Base(url);
    base.defaultAdapters();

    it("should be a function", () => {
      expect(typeof base.defaultAdapters).toBe("function");
    })

    it("should mixin default relay adapter", () => {
      expect(base.check_read).toBe("function");
    })

    it("should mixin default info adapter", () => {
      expect(base.check_info).toBe("function");
    })

    it("should mixin default geo adapter", () => {
      expect(base.check_geo).toBe("function");
    })

    it("should mixin default dns adapter", () => {
      expect(base.check_dns).toBe("function");
    })

    it("should mixin default ssl adapter", () => {
      expect(base.check_ssl).toBe("function");
    })

  })

  // describe("all()", async () => {
  //   const base = new Base(url);
  //   await vi.dynamicImportSettled()

  //   it("check_all() should exist", () => {
  //     expect(typeof base.check_all).toBe("function");
  //   });
  //   it('check_all() should run all checks', async () => {
  //     base.check_connect = vi.fn();
  //     base.check_read = vi.fn(); 
  //     base.check_write = vi.fn(); 
  //     base.check_geo = vi.fn(); 
  //     base.check_dns = vi.fn(); 
  //     base.check_ssl = vi.fn(); 
  //     await base.check_all();
  //     expect(base.check_connect).toHaveBeenCalled();
  //     expect(base.check_read).toHaveBeenCalled();
  //     expect(base.check_write).toHaveBeenCalled();
  //     expect(base.check_geo).toHaveBeenCalled();
  //     expect(base.check_dns).toHaveBeenCalled();
  //     expect(base.check_ssl).toHaveBeenCalled();
  //   });
  // });

  // describe("check()", async () => {
  //   const base = new Base(url);
  //   await vi.dynamicImportSettled() 

  //   it("defines check()", () => {
  //     expect(typeof base.check).toBe("function");
  //   });

  //   it("throws an error when called with an invalid key", () => {
  //     expect(() => base.check({})).toThrow();
  //     expect(() => base.check([])).toThrow();
  //     expect(() => base.check(1)).toThrow();
  //     expect(() => base.check('invalid')).toThrow();
  //     expect(() => base.check(null)).toThrow();
  //     expect(async () => base.check(undefined)).t();
  //     expect(() => base.check(true)).toThrow();
  //   });

  //   it("returns a promise when called with a valid key", () => {
  //     expect(base.check("connect")).toBeInstanceOf(Promise);
  //     expect(base.check("read")).toBeInstanceOf(Promise);
  //     expect(base.check("write")).toBeInstanceOf(Promise);
  //     expect(base.check("info")).toBeInstanceOf(Promise);
  //     expect(base.check("geo")).toBeInstanceOf(Promise);
  //     expect(base.check("dns")).toBeInstanceOf(Promise);
  //     expect(base.check("ssl")).toBeInstanceOf(Promise);
  //   });

  //   it('check() should run named check', async () => {
  //     const base = new Base('url');
  //     await vi.dynamicImportSettled()

  //     base.check_connect = vi.fn();
  //     await base.check('connect');
  //     expect(base.check_connect).toHaveBeenCalled();
  //   });

  //   it("returns correct results when called with a valid key", async () => {
  //     const base = new Base(url);
  //     await vi.dynamicImportSettled()

  //     const connect = await base.check("connect");
  //     expect(connect).toBeInstanceOf(ResultInterface);
  //     expect(connect).toHaveProperty("connectLatency");
  //     expect(connect).toHaveProperty("connect");

  //     const read = await base.check("read");
  //     expect(read).toBeInstanceOf(ResultInterface);
  //     expect(read).toHaveProperty("readLatency");
  //     expect(read).toHaveProperty("read");

  //     const write = await base.check("write");
  //     expect(write).toBeInstanceOf(ResultInterface);
  //     expect(write).toHaveProperty("writeLatency");
  //     expect(write).toHaveProperty("write");

  //     const info = await base.check("info");
  //     expect(info).toBeInstanceOf(ResultInterface);
  //     expect(info).toHaveProperty("infoLatency");
  //     expect(info).toHaveProperty("info");

  //     const geo = await base.check("geo");
  //     expect(geo).toBeInstanceOf(ResultInterface);
  //     expect(geo).toHaveProperty("geoLatency");
  //     expect(geo).toHaveProperty("geo");

  //     const dns = await base.check("dns");
  //     expect(dns).toBeInstanceOf(ResultInterface);
  //     expect(dns).toHaveProperty("dnsLatency");
  //     expect(dns).toHaveProperty("dns");

  //     const ssl = await base.check("ssl");
  //     expect(ssl).toBeInstanceOf(ResultInterface);
  //     expect(ssl).toHaveProperty("sslLatency");
  //     expect(ssl).toHaveProperty("ssl");
  //   });
  // });

//   describe("start()", () => {
//     const base = new Base(url);
    

//     it("defines start()", () => {
//       expect(typeof base.start).toBe("function");
//     });

//     it('start() should connect before other checks', async () => {
      
//       const base = new Base(url);
//       vi.spyOn(base, 'isConnected').mockImplementation(() => true)
//       vi.spyOn(base, 'check_connect').mockImplementation(() => true)
//       base.isConnected = vi.fn().mockReturnValueOnce(true); 
//       base.check_connect = vi.fn().mockReturnValueOnce(true);
//       await base.start('read');
//       expect(base.isConnected).toHaveBeenCalled();
//       expect(base.check_connect).toHaveBeenCalled();    

//     });
//   });

//   describe("finish()", () => {
//     const base = new Base(url);

//     it("defines finish()", () => {
//       expect(typeof base.setRule).toBe("function");
//     });
//   });

//   describe("subid()", () => {
//     const base = new Base(url);

//     it("defines subid()", () => {
//       expect(typeof base.setRule).toBe("function");
//     });
//   });

//   describe("keyFromSubid()", () => {
//     it("defines keyFromSubid()", () => {
//       expect(typeof base.setRule).toBe("function");
//     });
//   });

//   describe("throw()", () => {
//     it("defines throw()", () => {
//       expect(typeof base.setRule).toBe("function");
//     });
//   });
// });
});