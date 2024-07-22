import { Nocap, ConfigInterface, ResultInterface, SessionHelper, TimeoutHelper, LatencyHelper, DeferredWrapper } from '../index.js'; // Update the import path accordingly
import { describe, it, expect, test, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { WebsocketAdapterDefault, InfoAdapterDefault, GeoAdapterDefault, DnsAdapterDefault, SslAdapterDefault } from '@nostrwatch/nocap-every-adapter-default'
import { fetch } from 'cross-fetch';

import { createMockRelay, faker, MockRelay } from "vitest-nostr";

let url = `wss://nostr.topeth.info/`
let nocap

beforeAll(async () => {});

afterAll(() => {
  if(nocap?.close)
    nocap.close()
  nocap = null
});

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
      
      validtype = nocap.getAdapterType('WebsocketAdapterDefault');
      expect(validtype).toBe('websocket')
    })
  })

  describe("defaultAdapterKeys()", async () => {
    it("should return an array", () => {
      expect(Array.isArray(nocap.defaultAdapterKeys())).toBe(true);
    })
  })

  // describe("useAdapter()", async () => {
  //   it("should be an object", () => {
  //     // expect(typeof WebsocketAdapterDefault).toBe('object');
  //   })
  // })

  describe("defaultAdapters()", async () => {
    
    it("should return an object", () => {
      const defaultAdapters = nocap.defaultAdapters()
      expect(defaultAdapters).toBeInstanceOf(Object);
    })

    it("should instantiate default websocket adapter", () => {
      expect(nocap.adapters.websocket.check_open).toBeTypeOf("function");
      expect(nocap.adapters.websocket.check_read).toBeTypeOf("function");
      expect(nocap.adapters.websocket.check_write).toBeTypeOf("function");      
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
      console.log('checkAll()', result)
      expect(result).toBeInstanceOf(Object);
      expect(typeof result.url).toBeTypeOf('string');
      expect(result).toHaveProperty('open');
      expect(result).toHaveProperty('read');
      expect(result).toHaveProperty('write');
      
      expect(result.open).toBeInstanceOf(Object);
      expect(result.open.data).toBeTypeOf('boolean');
      expect(result.open.duration).toBeTypeOf('number');
      
      expect(result.read).toBeInstanceOf(Object);
      expect(result.read.data).toBeTypeOf('boolean');
      expect(result.read.duration).toBeTypeOf('number');
      
      expect(result.write).toBeInstanceOf(Object);
      expect(result.write.data).toBeTypeOf('boolean');
      expect(result.write.duration).toBeTypeOf('number'); 

      expect(result.geo).toBeInstanceOf(Object);
      expect(result.dns).toBeInstanceOf(Object);
      expect(result.info).toBeInstanceOf(Object);
      expect(result.ssl).toBeInstanceOf(Object);
      
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
      expect(nocap.check("open")).toBeInstanceOf(Promise);
      expect(nocap.check("read")).toBeInstanceOf(Promise);
      expect(nocap.check("write")).toBeInstanceOf(Promise);
      expect(nocap.check("info")).toBeInstanceOf(Promise);
      expect(nocap.check("geo")).toBeInstanceOf(Promise);
      expect(nocap.check("dns")).toBeInstanceOf(Promise);
      expect(nocap.check("ssl")).toBeInstanceOf(Promise);
    });

    describe("check", async () => {

      describe("check('open')", async () => {
        const method = 'open'
        it("defaults should return open result", async () => {
          const response = await nocap.check(method)
          console.log('check(open)', response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('boolean');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("raw === false should return open result", async () => {
          const response = await nocap.check(method, false)
          console.log('check(open, false)', response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('boolean');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })

      describe("check('read')", async () => {
        const method = 'read'
        it("defaults should return open result", async () => {
          const response = await nocap.check(['open', method])
          console.log('check(read)', response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('boolean');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("clean results should return open result", async () => {
          const response = await nocap.check(['open', method], false)
          console.log('check(read, false)', response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('boolean');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })

      describe("check('write')", async () => {
        const method = 'write'
        it("raw === false should return open result", async () => {
          const response = await nocap.check(['open', method])
          console.log('check(write, false)', response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('boolean');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("clean results should return open result", async () => {
          const response = await nocap.check(['open', method], false)
          console.log('check(write, false)', response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('boolean');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })

      describe(`check('info')`, async () => {
        const method = 'info'
        it("defaults should return open result", async () => {
          const response = await nocap.check(method)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('object');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("clean results should return open result", async () => {
          const response = await nocap.check(method, false)
          console.log(response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })

      
      describe(`check('dns')`, async () => {
        const method = 'dns'
        it("defaults should return open result", async () => {
          const response = await nocap.check(method)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('object');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("clean results should return open result", async () => {
          const response = await nocap.check(method, false)
          console.log("check('dns')", response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })

      describe(`check('geo')`, async () => {
        const method = 'geo'
        it("defaults should return open result", async () => {
          const response = await nocap.check(method)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('object');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("clean results should return open result", async () => {
          const response = await nocap.check(method, false)
          console.log(response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })

      describe(`check('ssl')`, async () => {
        const method = 'ssl'
        it("defaults should return open result", async () => {
          const response = await nocap.check(method)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response[method]).toHaveProperty('data');
          expect(response[method]).toHaveProperty('duration');
          expect(response[method].data).toBeTypeOf('object');
          expect(response[method].duration).toBeTypeOf('number');
        })
  
        it("clean results should return open result", async () => {
          const response = await nocap.check(method, false)
          console.log(response)
          expect(response).toBeTypeOf('object');
          expect(response).toHaveProperty(method);
          expect(response[method]).toBeTypeOf('object');
          expect(response).toHaveProperty(`${method}_duration`);
          expect(response[`${method}_duration`]).toBeTypeOf('number');
        })
      })
    })
  });
});