var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../../dist/browser/_virtual/_tslib.esm.js
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
var extendStatics, __assign;
var init_tslib_esm = __esm({
  "../../../dist/browser/_virtual/_tslib.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    __assign = function() {
      __assign = Object.assign || function __assign2(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
  }
});

// ../../../dist/browser/core/Workers.esm.js
var Workers_esm_exports = {};
__export(Workers_esm_exports, {
  Workers: () => Workers
});
var Workers;
var init_Workers_esm = __esm({
  "../../../dist/browser/core/Workers.esm.js"() {
    "use strict";
    init_tslib_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    Workers = /** @class */
    function() {
      function Workers2(adapters) {
        this._channel = new MessageChannel();
        this._ready = false;
        this.setupWorkers(adapters);
      }
      Object.defineProperty(Workers2.prototype, "ready", {
        get: function() {
          return this._ready;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "websocketWorkers", {
        get: function() {
          var _a2 = this, websocketShared = _a2.websocketShared, websocketDedicated = _a2.websocketDedicated, channel = _a2.channel;
          return { websocketShared, websocketDedicated, channel };
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "cacheWorkers", {
        get: function() {
          var _a2 = this, cacheShared = _a2.cacheShared, cacheDedicated = _a2.cacheDedicated, channel = _a2.channel;
          return { cacheShared, cacheDedicated, channel };
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "websocketShared", {
        get: function() {
          return this._websocketShared;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "cacheShared", {
        get: function() {
          return this._cacheShared;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "websocketDedicated", {
        get: function() {
          return this._websocket;
        },
        set: function(worker2) {
          this._websocket = worker2;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "cacheDedicated", {
        get: function() {
          return this._cache;
        },
        set: function(worker2) {
          this._cache = worker2;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Workers2.prototype, "channel", {
        get: function() {
          return this._channel;
        },
        enumerable: false,
        configurable: true
      });
      Workers2.prototype.setupWorkers = function(adapters) {
        return __awaiter(this, void 0, void 0, function() {
          var _a2, _b, message;
          var _c, _d, _e;
          return __generator(this, function(_f) {
            switch (_f.label) {
              case 0:
                if (!adapters.cacheAdapter.useWorker) return [3, 2];
                _a2 = this;
                return [4, adapters.cacheAdapter.newWorker(this.channel.port2)];
              case 1:
                _a2.cacheDedicated = _f.sent();
                _f.label = 2;
              case 2:
                if (!adapters.websocketAdapter.useWorker) return [3, 4];
                _b = this;
                return [4, adapters.websocketAdapter.newWorker(this.channel.port1)];
              case 3:
                _b.websocketDedicated = _f.sent();
                _f.label = 4;
              case 4:
                if (adapters.cacheAdapter.useWorker && adapters.websocketAdapter.useWorker) {
                  if ((_c = this.cacheDedicated) === null || _c === void 0 ? void 0 : _c.postMessage) {
                    message = { type: "setup", channelPort: this.channel.port2 };
                    console.log("[Workers] setupWorkers() -> cacheDedicated.postMessage()", message);
                    this.cacheDedicated.postMessage(message, [this.channel.port2]);
                  } else {
                    console.warn("Cache Worker not defined");
                  }
                  if ((_d = this.websocketDedicated) === null || _d === void 0 ? void 0 : _d.postMessage) {
                    (_e = this.websocketDedicated) === null || _e === void 0 ? void 0 : _e.postMessage({ type: "setup", channelPort: this.channel.port1 }, [this.channel.port1]);
                  } else {
                    console.warn("Websocket Worker not defined");
                  }
                }
                this._ready = true;
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      Workers2.encodeNostrEventArrayAsBuffer = function(json) {
        if (json instanceof ArrayBuffer)
          return json;
        var jsonString = JSON.stringify(json);
        var encoder = new TextEncoder();
        var uint8Array = encoder.encode(jsonString);
        return uint8Array.buffer;
      };
      Workers2.decodeNostrEventArrayFromBuffer = function(arrayBuffer) {
        if (!(arrayBuffer instanceof ArrayBuffer))
          return arrayBuffer;
        var decoder = new TextDecoder();
        var jsonString = decoder.decode(new Uint8Array(arrayBuffer));
        var nostrEvents = JSON.parse(jsonString);
        return nostrEvents;
      };
      return Workers2;
    }();
  }
});

// ../../../dist/browser/core/LocalStorageWrapper.esm.js
var LocalStorageWrapper;
var init_LocalStorageWrapper_esm = __esm({
  "../../../dist/browser/core/LocalStorageWrapper.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    LocalStorageWrapper = /** @class */
    function() {
      function LocalStorageWrapper2(prefix) {
        this._prefix = "";
        this.prefix = prefix;
      }
      Object.defineProperty(LocalStorageWrapper2.prototype, "prefix", {
        get: function() {
          return this._prefix;
        },
        set: function(prefix) {
          this._prefix = this.arrToString(prefix);
        },
        enumerable: false,
        configurable: true
      });
      LocalStorageWrapper2.prototype.formatKey = function(key) {
        return "".concat(this.prefix, ":").concat(this.arrToString(key));
      };
      LocalStorageWrapper2.prototype.arrToString = function(input) {
        return Array.isArray(input) ? input.join(":") : input;
      };
      LocalStorageWrapper2.prototype.getTypeKey = function() {
        return "".concat(this.prefix).concat(LocalStorageWrapper2.TYPE_KEY_SUFFIX);
      };
      LocalStorageWrapper2.prototype.saveKeyType = function(key, type) {
        var typeKey = this.getTypeKey();
        var types2 = JSON.parse(localStorage.getItem(typeKey) || "{}");
        types2[key] = type;
        localStorage.setItem(typeKey, JSON.stringify(types2));
      };
      LocalStorageWrapper2.prototype.getKeyType = function(key) {
        var typeKey = this.getTypeKey();
        var types2 = JSON.parse(localStorage.getItem(typeKey) || "{}");
        return types2[key] || null;
      };
      LocalStorageWrapper2.prototype.setItem = function(key, value) {
        if (!localStorage)
          throw new Error("No localStorage found");
        var formattedKey = this.formatKey(key);
        var type = !value ? "null" : typeof value;
        if (value === null || value === void 0) {
          value = null;
          type = "null";
        } else if (type === "object") {
          value = JSON.stringify(value);
        } else if (type === "boolean" || type === "number") {
          value = value.toString();
        }
        this.saveKeyType(formattedKey, type);
        localStorage.setItem(formattedKey, value);
      };
      LocalStorageWrapper2.prototype.getItem = function(key, _default) {
        if (!localStorage)
          throw new Error("No localStorage found");
        var formattedKey = this.formatKey(key);
        var item = localStorage.getItem(formattedKey);
        if (item === null || item === "")
          return _default;
        var type = this.getKeyType(formattedKey);
        switch (type) {
          case "number":
            return Number(item);
          case "boolean":
            return item === "true";
          case "object":
            try {
              return JSON.parse(item);
            } catch (_a2) {
              return _default;
            }
          case "null":
            return null;
          default:
            return item;
        }
      };
      LocalStorageWrapper2.prototype.removeItem = function(key) {
        if (!localStorage)
          throw new Error("No localStorage found");
        var formattedKey = this.formatKey(key);
        localStorage.removeItem(formattedKey);
        var typeKey = this.getTypeKey();
        var types2 = JSON.parse(localStorage.getItem(typeKey) || "{}");
        delete types2[formattedKey];
        localStorage.setItem(typeKey, JSON.stringify(types2));
      };
      LocalStorageWrapper2.prototype.clear = function() {
        if (!localStorage)
          throw new Error("No localStorage found");
        localStorage.clear();
      };
      LocalStorageWrapper2.prototype.length = function() {
        if (!localStorage)
          throw new Error("No localStorage found");
        return localStorage.length;
      };
      LocalStorageWrapper2.prototype.key = function(index) {
        if (!localStorage)
          throw new Error("No localStorage found");
        return localStorage.key(index);
      };
      LocalStorageWrapper2.TYPE_KEY_SUFFIX = ":_types";
      return LocalStorageWrapper2;
    }();
  }
});

// ../../../dist/browser/core/Adapter.esm.js
var Adapter;
var init_Adapter_esm = __esm({
  "../../../dist/browser/core/Adapter.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Workers_esm();
    init_LocalStorageWrapper_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    Adapter = /** @class */
    function() {
      function Adapter2() {
        this.slug = "Adapter:unset";
        this.useWorker = true;
        this._ls = new LocalStorageWrapper(["nip66", this.slug]);
      }
      Object.defineProperty(Adapter2.prototype, "localStorage", {
        get: function() {
          return this._ls;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Adapter2.prototype, "workers", {
        get: function() {
          return this._workers;
        },
        set: function(workers) {
          this._workers = workers;
          this._bindWorkerHandlers();
        },
        enumerable: false,
        configurable: true
      });
      Adapter2.prototype.ready = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      Adapter2.prototype._bindWorkerHandlers = function() {
        this.bindWorkerHandlers();
      };
      Adapter2.prototype._onMessage = function(event) {
        var message = event.data;
        this.listenPong(message);
        this.onMessage(message);
      };
      Adapter2.prototype._onError = function(error) {
        this.onError();
      };
      Adapter2.prototype.bindWorkerHandlers = function() {
        console.warn("bindWorkerHandlers is not implemented by class that extends Adapter");
      };
      Adapter2.prototype.listenPong = function(command) {
        if (command.type == "pong") {
          console.log("[Adapter:".concat(this.constructor.name, "] i/i RECV: PONG <- worker"));
        }
      };
      Adapter2.prototype.onMessage = function(message) {
      };
      Adapter2.prototype.onError = function() {
      };
      Adapter2.prototype.newWorker = function(channelPort) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      Adapter2.prototype.encode = function(json) {
        return Workers.encodeNostrEventArrayAsBuffer(json);
      };
      Adapter2.prototype.decode = function(arrayBuffer) {
        return Workers.decodeNostrEventArrayFromBuffer(arrayBuffer);
      };
      return Adapter2;
    }();
  }
});

// ../../../dist/browser/_virtual/_commonjsHelpers.esm.js
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var init_commonjsHelpers_esm = __esm({
  "../../../dist/browser/_virtual/_commonjsHelpers.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/index.esm5.js
var eventemitter3;
var init_index_esm5 = __esm({
  "../../../dist/browser/_virtual/index.esm5.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    eventemitter3 = { exports: {} };
  }
});

// ../../../dist/browser/node_modules/eventemitter3/index.esm.js
function requireEventemitter3() {
  if (hasRequiredEventemitter3) return eventemitter3.exports;
  hasRequiredEventemitter3 = 1;
  (function(module) {
    var has = Object.prototype.hasOwnProperty, prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter2() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter2.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0) return names;
      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter2.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee2 = new Array(l); i < l; i++) {
        ee2[i] = handlers[i].fn;
      }
      return ee2;
    };
    EventEmitter2.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter2.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter2.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
    EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
    EventEmitter2.prefixed = prefix;
    EventEmitter2.EventEmitter = EventEmitter2;
    {
      module.exports = EventEmitter2;
    }
  })(eventemitter3);
  return eventemitter3.exports;
}
var hasRequiredEventemitter3;
var init_index_esm = __esm({
  "../../../dist/browser/node_modules/eventemitter3/index.esm.js"() {
    init_index_esm5();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/index.esm4.js
var eventemitter3Exports, EventEmitter;
var init_index_esm4 = __esm({
  "../../../dist/browser/_virtual/index.esm4.js"() {
    "use strict";
    init_commonjsHelpers_esm();
    init_index_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    eventemitter3Exports = requireEventemitter3();
    EventEmitter = /* @__PURE__ */ getDefaultExportFromCjs(eventemitter3Exports);
  }
});

// ../../../dist/browser/node_modules/p-timeout/index.esm.js
function pTimeout(promise, options) {
  const {
    milliseconds,
    fallback,
    message,
    customTimers = { setTimeout, clearTimeout }
  } = options;
  let timer;
  const wrappedPromise = new Promise((resolve, reject) => {
    if (typeof milliseconds !== "number" || Math.sign(milliseconds) !== 1) {
      throw new TypeError(`Expected \`milliseconds\` to be a positive number, got \`${milliseconds}\``);
    }
    if (options.signal) {
      const { signal } = options;
      if (signal.aborted) {
        reject(getAbortedReason(signal));
      }
      signal.addEventListener("abort", () => {
        reject(getAbortedReason(signal));
      });
    }
    if (milliseconds === Number.POSITIVE_INFINITY) {
      promise.then(resolve, reject);
      return;
    }
    const timeoutError = new TimeoutError();
    timer = customTimers.setTimeout.call(void 0, () => {
      if (fallback) {
        try {
          resolve(fallback());
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (typeof promise.cancel === "function") {
        promise.cancel();
      }
      if (message === false) {
        resolve();
      } else if (message instanceof Error) {
        reject(message);
      } else {
        timeoutError.message = message ?? `Promise timed out after ${milliseconds} milliseconds`;
        reject(timeoutError);
      }
    }, milliseconds);
    (async () => {
      try {
        resolve(await promise);
      } catch (error) {
        reject(error);
      }
    })();
  });
  const cancelablePromise = wrappedPromise.finally(() => {
    cancelablePromise.clear();
  });
  cancelablePromise.clear = () => {
    customTimers.clearTimeout.call(void 0, timer);
    timer = void 0;
  };
  return cancelablePromise;
}
var TimeoutError, AbortError, getDOMException, getAbortedReason;
var init_index_esm2 = __esm({
  "../../../dist/browser/node_modules/p-timeout/index.esm.js"() {
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    TimeoutError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "TimeoutError";
      }
    };
    AbortError = class extends Error {
      constructor(message) {
        super();
        this.name = "AbortError";
        this.message = message;
      }
    };
    getDOMException = (errorMessage) => globalThis.DOMException === void 0 ? new AbortError(errorMessage) : new DOMException(errorMessage);
    getAbortedReason = (signal) => {
      const reason = signal.reason === void 0 ? getDOMException("This operation was aborted.") : signal.reason;
      return reason instanceof Error ? reason : getDOMException(reason);
    };
  }
});

// ../../../dist/browser/node_modules/p-queue/dist/lower-bound.esm.js
function lowerBound(array, value, comparator) {
  let first = 0;
  let count = array.length;
  while (count > 0) {
    const step = Math.trunc(count / 2);
    let it = first + step;
    if (comparator(array[it], value) <= 0) {
      first = ++it;
      count -= step + 1;
    } else {
      count = step;
    }
  }
  return first;
}
var init_lower_bound_esm = __esm({
  "../../../dist/browser/node_modules/p-queue/dist/lower-bound.esm.js"() {
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/node_modules/p-queue/dist/priority-queue.esm.js
var PriorityQueue;
var init_priority_queue_esm = __esm({
  "../../../dist/browser/node_modules/p-queue/dist/priority-queue.esm.js"() {
    init_lower_bound_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    PriorityQueue = class {
      #queue = [];
      enqueue(run, options) {
        options = {
          priority: 0,
          ...options
        };
        const element = {
          priority: options.priority,
          run
        };
        if (this.size && this.#queue[this.size - 1].priority >= options.priority) {
          this.#queue.push(element);
          return;
        }
        const index = lowerBound(this.#queue, element, (a, b) => b.priority - a.priority);
        this.#queue.splice(index, 0, element);
      }
      dequeue() {
        const item = this.#queue.shift();
        return item?.run;
      }
      filter(options) {
        return this.#queue.filter((element) => element.priority === options.priority).map((element) => element.run);
      }
      get size() {
        return this.#queue.length;
      }
    };
  }
});

// ../../../dist/browser/node_modules/p-queue/dist/index.esm.js
var PQueue;
var init_index_esm3 = __esm({
  "../../../dist/browser/node_modules/p-queue/dist/index.esm.js"() {
    init_index_esm4();
    init_index_esm2();
    init_priority_queue_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    PQueue = class extends EventEmitter {
      #carryoverConcurrencyCount;
      #isIntervalIgnored;
      #intervalCount = 0;
      #intervalCap;
      #interval;
      #intervalEnd = 0;
      #intervalId;
      #timeoutId;
      #queue;
      #queueClass;
      #pending = 0;
      // The `!` is needed because of https://github.com/microsoft/TypeScript/issues/32194
      #concurrency;
      #isPaused;
      #throwOnTimeout;
      /**
          Per-operation timeout in milliseconds. Operations fulfill once `timeout` elapses if they haven't already.
      
          Applies to each future operation.
          */
      timeout;
      // TODO: The `throwOnTimeout` option should affect the return types of `add()` and `addAll()`
      constructor(options) {
        super();
        options = {
          carryoverConcurrencyCount: false,
          intervalCap: Number.POSITIVE_INFINITY,
          interval: 0,
          concurrency: Number.POSITIVE_INFINITY,
          autoStart: true,
          queueClass: PriorityQueue,
          ...options
        };
        if (!(typeof options.intervalCap === "number" && options.intervalCap >= 1)) {
          throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${options.intervalCap?.toString() ?? ""}\` (${typeof options.intervalCap})`);
        }
        if (options.interval === void 0 || !(Number.isFinite(options.interval) && options.interval >= 0)) {
          throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${options.interval?.toString() ?? ""}\` (${typeof options.interval})`);
        }
        this.#carryoverConcurrencyCount = options.carryoverConcurrencyCount;
        this.#isIntervalIgnored = options.intervalCap === Number.POSITIVE_INFINITY || options.interval === 0;
        this.#intervalCap = options.intervalCap;
        this.#interval = options.interval;
        this.#queue = new options.queueClass();
        this.#queueClass = options.queueClass;
        this.concurrency = options.concurrency;
        this.timeout = options.timeout;
        this.#throwOnTimeout = options.throwOnTimeout === true;
        this.#isPaused = options.autoStart === false;
      }
      get #doesIntervalAllowAnother() {
        return this.#isIntervalIgnored || this.#intervalCount < this.#intervalCap;
      }
      get #doesConcurrentAllowAnother() {
        return this.#pending < this.#concurrency;
      }
      #next() {
        this.#pending--;
        this.#tryToStartAnother();
        this.emit("next");
      }
      #onResumeInterval() {
        this.#onInterval();
        this.#initializeIntervalIfNeeded();
        this.#timeoutId = void 0;
      }
      get #isIntervalPaused() {
        const now = Date.now();
        if (this.#intervalId === void 0) {
          const delay = this.#intervalEnd - now;
          if (delay < 0) {
            this.#intervalCount = this.#carryoverConcurrencyCount ? this.#pending : 0;
          } else {
            if (this.#timeoutId === void 0) {
              this.#timeoutId = setTimeout(() => {
                this.#onResumeInterval();
              }, delay);
            }
            return true;
          }
        }
        return false;
      }
      #tryToStartAnother() {
        if (this.#queue.size === 0) {
          if (this.#intervalId) {
            clearInterval(this.#intervalId);
          }
          this.#intervalId = void 0;
          this.emit("empty");
          if (this.#pending === 0) {
            this.emit("idle");
          }
          return false;
        }
        if (!this.#isPaused) {
          const canInitializeInterval = !this.#isIntervalPaused;
          if (this.#doesIntervalAllowAnother && this.#doesConcurrentAllowAnother) {
            const job = this.#queue.dequeue();
            if (!job) {
              return false;
            }
            this.emit("active");
            job();
            if (canInitializeInterval) {
              this.#initializeIntervalIfNeeded();
            }
            return true;
          }
        }
        return false;
      }
      #initializeIntervalIfNeeded() {
        if (this.#isIntervalIgnored || this.#intervalId !== void 0) {
          return;
        }
        this.#intervalId = setInterval(() => {
          this.#onInterval();
        }, this.#interval);
        this.#intervalEnd = Date.now() + this.#interval;
      }
      #onInterval() {
        if (this.#intervalCount === 0 && this.#pending === 0 && this.#intervalId) {
          clearInterval(this.#intervalId);
          this.#intervalId = void 0;
        }
        this.#intervalCount = this.#carryoverConcurrencyCount ? this.#pending : 0;
        this.#processQueue();
      }
      /**
      Executes all queued functions until it reaches the limit.
      */
      #processQueue() {
        while (this.#tryToStartAnother()) {
        }
      }
      get concurrency() {
        return this.#concurrency;
      }
      set concurrency(newConcurrency) {
        if (!(typeof newConcurrency === "number" && newConcurrency >= 1)) {
          throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${newConcurrency}\` (${typeof newConcurrency})`);
        }
        this.#concurrency = newConcurrency;
        this.#processQueue();
      }
      async #throwOnAbort(signal) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(signal.reason);
          }, { once: true });
        });
      }
      async add(function_, options = {}) {
        options = {
          timeout: this.timeout,
          throwOnTimeout: this.#throwOnTimeout,
          ...options
        };
        return new Promise((resolve, reject) => {
          this.#queue.enqueue(async () => {
            this.#pending++;
            this.#intervalCount++;
            try {
              options.signal?.throwIfAborted();
              let operation = function_({ signal: options.signal });
              if (options.timeout) {
                operation = pTimeout(Promise.resolve(operation), { milliseconds: options.timeout });
              }
              if (options.signal) {
                operation = Promise.race([operation, this.#throwOnAbort(options.signal)]);
              }
              const result = await operation;
              resolve(result);
              this.emit("completed", result);
            } catch (error) {
              if (error instanceof TimeoutError && !options.throwOnTimeout) {
                resolve();
                return;
              }
              reject(error);
              this.emit("error", error);
            } finally {
              this.#next();
            }
          }, options);
          this.emit("add");
          this.#tryToStartAnother();
        });
      }
      async addAll(functions, options) {
        return Promise.all(functions.map(async (function_) => this.add(function_, options)));
      }
      /**
      Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
      */
      start() {
        if (!this.#isPaused) {
          return this;
        }
        this.#isPaused = false;
        this.#processQueue();
        return this;
      }
      /**
      Put queue execution on hold.
      */
      pause() {
        this.#isPaused = true;
      }
      /**
      Clear the queue.
      */
      clear() {
        this.#queue = new this.#queueClass();
      }
      /**
          Can be called multiple times. Useful if you for example add additional items at a later time.
      
          @returns A promise that settles when the queue becomes empty.
          */
      async onEmpty() {
        if (this.#queue.size === 0) {
          return;
        }
        await this.#onEvent("empty");
      }
      /**
          @returns A promise that settles when the queue size is less than the given limit: `queue.size < limit`.
      
          If you want to avoid having the queue grow beyond a certain size you can `await queue.onSizeLessThan()` before adding a new item.
      
          Note that this only limits the number of items waiting to start. There could still be up to `concurrency` jobs already running that this call does not include in its calculation.
          */
      async onSizeLessThan(limit) {
        if (this.#queue.size < limit) {
          return;
        }
        await this.#onEvent("next", () => this.#queue.size < limit);
      }
      /**
          The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.
      
          @returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
          */
      async onIdle() {
        if (this.#pending === 0 && this.#queue.size === 0) {
          return;
        }
        await this.#onEvent("idle");
      }
      async #onEvent(event, filter) {
        return new Promise((resolve) => {
          const listener = () => {
            if (filter && !filter()) {
              return;
            }
            this.off(event, listener);
            resolve();
          };
          this.on(event, listener);
        });
      }
      /**
      Size of the queue, the number of queued items waiting to run.
      */
      get size() {
        return this.#queue.size;
      }
      /**
          Size of the queue, filtered by the given options.
      
          For example, this can be used to find the number of items remaining in the queue with a specific priority level.
          */
      sizeBy(options) {
        return this.#queue.filter(options).length;
      }
      /**
      Number of running items (no longer in the queue).
      */
      get pending() {
        return this.#pending;
      }
      /**
      Whether the queue is currently paused.
      */
      get isPaused() {
        return this.#isPaused;
      }
    };
  }
});

// ../../../dist/browser/core/AdapterWorker.esm.js
var WorkerContext, AdapterWorkerResultType, AdapterWorker;
var init_AdapterWorker_esm = __esm({
  "../../../dist/browser/core/AdapterWorker.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Workers_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    (function(WorkerContext2) {
      WorkerContext2[WorkerContext2["MainThread"] = 0] = "MainThread";
      WorkerContext2[WorkerContext2["Worker"] = 1] = "Worker";
      WorkerContext2[WorkerContext2["DedicatedWorker"] = 2] = "DedicatedWorker";
    })(WorkerContext || (WorkerContext = {}));
    (function(AdapterWorkerResultType2) {
      AdapterWorkerResultType2["events"] = "events";
      AdapterWorkerResultType2["event"] = "event";
      AdapterWorkerResultType2["record"] = "record";
      AdapterWorkerResultType2["records"] = "records";
    })(AdapterWorkerResultType || (AdapterWorkerResultType = {}));
    AdapterWorker = /** @class */
    function() {
      function AdapterWorker2(options) {
        if (!options)
          return;
        this.setContext(options);
        this.setupHandlers();
      }
      Object.defineProperty(AdapterWorker2.prototype, "context", {
        get: function() {
          return this._context;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(AdapterWorker2.prototype, "mainThread", {
        get: function() {
          return this._mainThread;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(AdapterWorker2.prototype, "channel", {
        get: function() {
          return this._channelPort;
        },
        set: function(port) {
          this._channelPort = port;
        },
        enumerable: false,
        configurable: true
      });
      AdapterWorker2.prototype.setContext = function(options) {
        if (!options) {
          options = {
            mainThread: this === null || this === void 0 ? void 0 : this.mainThread,
            channelPort: this === null || this === void 0 ? void 0 : this.channel
            // sharedWorkerPort: this?.sharedWorker
          };
        }
        if (options === null || options === void 0 ? void 0 : options.mainThread) {
          this._context = WorkerContext.Worker;
          this._mainThread = options.mainThread;
        }
        if (options === null || options === void 0 ? void 0 : options.channelPort) {
          this._context = WorkerContext.Worker;
          this._channelPort = options.channelPort;
        }
      };
      AdapterWorker2.prototype.setup = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            console.warn("".concat(this.constructor.name, " setup() method not implemented"));
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWorker2.prototype._setup = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            console.warn("Adapter's Worker _setup() method not implemented");
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWorker2.prototype.__setup = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          var channelPort;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                channelPort = command.channelPort;
                if (channelPort) {
                  this.channel = channelPort;
                  this.setupChannelHandlers();
                }
                return [4, this._setup(command)];
              case 1:
                _a2.sent();
                return [2, this.setup(command)];
            }
          });
        });
      };
      AdapterWorker2.prototype.setupChannelHandlers = function() {
        var _this = this;
        if (!this.channel)
          return console.warn("channel not defined");
        this.channel.onmessage = function(message) {
          var command = message.data;
          _this.listenPingPong("channel", command);
          _this.onChannelMessage(command);
        };
        this.channel.onmessageerror = this.onMessageError;
      };
      AdapterWorker2.prototype.setupHandlers = function() {
        var _this = this;
        if (!(this === null || this === void 0 ? void 0 : this.mainThread))
          return console.warn("mainThread not defined");
        this.mainThread.onmessage = function(message) {
          return __awaiter(_this, void 0, void 0, function() {
            var command;
            return __generator(this, function(_a2) {
              switch (_a2.label) {
                case 0:
                  command = message.data;
                  this.listenPingPong("mainthread", command);
                  if (!(command.type === "setup")) return [3, 2];
                  return [4, this.__setup(command)];
                case 1:
                  _a2.sent();
                  return [
                    2
                    /*return*/
                  ];
                case 2:
                  this.onMainThreadMessage(command);
                  return [
                    2
                    /*return*/
                  ];
              }
            });
          });
        };
      };
      AdapterWorker2.prototype.command = function(destination, resultType, result) {
        result = this.encode(result);
        var message = {
          type: "result",
          resultType,
          result
        };
        var transferable = result;
        if (destination.includes("toChannel")) {
          var resultTypeCap = resultType.charAt(0).toUpperCase() + resultType.slice(1);
          message.type = resultTypeCap;
          this.postMessageChannel(message, [transferable]);
        }
        if (destination.includes("toAdapter")) {
          this.postMessageAdapter(message, [transferable]);
        }
      };
      AdapterWorker2.prototype.postMessageAdapter = function(command, transfer) {
        if (!(this === null || this === void 0 ? void 0 : this.mainThread))
          return console.warn("cannot send message to mainThread: undefined");
        this.mainThread.postMessage(command, transfer);
      };
      AdapterWorker2.prototype.postMessageChannel = function(command, transfer) {
        if (!(this === null || this === void 0 ? void 0 : this.channel))
          return console.warn("cannot send message through message channel: undefined");
        if (transfer) {
          return this.channel.postMessage(command, transfer);
        }
        this.channel.postMessage(command);
      };
      AdapterWorker2.prototype.onMainThreadMessage = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, console.warn("onMainThreadMessage not overloaded by adapter, so the following is going nowhere fast:", command)];
          });
        });
      };
      AdapterWorker2.prototype.onChannelMessage = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, console.warn("onChannelMessage not overloaded by adapter, so the following is going nowhere fast:", command)];
          });
        });
      };
      AdapterWorker2.prototype.onMessageError = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWorker2.prototype.onError = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWorker2.prototype.encode = function(json) {
        return Workers.encodeNostrEventArrayAsBuffer(json);
      };
      AdapterWorker2.prototype.decode = function(arrayBuffer) {
        return Workers.decodeNostrEventArrayFromBuffer(arrayBuffer);
      };
      AdapterWorker2.prototype.pingChannel = function() {
        this.postMessageChannel({ type: "ping" });
      };
      AdapterWorker2.prototype.pongMainThread = function() {
        this.postMessageAdapter({ type: "pong" });
      };
      AdapterWorker2.prototype.pongChannel = function() {
        this.postMessageChannel({ type: "pong" });
      };
      AdapterWorker2.prototype.listenPingPong = function(from, command) {
        if (command.type === "ping") {
          if (from === "mainthread") {
            this.pingChannel();
            this.pongMainThread();
          }
          if (from === "channel") {
            this.pongChannel();
          }
          return;
        }
        if (command.type === "pong") ;
      };
      return AdapterWorker2;
    }();
  }
});

// ../../../dist/browser/core/AdapterCacheWorker.esm.js
var AdapterCacheWorker;
var init_AdapterCacheWorker_esm = __esm({
  "../../../dist/browser/core/AdapterCacheWorker.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_index_esm3();
    init_AdapterWorker_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    AdapterCacheWorker = /** @class */
    function(_super) {
      __extends(AdapterCacheWorker2, _super);
      function AdapterCacheWorker2(options) {
        var _this = _super.call(this, options) || this;
        _this.queue = new PQueue({ concurrency: 20 });
        return _this;
      }
      AdapterCacheWorker2.prototype.setup = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, void 0];
          });
        });
      };
      AdapterCacheWorker2.prototype.addEvent = function(event) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, void 0];
          });
        });
      };
      AdapterCacheWorker2.prototype.addEvents = function(events) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, void 0];
          });
        });
      };
      AdapterCacheWorker2.prototype.addToQueue = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          var priority;
          var _this = this;
          return __generator(this, function(_a2) {
            priority = 10;
            this.queue.add(function() {
              return __awaiter(_this, void 0, void 0, function() {
                var result, event;
                return __generator(this, function(_a3) {
                  switch (_a3.label) {
                    case 0:
                      result = command.result;
                      if (!result)
                        return [2, console.warn("result is not defined")];
                      event = this.decode(result);
                      if (!(event instanceof Array)) return [3, 2];
                      return [4, this.addEvents(event)];
                    case 1:
                      _a3.sent();
                      return [3, 4];
                    case 2:
                      return [4, this.addEvent(event)];
                    case 3:
                      _a3.sent();
                      _a3.label = 4;
                    case 4:
                      return [
                        2
                        /*return*/
                      ];
                  }
                });
              });
            }, { priority });
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterCacheWorker2.prototype.onMessage = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          var type, result, event;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                console.log("AdapterCacheWorker: onMessage", command);
                type = command.type, result = command.result;
                if (type === "complete")
                  return [
                    2
                    /*return*/
                  ];
                if (!result)
                  return [2, console.warn("result is not defined", command)];
                event = this.decode(result);
                if (!(event instanceof Array)) return [3, 2];
                return [4, this.addEvents(event)];
              case 1:
                _a2.sent();
                return [3, 4];
              case 2:
                return [4, this.addEvent(event)];
              case 3:
                _a2.sent();
                _a2.label = 4;
              case 4:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      AdapterCacheWorker2.prototype.onMainThreadMessage = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, void 0];
          });
        });
      };
      AdapterCacheWorker2.prototype.onChannelMessage = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            this.onMessage(command);
            return [
              2
              /*return*/
            ];
          });
        });
      };
      return AdapterCacheWorker2;
    }(AdapterWorker);
  }
});

// ../../../dist/browser/utils/hash.esm.js
function getType(value) {
  if (value === null)
    return "null";
  if (Array.isArray(value))
    return "array";
  if (value instanceof Date)
    return "date";
  if (value instanceof RegExp)
    return "regexp";
  if (value instanceof Map)
    return "map";
  if (value instanceof Set)
    return "set";
  return typeof value;
}
function deterministicStringify(value) {
  var seen = /* @__PURE__ */ new WeakSet();
  function stringify(val) {
    var type = getType(val);
    switch (type) {
      case "undefined":
        return "undefined";
      case "null":
        return "null";
      case "boolean":
      case "number":
      case "bigint":
      case "symbol":
        return val.toString();
      case "string":
        return JSON.stringify(val);
      case "date":
        return "Date:".concat(val.toISOString());
      case "regexp":
        return "RegExp:".concat(val.toString());
      case "function":
        return "Function:".concat(val.toString());
      case "array":
        return "[".concat(val.map(function(item) {
          return stringify(item);
        }).join(","), "]");
      case "map": {
        var mapEntries = Array.from(val.entries()).sort(function(_a2, _b) {
          var a = _a2[0];
          var b = _b[0];
          if (a < b)
            return -1;
          if (a > b)
            return 1;
          return 0;
        });
        return "Map:{".concat(mapEntries.map(function(_a2) {
          var k = _a2[0], v = _a2[1];
          return "".concat(stringify(k), "=>").concat(stringify(v));
        }).join(","), "}");
      }
      case "set":
        var setEntries = Array.from(val.values()).sort();
        return "Set:{".concat(setEntries.map(function(item) {
          return stringify(item);
        }).join(","), "}");
      case "object":
        if (seen.has(val)) {
          throw new TypeError("Converting circular structure to string");
        }
        seen.add(val);
        var keys = Object.keys(val).sort();
        var objString = "{".concat(keys.map(function(key) {
          return "".concat(JSON.stringify(key), ":").concat(stringify(val[key]));
        }).join(","), "}");
        seen.delete(val);
        return objString;
      default:
        return "";
    }
  }
  return stringify(value);
}
function fnv1aHash(str) {
  var hash = 2166136261;
  var prime = 16777619;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = hash * prime >>> 0;
  }
  return ("0000000" + hash.toString(16)).slice(-8);
}
function deterministicHash(value) {
  var serialized = deterministicStringify(value);
  return fnv1aHash(serialized);
}
var init_hash_esm = __esm({
  "../../../dist/browser/utils/hash.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/index.esm2.js
var lib;
var init_index_esm22 = __esm({
  "../../../dist/browser/_virtual/index.esm2.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    lib = {};
  }
});

// ../../../dist/browser/_virtual/types.esm.js
var types;
var init_types_esm = __esm({
  "../../../dist/browser/_virtual/types.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    types = {};
  }
});

// ../../../dist/browser/node_modules/tseep/lib/types.esm.js
function requireTypes() {
  if (hasRequiredTypes) return types;
  hasRequiredTypes = 1;
  Object.defineProperty(types, "__esModule", { value: true });
  return types;
}
var hasRequiredTypes;
var init_types_esm2 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/types.esm.js"() {
    init_types_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/ee.esm.js
var ee;
var init_ee_esm = __esm({
  "../../../dist/browser/_virtual/ee.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    ee = {};
  }
});

// ../../../dist/browser/_virtual/index.esm3.js
var taskCollection;
var init_index_esm32 = __esm({
  "../../../dist/browser/_virtual/index.esm3.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    taskCollection = {};
  }
});

// ../../../dist/browser/_virtual/task-collection.esm.js
var taskCollection2;
var init_task_collection_esm = __esm({
  "../../../dist/browser/_virtual/task-collection.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    taskCollection2 = {};
  }
});

// ../../../dist/browser/_virtual/utils.esm2.js
var utils;
var init_utils_esm2 = __esm({
  "../../../dist/browser/_virtual/utils.esm2.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    utils = {};
  }
});

// ../../../dist/browser/node_modules/tseep/lib/task-collection/utils.esm.js
function requireUtils() {
  if (hasRequiredUtils) return utils;
  hasRequiredUtils = 1;
  Object.defineProperty(utils, "__esModule", { value: true });
  utils._fast_remove_single = void 0;
  function _fast_remove_single(arr, index) {
    if (index === -1)
      return;
    if (index === 0)
      arr.shift();
    else if (index === arr.length - 1)
      arr.length = arr.length - 1;
    else
      arr.splice(index, 1);
  }
  utils._fast_remove_single = _fast_remove_single;
  return utils;
}
var hasRequiredUtils;
var init_utils_esm = __esm({
  "../../../dist/browser/node_modules/tseep/lib/task-collection/utils.esm.js"() {
    init_utils_esm2();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/bake-collection.esm.js
var bakeCollection2;
var init_bake_collection_esm = __esm({
  "../../../dist/browser/_virtual/bake-collection.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    bakeCollection2 = {};
  }
});

// ../../../dist/browser/node_modules/tseep/lib/task-collection/bake-collection.esm.js
function requireBakeCollection() {
  if (hasRequiredBakeCollection) return bakeCollection2;
  hasRequiredBakeCollection = 1;
  (function(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bakeCollectionVariadic = exports.bakeCollectionAwait = exports.bakeCollection = exports.BAKED_EMPTY_FUNC = void 0;
    exports.BAKED_EMPTY_FUNC = function() {
    };
    var FORLOOP_FALLBACK = 1500;
    function generateArgsDefCode(numArgs) {
      var argsDefCode2 = "";
      if (numArgs === 0)
        return argsDefCode2;
      for (var i = 0; i < numArgs - 1; ++i) {
        argsDefCode2 += "arg" + String(i) + ", ";
      }
      argsDefCode2 += "arg" + String(numArgs - 1);
      return argsDefCode2;
    }
    function generateBodyPartsCode(argsDefCode2, collectionLength) {
      var funcDefCode2 = "", funcCallCode2 = "";
      for (var i = 0; i < collectionLength; ++i) {
        funcDefCode2 += "var f".concat(i, " = collection[").concat(i, "];\n");
        funcCallCode2 += "f".concat(i, "(").concat(argsDefCode2, ")\n");
      }
      return { funcDefCode: funcDefCode2, funcCallCode: funcCallCode2 };
    }
    function generateBodyPartsVariadicCode(collectionLength) {
      var funcDefCode2 = "", funcCallCode2 = "";
      for (var i = 0; i < collectionLength; ++i) {
        funcDefCode2 += "var f".concat(i, " = collection[").concat(i, "];\n");
        funcCallCode2 += "f".concat(i, ".apply(undefined, arguments)\n");
      }
      return { funcDefCode: funcDefCode2, funcCallCode: funcCallCode2 };
    }
    function bakeCollection(collection, fixedArgsNum) {
      if (collection.length === 0)
        return exports.BAKED_EMPTY_FUNC;
      else if (collection.length === 1)
        return collection[0];
      var funcFactoryCode;
      if (collection.length < FORLOOP_FALLBACK) {
        var argsDefCode = generateArgsDefCode(fixedArgsNum);
        var _a = generateBodyPartsCode(argsDefCode, collection.length), funcDefCode = _a.funcDefCode, funcCallCode = _a.funcCallCode;
        funcFactoryCode = "(function(collection) {\n            ".concat(funcDefCode, "\n            collection = undefined;\n            return (function(").concat(argsDefCode, ") {\n                ").concat(funcCallCode, "\n            });\n        })");
      } else {
        var argsDefCode = generateArgsDefCode(fixedArgsNum);
        if (collection.length % 10 === 0) {
          funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; i += 10) {\n                        collection[i](").concat(argsDefCode, ");\n                        collection[i+1](").concat(argsDefCode, ");\n                        collection[i+2](").concat(argsDefCode, ");\n                        collection[i+3](").concat(argsDefCode, ");\n                        collection[i+4](").concat(argsDefCode, ");\n                        collection[i+5](").concat(argsDefCode, ");\n                        collection[i+6](").concat(argsDefCode, ");\n                        collection[i+7](").concat(argsDefCode, ");\n                        collection[i+8](").concat(argsDefCode, ");\n                        collection[i+9](").concat(argsDefCode, ");\n                    }\n                });\n            })");
        } else if (collection.length % 4 === 0) {
          funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; i += 4) {\n                        collection[i](").concat(argsDefCode, ");\n                        collection[i+1](").concat(argsDefCode, ");\n                        collection[i+2](").concat(argsDefCode, ");\n                        collection[i+3](").concat(argsDefCode, ");\n                    }\n                });\n            })");
        } else if (collection.length % 3 === 0) {
          funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; i += 3) {\n                        collection[i](").concat(argsDefCode, ");\n                        collection[i+1](").concat(argsDefCode, ");\n                        collection[i+2](").concat(argsDefCode, ");\n                    }\n                });\n            })");
        } else {
          funcFactoryCode = "(function(collection) {\n                return (function(".concat(argsDefCode, ") {\n                    for (var i = 0; i < collection.length; ++i) {\n                        collection[i](").concat(argsDefCode, ");\n                    }\n                });\n            })");
        }
      }
      {
        var funcFactory = eval(funcFactoryCode);
        return funcFactory(collection);
      }
    }
    exports.bakeCollection = bakeCollection;
    function bakeCollectionAwait(collection, fixedArgsNum) {
      if (collection.length === 0)
        return exports.BAKED_EMPTY_FUNC;
      else if (collection.length === 1)
        return collection[0];
      var funcFactoryCode;
      if (collection.length < FORLOOP_FALLBACK) {
        var argsDefCode = generateArgsDefCode(fixedArgsNum);
        var _a = generateBodyPartsCode(argsDefCode, collection.length), funcDefCode = _a.funcDefCode, funcCallCode = _a.funcCallCode;
        funcFactoryCode = "(function(collection) {\n            ".concat(funcDefCode, "\n            collection = undefined;\n            return (function(").concat(argsDefCode, ") {\n                return Promise.all([ ").concat(funcCallCode, " ]);\n            });\n        })");
      } else {
        var argsDefCode = generateArgsDefCode(fixedArgsNum);
        funcFactoryCode = "(function(collection) {\n            return (function(".concat(argsDefCode, ") {\n                var promises = Array(collection.length);\n                for (var i = 0; i < collection.length; ++i) {\n                    promises[i] = collection[i](").concat(argsDefCode, ");\n                }\n                return Promise.all(promises);\n            });\n        })");
      }
      {
        var funcFactory = eval(funcFactoryCode);
        return funcFactory(collection);
      }
    }
    exports.bakeCollectionAwait = bakeCollectionAwait;
    function bakeCollectionVariadic(collection) {
      if (collection.length === 0)
        return exports.BAKED_EMPTY_FUNC;
      else if (collection.length === 1)
        return collection[0];
      var funcFactoryCode;
      if (collection.length < FORLOOP_FALLBACK) {
        var _a = generateBodyPartsVariadicCode(collection.length), funcDefCode = _a.funcDefCode, funcCallCode = _a.funcCallCode;
        funcFactoryCode = "(function(collection) {\n            ".concat(funcDefCode, "\n            collection = undefined;\n            return (function() {\n                ").concat(funcCallCode, "\n            });\n        })");
      } else {
        funcFactoryCode = "(function(collection) {\n            return (function() {\n                for (var i = 0; i < collection.length; ++i) {\n                    collection[i].apply(undefined, arguments);\n                }\n            });\n        })";
      }
      {
        var funcFactory = eval(funcFactoryCode);
        return funcFactory(collection);
      }
    }
    exports.bakeCollectionVariadic = bakeCollectionVariadic;
  })(bakeCollection2);
  return bakeCollection2;
}
var hasRequiredBakeCollection;
var init_bake_collection_esm2 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/task-collection/bake-collection.esm.js"() {
    init_bake_collection_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/node_modules/tseep/lib/task-collection/task-collection.esm.js
function requireTaskCollection() {
  if (hasRequiredTaskCollection) return taskCollection2;
  hasRequiredTaskCollection = 1;
  var __spreadArray2 = taskCollection2 && taskCollection2.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  Object.defineProperty(taskCollection2, "__esModule", { value: true });
  taskCollection2.TaskCollection = void 0;
  var utils_1 = requireUtils();
  var bake_collection_1 = requireBakeCollection();
  function push_norebuild(a, b) {
    var len = this.length;
    if (len > 1) {
      if (b) {
        var _a2;
        (_a2 = this._tasks).push.apply(_a2, arguments);
        this.length += arguments.length;
      } else {
        this._tasks.push(a);
        this.length++;
      }
    } else {
      if (b) {
        if (len === 1) {
          var newAr = Array(1 + arguments.length);
          newAr.push(newAr);
          newAr.push.apply(newAr, arguments);
          this._tasks = newAr;
        } else {
          var newAr = Array(arguments.length);
          newAr.push.apply(newAr, arguments);
          this._tasks = newAr;
        }
        this.length += arguments.length;
      } else {
        if (len === 1)
          this._tasks = [this._tasks, a];
        else
          this._tasks = a;
        this.length++;
      }
    }
  }
  function push_rebuild(a, b) {
    var len = this.length;
    if (len > 1) {
      if (b) {
        var _a2;
        (_a2 = this._tasks).push.apply(_a2, arguments);
        this.length += arguments.length;
      } else {
        this._tasks.push(a);
        this.length++;
      }
    } else {
      if (b) {
        if (len === 1) {
          var newAr = Array(1 + arguments.length);
          newAr.push(newAr);
          newAr.push.apply(newAr, arguments);
          this._tasks = newAr;
        } else {
          var newAr = Array(arguments.length);
          newAr.push.apply(newAr, arguments);
          this._tasks = newAr;
        }
        this.length += arguments.length;
      } else {
        if (len === 1)
          this._tasks = [this._tasks, a];
        else
          this._tasks = a;
        this.length++;
      }
    }
    if (this.firstEmitBuildStrategy)
      this.call = rebuild_on_first_call;
    else
      this.rebuild();
  }
  function removeLast_norebuild(a) {
    if (this.length === 0)
      return;
    if (this.length === 1) {
      if (this._tasks === a) {
        this.length = 0;
      }
    } else {
      (0, utils_1._fast_remove_single)(this._tasks, this._tasks.lastIndexOf(a));
      if (this._tasks.length === 1) {
        this._tasks = this._tasks[0];
        this.length = 1;
      } else
        this.length = this._tasks.length;
    }
  }
  function removeLast_rebuild(a) {
    if (this.length === 0)
      return;
    if (this.length === 1) {
      if (this._tasks === a) {
        this.length = 0;
      }
      if (this.firstEmitBuildStrategy) {
        this.call = bake_collection_1.BAKED_EMPTY_FUNC;
        return;
      } else {
        this.rebuild();
        return;
      }
    } else {
      (0, utils_1._fast_remove_single)(this._tasks, this._tasks.lastIndexOf(a));
      if (this._tasks.length === 1) {
        this._tasks = this._tasks[0];
        this.length = 1;
      } else
        this.length = this._tasks.length;
    }
    if (this.firstEmitBuildStrategy)
      this.call = rebuild_on_first_call;
    else
      this.rebuild();
  }
  function insert_norebuild(index) {
    var _b;
    var func = [];
    for (var _i = 1; _i < arguments.length; _i++) {
      func[_i - 1] = arguments[_i];
    }
    if (this.length === 0) {
      this._tasks = func;
      this.length = 1;
    } else if (this.length === 1) {
      func.unshift(this._tasks);
      this._tasks = func;
      this.length = this._tasks.length;
    } else {
      (_b = this._tasks).splice.apply(_b, __spreadArray2([index, 0], func, false));
      this.length = this._tasks.length;
    }
  }
  function insert_rebuild(index) {
    var _b;
    var func = [];
    for (var _i = 1; _i < arguments.length; _i++) {
      func[_i - 1] = arguments[_i];
    }
    if (this.length === 0) {
      this._tasks = func;
      this.length = 1;
    } else if (this.length === 1) {
      func.unshift(this._tasks);
      this._tasks = func;
      this.length = this._tasks.length;
    } else {
      (_b = this._tasks).splice.apply(_b, __spreadArray2([index, 0], func, false));
      this.length = this._tasks.length;
    }
    if (this.firstEmitBuildStrategy)
      this.call = rebuild_on_first_call;
    else
      this.rebuild();
  }
  function rebuild_noawait() {
    if (this.length === 0)
      this.call = bake_collection_1.BAKED_EMPTY_FUNC;
    else if (this.length === 1)
      this.call = this._tasks;
    else
      this.call = (0, bake_collection_1.bakeCollection)(this._tasks, this.argsNum);
  }
  function rebuild_await() {
    if (this.length === 0)
      this.call = bake_collection_1.BAKED_EMPTY_FUNC;
    else if (this.length === 1)
      this.call = this._tasks;
    else
      this.call = (0, bake_collection_1.bakeCollectionAwait)(this._tasks, this.argsNum);
  }
  function rebuild_on_first_call() {
    this.rebuild();
    this.call.apply(void 0, arguments);
  }
  var TaskCollection = (
    /** @class */
    /* @__PURE__ */ function() {
      function TaskCollection2(argsNum, autoRebuild, initialTasks, awaitTasks) {
        if (autoRebuild === void 0) {
          autoRebuild = true;
        }
        if (initialTasks === void 0) {
          initialTasks = null;
        }
        if (awaitTasks === void 0) {
          awaitTasks = false;
        }
        this.awaitTasks = awaitTasks;
        this.call = bake_collection_1.BAKED_EMPTY_FUNC;
        this.argsNum = argsNum;
        this.firstEmitBuildStrategy = true;
        if (awaitTasks)
          this.rebuild = rebuild_await.bind(this);
        else
          this.rebuild = rebuild_noawait.bind(this);
        this.setAutoRebuild(autoRebuild);
        if (initialTasks) {
          if (typeof initialTasks === "function") {
            this._tasks = initialTasks;
            this.length = 1;
          } else {
            this._tasks = initialTasks;
            this.length = initialTasks.length;
          }
        } else {
          this._tasks = null;
          this.length = 0;
        }
        if (autoRebuild)
          this.rebuild();
      }
      return TaskCollection2;
    }()
  );
  taskCollection2.TaskCollection = TaskCollection;
  function fastClear() {
    this._tasks = null;
    this.length = 0;
    this.call = bake_collection_1.BAKED_EMPTY_FUNC;
  }
  function clear() {
    this._tasks = null;
    this.length = 0;
    this.call = bake_collection_1.BAKED_EMPTY_FUNC;
  }
  function growArgsNum(argsNum) {
    if (this.argsNum < argsNum) {
      this.argsNum = argsNum;
      if (this.firstEmitBuildStrategy)
        this.call = rebuild_on_first_call;
      else
        this.rebuild();
    }
  }
  function setAutoRebuild(newVal) {
    if (newVal) {
      this.push = push_rebuild.bind(this);
      this.insert = insert_rebuild.bind(this);
      this.removeLast = removeLast_rebuild.bind(this);
    } else {
      this.push = push_norebuild.bind(this);
      this.insert = insert_norebuild.bind(this);
      this.removeLast = removeLast_norebuild.bind(this);
    }
  }
  function tasksAsArray() {
    if (this.length === 0)
      return [];
    if (this.length === 1)
      return [this._tasks];
    return this._tasks;
  }
  function setTasks(tasks) {
    if (tasks.length === 0) {
      this.length = 0;
      this.call = bake_collection_1.BAKED_EMPTY_FUNC;
    } else if (tasks.length === 1) {
      this.length = 1;
      this.call = tasks[0];
      this._tasks = tasks[0];
    } else {
      this.length = tasks.length;
      this._tasks = tasks;
      if (this.firstEmitBuildStrategy)
        this.call = rebuild_on_first_call;
      else
        this.rebuild();
    }
  }
  TaskCollection.prototype.fastClear = fastClear;
  TaskCollection.prototype.clear = clear;
  TaskCollection.prototype.growArgsNum = growArgsNum;
  TaskCollection.prototype.setAutoRebuild = setAutoRebuild;
  TaskCollection.prototype.tasksAsArray = tasksAsArray;
  TaskCollection.prototype.setTasks = setTasks;
  return taskCollection2;
}
var hasRequiredTaskCollection;
var init_task_collection_esm2 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/task-collection/task-collection.esm.js"() {
    init_task_collection_esm();
    init_utils_esm();
    init_bake_collection_esm2();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/node_modules/tseep/lib/task-collection/index.esm.js
function requireTaskCollection2() {
  if (hasRequiredTaskCollection2) return taskCollection;
  hasRequiredTaskCollection2 = 1;
  (function(exports2) {
    var __createBinding = taskCollection && taskCollection.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = taskCollection && taskCollection.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(requireTaskCollection(), exports2);
  })(taskCollection);
  return taskCollection;
}
var hasRequiredTaskCollection2;
var init_index_esm6 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/task-collection/index.esm.js"() {
    init_index_esm32();
    init_task_collection_esm2();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/utils.esm.js
var utils2;
var init_utils_esm3 = __esm({
  "../../../dist/browser/_virtual/utils.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    utils2 = {};
  }
});

// ../../../dist/browser/node_modules/tseep/lib/utils.esm.js
function requireUtils2() {
  if (hasRequiredUtils2) return utils2;
  hasRequiredUtils2 = 1;
  Object.defineProperty(utils2, "__esModule", { value: true });
  utils2.nullObj = void 0;
  function nullObj() {
    var x = {};
    x.__proto__ = null;
    return x;
  }
  utils2.nullObj = nullObj;
  return utils2;
}
var hasRequiredUtils2;
var init_utils_esm4 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/utils.esm.js"() {
    init_utils_esm3();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/node_modules/tseep/lib/ee.esm.js
function requireEe() {
  if (hasRequiredEe) return ee;
  hasRequiredEe = 1;
  var __spreadArray2 = ee && ee.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  Object.defineProperty(ee, "__esModule", { value: true });
  ee.EventEmitter = void 0;
  var task_collection_1 = requireTaskCollection2();
  var utils_1 = requireUtils();
  var utils_2 = requireUtils2();
  function emit(event, a, b, c, d, e) {
    var ev = this.events[event];
    if (ev) {
      if (ev.length === 0)
        return false;
      if (ev.argsNum < 6) {
        ev.call(a, b, c, d, e);
      } else {
        var arr = new Array(ev.argsNum);
        for (var i = 0, len = arr.length; i < len; ++i) {
          arr[i] = arguments[i + 1];
        }
        ev.call.apply(void 0, arr);
      }
      return true;
    }
    return false;
  }
  function emitHasOnce(event, a, b, c, d, e) {
    var ev = this.events[event];
    var argsArr;
    if (ev !== void 0) {
      if (ev.length === 0)
        return false;
      if (ev.argsNum < 6) {
        ev.call(a, b, c, d, e);
      } else {
        argsArr = new Array(ev.argsNum);
        for (var i = 0, len = argsArr.length; i < len; ++i) {
          argsArr[i] = arguments[i + 1];
        }
        ev.call.apply(void 0, argsArr);
      }
    }
    var oev = this.onceEvents[event];
    if (oev) {
      if (typeof oev === "function") {
        this.onceEvents[event] = void 0;
        if (arguments.length < 6) {
          oev(a, b, c, d, e);
        } else {
          if (argsArr === void 0) {
            argsArr = new Array(arguments.length - 1);
            for (var i = 0, len = argsArr.length; i < len; ++i) {
              argsArr[i] = arguments[i + 1];
            }
          }
          oev.apply(void 0, argsArr);
        }
      } else {
        var fncs = oev;
        this.onceEvents[event] = void 0;
        if (arguments.length < 6) {
          for (var i = 0; i < fncs.length; ++i) {
            fncs[i](a, b, c, d, e);
          }
        } else {
          if (argsArr === void 0) {
            argsArr = new Array(arguments.length - 1);
            for (var i = 0, len = argsArr.length; i < len; ++i) {
              argsArr[i] = arguments[i + 1];
            }
          }
          for (var i = 0; i < fncs.length; ++i) {
            fncs[i].apply(void 0, argsArr);
          }
        }
      }
      return true;
    }
    return ev !== void 0;
  }
  var EventEmitter2 = (
    /** @class */
    function() {
      function EventEmitter3() {
        this.events = (0, utils_2.nullObj)();
        this.onceEvents = (0, utils_2.nullObj)();
        this._symbolKeys = /* @__PURE__ */ new Set();
        this.maxListeners = Infinity;
      }
      Object.defineProperty(EventEmitter3.prototype, "_eventsCount", {
        get: function() {
          return this.eventNames().length;
        },
        enumerable: false,
        configurable: true
      });
      return EventEmitter3;
    }()
  );
  ee.EventEmitter = EventEmitter2;
  function once(event, listener) {
    if (this.emit === emit) {
      this.emit = emitHasOnce;
    }
    switch (typeof this.onceEvents[event]) {
      case "undefined":
        this.onceEvents[event] = listener;
        if (typeof event === "symbol")
          this._symbolKeys.add(event);
        break;
      case "function":
        this.onceEvents[event] = [this.onceEvents[event], listener];
        break;
      case "object":
        this.onceEvents[event].push(listener);
    }
    return this;
  }
  function addListener(event, listener, argsNum) {
    if (argsNum === void 0) {
      argsNum = listener.length;
    }
    if (typeof listener !== "function")
      throw new TypeError("The listener must be a function");
    var evtmap = this.events[event];
    if (!evtmap) {
      this.events[event] = new task_collection_1.TaskCollection(argsNum, true, listener, false);
      if (typeof event === "symbol")
        this._symbolKeys.add(event);
    } else {
      evtmap.push(listener);
      evtmap.growArgsNum(argsNum);
      if (this.maxListeners !== Infinity && this.maxListeners <= evtmap.length)
        console.warn('Maximum event listeners for "'.concat(String(event), '" event!'));
    }
    return this;
  }
  function removeListener(event, listener) {
    var evt = this.events[event];
    if (evt) {
      evt.removeLast(listener);
    }
    var evto = this.onceEvents[event];
    if (evto) {
      if (typeof evto === "function") {
        this.onceEvents[event] = void 0;
      } else if (typeof evto === "object") {
        if (evto.length === 1 && evto[0] === listener) {
          this.onceEvents[event] = void 0;
        } else {
          (0, utils_1._fast_remove_single)(evto, evto.lastIndexOf(listener));
        }
      }
    }
    return this;
  }
  function addListenerBound(event, listener, bindTo, argsNum) {
    if (bindTo === void 0) {
      bindTo = this;
    }
    if (argsNum === void 0) {
      argsNum = listener.length;
    }
    if (!this.boundFuncs)
      this.boundFuncs = /* @__PURE__ */ new Map();
    var bound = listener.bind(bindTo);
    this.boundFuncs.set(listener, bound);
    return this.addListener(event, bound, argsNum);
  }
  function removeListenerBound(event, listener) {
    var _a2, _b;
    var bound = (_a2 = this.boundFuncs) === null || _a2 === void 0 ? void 0 : _a2.get(listener);
    (_b = this.boundFuncs) === null || _b === void 0 ? void 0 : _b.delete(listener);
    return this.removeListener(event, bound);
  }
  function hasListeners(event) {
    return this.events[event] && !!this.events[event].length;
  }
  function prependListener(event, listener, argsNum) {
    if (argsNum === void 0) {
      argsNum = listener.length;
    }
    if (typeof listener !== "function")
      throw new TypeError("The listener must be a function");
    var evtmap = this.events[event];
    if (!evtmap || !(evtmap instanceof task_collection_1.TaskCollection)) {
      evtmap = this.events[event] = new task_collection_1.TaskCollection(argsNum, true, listener, false);
      if (typeof event === "symbol")
        this._symbolKeys.add(event);
    } else {
      evtmap.insert(0, listener);
      evtmap.growArgsNum(argsNum);
      if (this.maxListeners !== Infinity && this.maxListeners <= evtmap.length)
        console.warn('Maximum event listeners for "'.concat(String(event), '" event!'));
    }
    return this;
  }
  function prependOnceListener(event, listener) {
    if (this.emit === emit) {
      this.emit = emitHasOnce;
    }
    var evtmap = this.onceEvents[event];
    if (!evtmap) {
      this.onceEvents[event] = [listener];
      if (typeof event === "symbol")
        this._symbolKeys.add(event);
    } else if (typeof evtmap !== "object") {
      this.onceEvents[event] = [listener, evtmap];
      if (typeof event === "symbol")
        this._symbolKeys.add(event);
    } else {
      evtmap.unshift(listener);
      if (this.maxListeners !== Infinity && this.maxListeners <= evtmap.length) {
        console.warn('Maximum event listeners for "'.concat(String(event), '" once event!'));
      }
    }
    return this;
  }
  function removeAllListeners(event) {
    if (event === void 0) {
      this.events = (0, utils_2.nullObj)();
      this.onceEvents = (0, utils_2.nullObj)();
      this._symbolKeys = /* @__PURE__ */ new Set();
    } else {
      this.events[event] = void 0;
      this.onceEvents[event] = void 0;
      if (typeof event === "symbol")
        this._symbolKeys.delete(event);
    }
    return this;
  }
  function setMaxListeners(n) {
    this.maxListeners = n;
    return this;
  }
  function getMaxListeners() {
    return this.maxListeners;
  }
  function listeners(event) {
    if (this.emit === emit)
      return this.events[event] ? this.events[event].tasksAsArray().slice() : [];
    else {
      if (this.events[event] && this.onceEvents[event]) {
        return __spreadArray2(__spreadArray2([], this.events[event].tasksAsArray(), true), typeof this.onceEvents[event] === "function" ? [this.onceEvents[event]] : this.onceEvents[event], true);
      } else if (this.events[event])
        return this.events[event].tasksAsArray();
      else if (this.onceEvents[event])
        return typeof this.onceEvents[event] === "function" ? [this.onceEvents[event]] : this.onceEvents[event];
      else
        return [];
    }
  }
  function eventNames() {
    var _this = this;
    if (this.emit === emit) {
      var keys = Object.keys(this.events);
      return __spreadArray2(__spreadArray2([], keys, true), Array.from(this._symbolKeys), true).filter(function(x) {
        return x in _this.events && _this.events[x] && _this.events[x].length;
      });
    } else {
      var keys = Object.keys(this.events).filter(function(x) {
        return _this.events[x] && _this.events[x].length;
      });
      var keysO = Object.keys(this.onceEvents).filter(function(x) {
        return _this.onceEvents[x] && _this.onceEvents[x].length;
      });
      return __spreadArray2(__spreadArray2(__spreadArray2([], keys, true), keysO, true), Array.from(this._symbolKeys).filter(function(x) {
        return x in _this.events && _this.events[x] && _this.events[x].length || x in _this.onceEvents && _this.onceEvents[x] && _this.onceEvents[x].length;
      }), true);
    }
  }
  function listenerCount(type) {
    if (this.emit === emit)
      return this.events[type] && this.events[type].length || 0;
    else
      return (this.events[type] && this.events[type].length || 0) + (this.onceEvents[type] && this.onceEvents[type].length || 0);
  }
  EventEmitter2.prototype.emit = emit;
  EventEmitter2.prototype.on = addListener;
  EventEmitter2.prototype.once = once;
  EventEmitter2.prototype.addListener = addListener;
  EventEmitter2.prototype.removeListener = removeListener;
  EventEmitter2.prototype.addListenerBound = addListenerBound;
  EventEmitter2.prototype.removeListenerBound = removeListenerBound;
  EventEmitter2.prototype.hasListeners = hasListeners;
  EventEmitter2.prototype.prependListener = prependListener;
  EventEmitter2.prototype.prependOnceListener = prependOnceListener;
  EventEmitter2.prototype.off = removeListener;
  EventEmitter2.prototype.removeAllListeners = removeAllListeners;
  EventEmitter2.prototype.setMaxListeners = setMaxListeners;
  EventEmitter2.prototype.getMaxListeners = getMaxListeners;
  EventEmitter2.prototype.listeners = listeners;
  EventEmitter2.prototype.eventNames = eventNames;
  EventEmitter2.prototype.listenerCount = listenerCount;
  return ee;
}
var hasRequiredEe;
var init_ee_esm2 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/ee.esm.js"() {
    init_ee_esm();
    init_index_esm6();
    init_utils_esm();
    init_utils_esm4();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/node_modules/tseep/lib/index.esm.js
function requireLib() {
  if (hasRequiredLib) return lib;
  hasRequiredLib = 1;
  (function(exports2) {
    var __createBinding = lib && lib.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = lib && lib.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(requireTypes(), exports2);
    __exportStar(requireEe(), exports2);
  })(lib);
  return lib;
}
var hasRequiredLib;
var init_index_esm7 = __esm({
  "../../../dist/browser/node_modules/tseep/lib/index.esm.js"() {
    init_index_esm22();
    init_types_esm2();
    init_ee_esm2();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
  }
});

// ../../../dist/browser/_virtual/index.esm.js
var libExports;
var init_index_esm8 = __esm({
  "../../../dist/browser/_virtual/index.esm.js"() {
    "use strict";
    init_index_esm7();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    libExports = requireLib();
  }
});

// ../../../dist/browser/managers/StateManager.esm.js
var StateManager;
var init_StateManager_esm = __esm({
  "../../../dist/browser/managers/StateManager.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_LocalStorageWrapper_esm();
    init_index_esm8();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    StateManager = /** @class */
    function() {
      function StateManager2() {
      }
      Object.defineProperty(StateManager2, "abortController", {
        // Getter for the AbortController
        get: function() {
          return this._abortController;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(StateManager2, "abortSignal", {
        // Getter for the AbortSignal
        get: function() {
          return this._abortController.signal;
        },
        enumerable: false,
        configurable: true
      });
      StateManager2.abort = function() {
        this.incrementStat("ac:abort");
        if (!this.abortSignal.aborted) {
          this._abortController.abort();
          this._emitter.emit("abort");
        }
      };
      StateManager2.aborted = function() {
        return this.abortSignal.aborted;
      };
      StateManager2.resetAbort = function() {
        this.incrementStat("ac:reset-abort");
        this._abortController = new AbortController();
        this._emitter.emit("reset-abort");
      };
      Object.defineProperty(StateManager2, "localStorage", {
        // Getter for LocalStorageWrapper
        get: function() {
          return this._localStorage;
        },
        enumerable: false,
        configurable: true
      });
      StateManager2.set = function(key, value) {
        this.incrementStat("ls:set");
        this.localStorage.setItem(key, value);
      };
      StateManager2.get = function(key) {
        this.incrementStat("ls:get");
        return this.localStorage.getItem(key);
      };
      StateManager2.remove = function(key) {
        this.incrementStat("ls:remove");
        this.localStorage.removeItem(key);
      };
      StateManager2.clear = function() {
        this.incrementStat("ls:clear");
        this.localStorage.clear();
      };
      StateManager2.size = function() {
        this.incrementStat("ls:size");
        return this.localStorage.length();
      };
      StateManager2.key = function(index) {
        this.incrementStat("ls:key");
        return this.localStorage.key(index);
      };
      Object.defineProperty(StateManager2, "emitter", {
        // Getter for EventEmitter
        get: function() {
          return this._emitter;
        },
        enumerable: false,
        configurable: true
      });
      StateManager2.emit = function(event) {
        var _a2;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
          args[_i - 1] = arguments[_i];
        }
        console.log("emitting event: ".concat(event));
        this.incrementStat("emitter:emit");
        (_a2 = this._emitter).emit.apply(_a2, __spreadArray([event], args, false));
      };
      StateManager2.on = function(event, listener) {
        this.incrementStat("emitter:on");
        this._emitter.on(event, listener);
      };
      StateManager2.once = function(event, listener) {
        this.incrementStat("emitter:once");
        this._emitter.once(event, listener);
      };
      StateManager2.off = function(event, listener) {
        this.incrementStat("emitter:off");
        if (listener) {
          this._emitter.off(event, listener);
        } else {
          this._emitter.removeAllListeners(event);
        }
      };
      StateManager2.clearListeners = function(event) {
        this.incrementStat("emitter:clear");
        this._emitter.removeAllListeners(event);
      };
      Object.defineProperty(StateManager2, "stats", {
        //internal
        get: function() {
          return this._stats;
        },
        enumerable: false,
        configurable: true
      });
      StateManager2.enableStats = function() {
        this._enableStats = true;
      };
      StateManager2.disableStats = function() {
        this._enableStats = false;
      };
      StateManager2.incrementStat = function(key) {
        if (this._enableStats) {
          var value = this.getStat(key);
          this.setStat(key, value + 1);
        }
      };
      StateManager2.decrementStat = function(key) {
        if (this._enableStats) {
          var value = this.getStat(key);
          this.setStat(key, value - 1);
        }
      };
      StateManager2.clearStats = function() {
        this._stats.clear();
      };
      StateManager2.setStat = function(key, value) {
        if (this._enableStats)
          this._stats.set(key, value);
      };
      StateManager2.getStat = function(key) {
        if (!this._enableStats)
          return 0;
        return this._stats.get(key) || 0;
      };
      StateManager2._abortController = new AbortController();
      StateManager2._emitter = new libExports.EventEmitter();
      StateManager2._localStorage = new LocalStorageWrapper("state");
      StateManager2._enableStats = true;
      StateManager2._stats = /* @__PURE__ */ new Map();
      StateManager2._user = {};
      return StateManager2;
    }();
  }
});

// ../../../dist/browser/core/WebsocketAdapter.esm.js
var defaultWebsocketAdapterOptions, defaultWebsocketRequestHeader, defaultWebsocketRequestBody, defaultWebsocketRequest, WebsocketAdapter;
var init_WebsocketAdapter_esm = __esm({
  "../../../dist/browser/core/WebsocketAdapter.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Adapter_esm();
    init_hash_esm();
    init_StateManager_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    defaultWebsocketAdapterOptions = {
      keepAlive: false,
      returnResults: false,
      cache: true,
      stream: true
    };
    defaultWebsocketRequestHeader = {
      adapter: "websocket",
      from: "worker",
      use: "fetch"
    };
    defaultWebsocketRequestBody = {
      filters: [],
      options: defaultWebsocketAdapterOptions,
      hash: "",
      relays: []
    };
    defaultWebsocketRequest = __assign(__assign({}, defaultWebsocketRequestHeader), { args: defaultWebsocketRequestBody });
    WebsocketAdapter = /** @class */
    function(_super) {
      __extends(WebsocketAdapter2, _super);
      function WebsocketAdapter2() {
        var _this = _super.call(this) || this;
        _this.slug = "WebsocketAdapter:unset";
        _this._subscriptions = /* @__PURE__ */ new Set();
        _this._hashData = {};
        StateManager.on("destroy", function() {
          var _a2;
          (_a2 = _this.worker) === null || _a2 === void 0 ? void 0 : _a2.terminate();
        });
        return _this;
      }
      Object.defineProperty(WebsocketAdapter2.prototype, "worker", {
        get: function() {
          var _a2;
          return (_a2 = this.workers) === null || _a2 === void 0 ? void 0 : _a2.websocketDedicated;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(WebsocketAdapter2.prototype, "sharedWorker", {
        get: function() {
          var _a2;
          return (_a2 = this.workers) === null || _a2 === void 0 ? void 0 : _a2.websocketShared;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(WebsocketAdapter2.prototype, "subscriptions", {
        get: function() {
          return this._subscriptions;
        },
        enumerable: false,
        configurable: true
      });
      WebsocketAdapter2.prototype.connect = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      WebsocketAdapter2.prototype.disconnect = function() {
      };
      WebsocketAdapter2.prototype.terminate = function() {
      };
      WebsocketAdapter2.prototype.abort = function() {
      };
      WebsocketAdapter2.prototype.unsubscribe = function(subId) {
      };
      WebsocketAdapter2.prototype.newWorker = function(channelPort) {
        throw new Error("Method not implemented.");
      };
      WebsocketAdapter2.prototype.bindWorkerHandlers = function() {
        var _a2;
        if (!((_a2 = this === null || this === void 0 ? void 0 : this.workers) === null || _a2 === void 0 ? void 0 : _a2.websocketDedicated))
          return console.warn("[WebsocketAdapter] Error binding worker handlers: no worker found");
        this.workers.websocketDedicated.onmessage = this._onMessage.bind(this);
        this.workers.websocketDedicated.onerror = this._onError.bind(this);
      };
      WebsocketAdapter2.prototype.onMessage = function(response) {
        console.log("[WebsocketAdapter:".concat(this.constructor.name, "] i/i RECEIVE: ").concat(response.type, " <- websocketWorker"), response);
        var hash = response.hash;
        StateManager.emit(hash, response);
      };
      WebsocketAdapter2.prototype.subscribe = function() {
        return __awaiter(this, arguments, void 0, function(args, callbacks) {
          var hash;
          if (args === void 0) {
            args = defaultWebsocketRequestBody;
          }
          return __generator(this, function(_a2) {
            if (callbacks && Object.keys(callbacks).length > 0) {
              args.options.stream = true;
            }
            hash = this.request({
              use: "subscribe",
              args
            });
            return [2, this.response(hash, callbacks)];
          });
        });
      };
      WebsocketAdapter2.prototype.fetch = function() {
        return __awaiter(this, arguments, void 0, function(args, callbacks) {
          var hash, result;
          if (args === void 0) {
            args = defaultWebsocketRequestBody;
          }
          return __generator(this, function(_a2) {
            if (callbacks && Object.keys(callbacks).length > 0) {
              args.options.stream = true;
            }
            hash = this.request({
              use: "fetch",
              args
            });
            result = this.response(hash, callbacks);
            return [2, result];
          });
        });
      };
      WebsocketAdapter2.prototype.setHashData = function(hash, key, value) {
        if (!this._hashData[hash])
          this._hashData[hash] = {};
        this._hashData[hash][key] = value;
      };
      WebsocketAdapter2.prototype.request = function(message) {
        var _a2, _b;
        if (message === void 0) {
          message = defaultWebsocketRequest;
        }
        if (!(message === null || message === void 0 ? void 0 : message.args))
          throw new Error("No args found in message");
        var hash = deterministicHash((_b = (_a2 = message === null || message === void 0 ? void 0 : message.args) === null || _a2 === void 0 ? void 0 : _a2.filters) !== null && _b !== void 0 ? _b : {});
        message.args.hash = hash;
        if (!(this === null || this === void 0 ? void 0 : this.worker)) {
          console.warn("[WebsocketAdapter] Error sending command: no worker found");
          return hash;
        }
        this.subscriptions.add(hash);
        this.worker.postMessage(message);
        return hash;
      };
      WebsocketAdapter2.prototype.response = function(hash, callbacks) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, new Promise(function(resolve) {
              var results = [];
              var responseHandler = function(message) {
                var result = message.result, type = message.type;
                if (type === "events") {
                  if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevents) {
                    callbacks.onevents(result);
                    return;
                  }
                  for (var _i = 0, result_1 = result; _i < result_1.length; _i++) {
                    var event_1 = result_1[_i];
                    if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevent) {
                      callbacks.onevent(event_1);
                    } else {
                      results.push.apply(results, event_1);
                    }
                  }
                } else if (type === "event") {
                  if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevent) {
                    callbacks.onevent(result);
                  } else {
                    results.push(result);
                  }
                } else if (type == "complete") {
                  if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevent) {
                    resolve(true);
                  } else {
                    resolve(results);
                  }
                } else {
                  console.warn("[WebsocketAdapter] Unknown response type: ".concat(type));
                }
              };
              StateManager.on(hash, responseHandler);
            })];
          });
        });
      };
      WebsocketAdapter2.prototype.bootstrap = function(filters, relays, callbacks) {
        filters[0].kinds;
        var hash = this.request({
          use: "fetch",
          args: {
            options: {
              cache: true,
              returnResults: true,
              keepAlive: true,
              stream: true
            },
            filters,
            relays
          }
        });
        return this.response(hash, callbacks);
      };
      WebsocketAdapter2.prototype.ping = function() {
        var _a2, _b;
        (_b = (_a2 = this.workers) === null || _a2 === void 0 ? void 0 : _a2.websocketDedicated) === null || _b === void 0 ? void 0 : _b.postMessage({ type: "ping" });
      };
      WebsocketAdapter2.type = "WebsocketAdapter";
      return WebsocketAdapter2;
    }(Adapter);
  }
});

// ../../../dist/browser/core/Batcher.esm.js
var Batcher;
var init_Batcher_esm = __esm({
  "../../../dist/browser/core/Batcher.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    Batcher = /** @class */
    function() {
      function Batcher2(options) {
        this.options = options;
        this.batches = /* @__PURE__ */ new Map();
        this.timeoutIds = /* @__PURE__ */ new Map();
      }
      Batcher2.prototype.add = function(item, id, state) {
        if (!this.batches.has(id)) {
          this.batches.set(id, { items: [], state, lastBatchTime: Date.now() });
        }
        var batch = this.batches.get(id);
        if (state !== void 0) {
          batch.state = state;
        }
        batch.items.push(item);
        if (batch.items.length >= this.options.maxLength) {
          this.executeBatch(id);
        }
        if (!this.timeoutIds.has(id)) {
          this.startTimeout(id);
        }
      };
      Batcher2.prototype.executeBatch = function(id) {
        var batch = this.batches.get(id);
        if (!batch || batch.items.length === 0)
          return;
        this.options.callback(batch.items, batch.state, id);
        batch.items = [];
        batch.lastBatchTime = Date.now();
        if (this.timeoutIds.has(id)) {
          clearTimeout(this.timeoutIds.get(id));
          this.timeoutIds.delete(id);
        }
      };
      Batcher2.prototype.startTimeout = function(id) {
        var _this = this;
        var batch = this.batches.get(id);
        if (!batch)
          return;
        var timeoutId = setTimeout(function() {
          var now = Date.now();
          if (now - batch.lastBatchTime >= _this.options.timeout) {
            _this.executeBatch(id);
          }
        }, this.options.timeout);
        this.timeoutIds.set(id, timeoutId);
      };
      Batcher2.prototype.hasState = function(id) {
        var batch = this.batches.get(id);
        return (batch === null || batch === void 0 ? void 0 : batch.state) !== void 0;
      };
      return Batcher2;
    }();
  }
});

// ../../../dist/browser/core/AdapterWebsocketWorker.esm.js
var ResponseType, defaultWebsocketResponseHeaders, defaultWebsocketResponseBody, defaultWebsocketResponse, AdapterWebsocketWorker;
var init_AdapterWebsocketWorker_esm = __esm({
  "../../../dist/browser/core/AdapterWebsocketWorker.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_AdapterWorker_esm();
    init_WebsocketAdapter_esm();
    init_Batcher_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    (function(ResponseType2) {
      ResponseType2["event"] = "event";
      ResponseType2["events"] = "events";
      ResponseType2["complete"] = "complete";
    })(ResponseType || (ResponseType = {}));
    defaultWebsocketResponseHeaders = {
      to: "cache"
    };
    defaultWebsocketResponseBody = {
      type: "event",
      result: null,
      hash: ""
    };
    defaultWebsocketResponse = __assign(__assign({}, defaultWebsocketResponseHeaders), { args: defaultWebsocketResponseBody });
    AdapterWebsocketWorker = /** @class */
    function(_super) {
      __extends(AdapterWebsocketWorker2, _super);
      function AdapterWebsocketWorker2(options) {
        var _this = this;
        console.log("AdapterWebsocketWorker", options);
        _this = _super.call(this, options) || this;
        _this.relays = ["wss://relaypag.es/", "wss://relay.nostr.watch/"];
        _this.batchQueue = [];
        _this.batcher = new Batcher({
          maxLength: 100,
          timeout: 1e4,
          callback: _this.batchResponse.bind(_this)
        });
        return _this;
      }
      AdapterWebsocketWorker2.prototype._setup = function(command) {
        return __awaiter(this, void 0, void 0, function() {
          var options, connectToRelays;
          return __generator(this, function(_a2) {
            options = command.options;
            if (options) {
              connectToRelays = options.connectToRelays;
            }
            if (connectToRelays) {
              this.relays = connectToRelays;
            }
            if (!this.relays.length) {
              console.warn("AdapterWebsocketWorker: cannot connect to relays, length is 0");
            }
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWebsocketWorker2.prototype.onMainThreadMessage = function(request) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            this.onMessage(request);
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWebsocketWorker2.prototype.onChannelMessage = function(request) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            this.onMessage(request);
            return [
              2
              /*return*/
            ];
          });
        });
      };
      AdapterWebsocketWorker2.prototype.onMessage = function(request) {
        if (request === void 0) {
          request = defaultWebsocketRequest;
        }
        console.log("AdapterWebsocketWorker: onMessage", request);
        var use = request.use, args = request.args;
        if (use === "subscribe") {
          console.log("AdapterWebsocketWorker: onMessage: subscribe");
          return this.subscribe(args);
        }
        if (use === "fetch") {
          console.log("AdapterWebsocketWorker: onMessage: fetch");
          return this.fetch(args);
        }
        console.warn("AdapterWebsocketWorker: onMessage: did not match any command");
      };
      AdapterWebsocketWorker2.prototype.send = function(response) {
        if (response === void 0) {
          response = defaultWebsocketResponse;
        }
        var to = response.to, args = response.args;
        var sent = 0;
        if (to === "adapter") {
          if (!(this === null || this === void 0 ? void 0 : this.mainThread))
            return console.warn("AdapterWebsocketWorker: mainThread not found");
          this.mainThread.postMessage(args);
          sent++;
        }
        if (to === "cache") {
          if (!this.channel)
            return console.warn("AdapterWebsocketWorker: channel not found");
          this.channel.postMessage(args);
          sent++;
        }
        if (!sent)
          console.warn("AdapterWebsocketWorker: send: did not send to any destination");
      };
      AdapterWebsocketWorker2.prototype.subscribe = function() {
        return __awaiter(this, arguments, void 0, function(request) {
          var options, stream, callbacks, result;
          if (request === void 0) {
            request = defaultWebsocketRequestBody;
          }
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                console.log("AdapterWebsocketWorker: subscribe", request);
                request.hash, options = request.options;
                stream = (options !== null && options !== void 0 ? options : defaultWebsocketAdapterOptions).stream;
                if (stream) {
                  callbacks = this.requestCallbacks(request);
                }
                return [4, this._subscribe(request, callbacks)];
              case 1:
                result = _a2.sent();
                if (!stream) {
                  console.log("AdapterWebsocketWorker: subscribe: preparing async response");
                  console.log("AdapterWebsocketWorker: response", request, result);
                  this.requestAsyncReponse(request, result);
                }
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      AdapterWebsocketWorker2.prototype._subscribe = function() {
        return __awaiter(this, arguments, void 0, function(request, callbacks) {
          return __generator(this, function(_a2) {
            throw new Error("".concat(this.constructor.name, ":_subscribe() not implemented!"));
          });
        });
      };
      AdapterWebsocketWorker2.prototype.fetch = function() {
        return __awaiter(this, arguments, void 0, function(request) {
          var options, stream, callbacks, result;
          if (request === void 0) {
            request = defaultWebsocketRequestBody;
          }
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                console.log("AdapterWebsocketWorker: fetch", request);
                request.hash, options = request.options;
                stream = (options !== null && options !== void 0 ? options : defaultWebsocketAdapterOptions).stream;
                if (stream) {
                  callbacks = this.requestCallbacks(request);
                }
                console.log("AdapterWebsocketWorker: fetch: calling this._fetch");
                return [4, this._fetch(request, callbacks)];
              case 1:
                result = _a2.sent();
                console.log("AdapterWebsocketWorker: fetch: result", result);
                if (!stream) {
                  console.log("AdapterWebsocketWorker: fetch: preparing async response");
                  this.requestAsyncReponse(request, result);
                }
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      AdapterWebsocketWorker2.prototype._fetch = function() {
        return __awaiter(this, arguments, void 0, function(request, callbacks) {
          return __generator(this, function(_a2) {
            throw new Error("".concat(this.constructor.name, ":_fetch() not implemented!"));
          });
        });
      };
      AdapterWebsocketWorker2.prototype.respond = function(type, request, result) {
        var hash = request.hash, options = request.options;
        var cache = options.cache, returnResults = options.returnResults;
        var response = {
          type,
          result,
          hash
        };
        if (cache) {
          this.send({ to: "cache", args: response });
        }
        if (returnResults) {
          this.send({ to: "adapter", args: response });
        }
      };
      AdapterWebsocketWorker2.prototype.batchResponse = function(events, state, id) {
        console.log("AdapterWebsocketWorker: batchResponse: ".concat(id), events.length);
        if (!state)
          throw new Error("AdapterWebsocketWorker: batchResponse: state is undefined");
        this.respond(ResponseType.events, state, events);
      };
      AdapterWebsocketWorker2.prototype.requestCallbacks = function(request) {
        var _this = this;
        if (request === void 0) {
          request = defaultWebsocketRequestBody;
        }
        var options = request.options, hash = request.hash;
        var batch = options.batch;
        var onevent = function(event) {
          if (typeof batch === "number") {
            var state = !_this.batcher.hasState(hash) ? request : void 0;
            _this.batcher.add(event, hash, state);
          } else {
            _this.respond(ResponseType.event, request, event);
          }
        };
        var oneose = function() {
          _this.respond(ResponseType.complete, request);
        };
        return { onevent, oneose };
      };
      AdapterWebsocketWorker2.prototype.requestAsyncReponse = function(request, result) {
        var hash = request.hash, options = request.options;
        var cache = options.cache, returnResults = options.returnResults;
        console.log("AdapterWebsocketWorker: requestAsyncReponse cache: ".concat(cache, " returnResults: ").concat(returnResults));
        var args = {
          type: ResponseType.events,
          result,
          hash
        };
        if (cache === true) {
          this.send({ to: "cache", args });
        }
        if (returnResults === true) {
          this.send({ to: "adapter", args });
        }
        args = __assign(__assign({}, defaultWebsocketResponseBody), { result: result.length > 0, type: ResponseType.complete });
        if (cache === true) {
          this.send({ to: "cache", args });
        }
        if (returnResults === true) {
          this.send({ to: "adapter", args });
        }
      };
      AdapterWebsocketWorker2.prototype._getUniquePubkeys = function(events) {
        return Array.from(new Set(events.map(function(event) {
          return event.pubkey;
        })));
      };
      return AdapterWebsocketWorker2;
    }(AdapterWorker);
  }
});

// ../../../dist/browser/core/CacheAdapter.esm.js
var CacheAdapter;
var init_CacheAdapter_esm = __esm({
  "../../../dist/browser/core/CacheAdapter.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Adapter_esm();
    init_StateManager_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    CacheAdapter = /** @class */
    function(_super) {
      __extends(CacheAdapter2, _super);
      function CacheAdapter2() {
        var _this = _super.call(this) || this;
        _this.slug = "CacheAdapter:unset";
        StateManager.on("destroy", function() {
          var _a2;
          (_a2 = _this.dedicatedWorker) === null || _a2 === void 0 ? void 0 : _a2.terminate();
        });
        return _this;
      }
      Object.defineProperty(CacheAdapter2.prototype, "dedicatedWorker", {
        get: function() {
          var _a2;
          return (_a2 = this.workers) === null || _a2 === void 0 ? void 0 : _a2.cacheDedicated;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(CacheAdapter2.prototype, "sharedWorker", {
        get: function() {
          var _a2;
          return (_a2 = this.workers) === null || _a2 === void 0 ? void 0 : _a2.cacheShared;
        },
        enumerable: false,
        configurable: true
      });
      CacheAdapter2.prototype.bindWorkerHandlers = function() {
        var _a2;
        if (!((_a2 = this === null || this === void 0 ? void 0 : this.workers) === null || _a2 === void 0 ? void 0 : _a2.cacheDedicated))
          return console.warn("[CacheAdapter] Error binding worker handlers: no worker found");
        this.workers.cacheDedicated.onmessage = this._onMessage.bind(this);
        this.workers.cacheDedicated.onerror = this._onError.bind(this);
      };
      CacheAdapter2.prototype.ping = function() {
        var _a2, _b;
        (_b = (_a2 = this.workers) === null || _a2 === void 0 ? void 0 : _a2.cacheDedicated) === null || _b === void 0 ? void 0 : _b.postMessage({ type: "ping" });
      };
      CacheAdapter2.type = "CacheAdapter";
      return CacheAdapter2;
    }(Adapter);
  }
});

// ../../../dist/browser/core/Queue.esm.js
var DEFAULT_CONCURRENCY, Queue;
var init_Queue_esm = __esm({
  "../../../dist/browser/core/Queue.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_index_esm3();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    DEFAULT_CONCURRENCY = 1;
    Queue = /** @class */
    function() {
      function Queue2(taskWorker, concurrency) {
        if (concurrency === void 0) {
          concurrency = DEFAULT_CONCURRENCY;
        }
        var _this = this;
        this._taskWorker = taskWorker;
        this._queue = new PQueue({ concurrency });
        this.queue.on("active", function() {
          _this.saturated();
        });
        this.queue.on("idle", function() {
          _this.drain();
        });
        this.queue.on("empty", function() {
          _this.empty();
        });
      }
      Object.defineProperty(Queue2.prototype, "queue", {
        get: function() {
          return this._queue;
        },
        enumerable: false,
        configurable: true
      });
      Queue2.prototype.add = function(task, options) {
        return __awaiter(this, void 0, void 0, function() {
          var _this = this;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [4, this.queue.add(function() {
                  return _this._taskWorker(task);
                }, options)];
              case 1:
                _a2.sent();
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      Queue2.prototype.saturated = function() {
      };
      Queue2.prototype.drain = function() {
      };
      Queue2.prototype.empty = function() {
      };
      Object.defineProperty(Queue2.prototype, "size", {
        // Expose all PQueue methods to the wrapper
        get: function() {
          return this._queue.size;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Queue2.prototype, "pending", {
        get: function() {
          return this._queue.pending;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Queue2.prototype, "isPaused", {
        get: function() {
          return this._queue.isPaused;
        },
        enumerable: false,
        configurable: true
      });
      Queue2.prototype.pause = function() {
        this._queue.pause();
      };
      Queue2.prototype.start = function() {
        this._queue.start();
      };
      Queue2.prototype.clear = function() {
        this._queue.clear();
      };
      Queue2.prototype.on = function(event, listener) {
        this._queue.on(event, listener);
      };
      Queue2.prototype.onEmpty = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, this._queue.onEmpty()];
          });
        });
      };
      Queue2.prototype.onIdle = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, this._queue.onIdle()];
          });
        });
      };
      Queue2.prototype.waitUntilIdle = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [2, this._queue.onIdle()];
          });
        });
      };
      return Queue2;
    }();
  }
});

// ../../../dist/browser/utils/events.esm.js
var isPRE, isRE;
var init_events_esm = __esm({
  "../../../dist/browser/utils/events.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    isPRE = function(ev) {
      return ev.kind >= 3e4 && ev.kind < 4e4;
    };
    isRE = function(ev) {
      var legacyReplaceableKinds = [0, 3, 41];
      return ev.kind >= 1e4 && ev.kind < 2e4 || legacyReplaceableKinds.includes(ev.kind);
    };
  }
});

// ../../../dist/browser/services/Service.esm.js
var Service;
var init_Service_esm = __esm({
  "../../../dist/browser/services/Service.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Adapter_esm();
    init_AdapterCacheWorker_esm();
    init_AdapterWebsocketWorker_esm();
    init_AdapterWorker_esm();
    init_Base_esm();
    init_Batcher_esm();
    init_CacheAdapter_esm();
    init_Workers_esm();
    init_Queue_esm();
    init_WebsocketAdapter_esm();
    init_events_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    Service = /** @class */
    function() {
      function Service2(adapters) {
        this.cacheAdapter = adapters.cacheAdapter;
        this.websocketAdapter = adapters.websocketAdapter;
      }
      Service2.prototype.modifyCacheFilters = function(filters) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            console.warn("modifyCacheFilters not implemented");
            return [2, filters];
          });
        });
      };
      Service2.prototype.modifyWebsocketFilters = function(filters) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            console.warn("modifyWebsocketFilters not implemented");
            return [2, filters];
          });
        });
      };
      Service2.prototype._fetch = function(args, callbacks) {
        return __awaiter(this, void 0, void 0, function() {
          var filters, relays, options, events, generateId, maybeAddEventToMap, cacheEvents, _a2, _b, _i, cacheEvents_1, event_1, _callbacks, websocketEvents, _c, _d;
          var _e;
          return __generator(this, function(_f) {
            switch (_f.label) {
              case 0:
                filters = args.filters, relays = args.relays, options = args.options;
                events = /* @__PURE__ */ new Map();
                generateId = function(event) {
                  var _a3;
                  if (isPRE(event)) {
                    var dtagv = (_a3 = event.tags.find(function(t) {
                      return t[0] === "d";
                    })) === null || _a3 === void 0 ? void 0 : _a3[1];
                    return dtagv ? "".concat(event.pubkey, ":").concat(event.kind, ":").concat(dtagv) : void 0;
                  }
                  return isRE(event) ? "".concat(event.pubkey, ":").concat(event.kind) : event.id;
                };
                maybeAddEventToMap = function(event) {
                  var id = generateId(event);
                  if (!id || events.has(id))
                    return false;
                  events.set(id, event);
                  return true;
                };
                _b = (_a2 = this.cacheAdapter).REQ;
                return [4, this.modifyCacheFilters(filters)];
              case 1:
                return [4, _b.apply(_a2, [_f.sent()])];
              case 2:
                cacheEvents = _f.sent();
                if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevents)
                  callbacks.onevents(cacheEvents);
                if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevent) {
                  for (_i = 0, cacheEvents_1 = cacheEvents; _i < cacheEvents_1.length; _i++) {
                    event_1 = cacheEvents_1[_i];
                    callbacks.onevent(event_1);
                  }
                }
                cacheEvents.forEach(maybeAddEventToMap);
                _callbacks = {};
                if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevent) {
                  _callbacks.onevent = function(event) {
                    if (maybeAddEventToMap(event))
                      callbacks.onevent(event);
                  };
                }
                if (callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevents) {
                  _callbacks.onevents = function(batch) {
                    var newEvents = [];
                    for (var _i2 = 0, batch_1 = batch; _i2 < batch_1.length; _i2++) {
                      var event_2 = batch_1[_i2];
                      if (maybeAddEventToMap(event_2))
                        newEvents.push(event_2);
                    }
                    if (newEvents.length > 0)
                      callbacks.onevents(newEvents);
                  };
                }
                _d = (_c = this.websocketAdapter).fetch;
                _e = {
                  relays: relays || []
                };
                return [4, this.modifyWebsocketFilters(filters)];
              case 3:
                return [4, _d.apply(_c, [(_e.filters = _f.sent(), _e.options = options || defaultWebsocketAdapterOptions, _e), _callbacks])];
              case 4:
                websocketEvents = _f.sent();
                if (websocketEvents instanceof Array) {
                  websocketEvents.forEach(maybeAddEventToMap);
                }
                return [2, Array.from(events.values())];
            }
          });
        });
      };
      return Service2;
    }();
  }
});

// ../../../dist/browser/services/RelayService.esm.js
var RelayService_esm_exports = {};
__export(RelayService_esm_exports, {
  RelayService: () => RelayService
});
var RelayService;
var init_RelayService_esm = __esm({
  "../../../dist/browser/services/RelayService.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Service_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    RelayService = /** @class */
    function(_super) {
      __extends(RelayService2, _super);
      function RelayService2(adapters) {
        return _super.call(this, adapters) || this;
      }
      return RelayService2;
    }(Service);
  }
});

// ../../../dist/browser/core/Subscriber.esm.js
var Subscriber;
var init_Subscriber_esm = __esm({
  "../../../dist/browser/core/Subscriber.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_StateManager_esm();
    init_hash_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    Subscriber = /** @class */
    function() {
      function Subscriber2() {
        this._subscriptions = /* @__PURE__ */ new Set();
      }
      Object.defineProperty(Subscriber2.prototype, "subscriptions", {
        get: function() {
          return this._subscriptions;
        },
        enumerable: false,
        configurable: true
      });
      Subscriber2.prototype.request = function(subject) {
        var hash = deterministicHash(subject !== null && subject !== void 0 ? subject : {});
        this.subscriptions.add(hash);
        return hash;
      };
      Subscriber2.prototype.response = function(hash, handler) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [4, new Promise(function(resolve) {
                  StateManager.on(hash, function(message) {
                    handler(message, resolve);
                  });
                })];
              case 1:
                _a2.sent();
                this.subscriptions.delete(hash);
                return [2, true];
            }
          });
        });
      };
      return Subscriber2;
    }();
  }
});

// ../../../dist/browser/utils/SyncKeys.esm.js
var SyncKeys;
var init_SyncKeys_esm = __esm({
  "../../../dist/browser/utils/SyncKeys.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    SyncKeys = /** @class */
    function() {
      function SyncKeys2(pubkey) {
        this.pubkey = pubkey;
      }
      SyncKeys2.prototype.generateKey = function(key, kind, rangeKey) {
        return "".concat(this.pubkey, ":").concat(kind, ":").concat(key, ":").concat(rangeKey);
      };
      return SyncKeys2;
    }();
  }
});

// ../../../dist/browser/managers/SyncStateManager.esm.js
var SyncStateManager;
var init_SyncStateManager_esm = __esm({
  "../../../dist/browser/managers/SyncStateManager.esm.js"() {
    "use strict";
    init_LocalStorageWrapper_esm();
    init_SyncKeys_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    SyncStateManager = /** @class */
    function() {
      function SyncStateManager2(pubkey) {
        this.pubkey = pubkey;
        this.localStorage = new LocalStorageWrapper("monitor");
        this.keyHelper = new SyncKeys(pubkey);
      }
      Object.defineProperty(SyncStateManager2.prototype, "lastSyncSince", {
        set: function(rangeParameter) {
          this.setLastSync(rangeParameter.kind, "since", rangeParameter.value);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(SyncStateManager2.prototype, "lastSyncUntil", {
        set: function(rangeParameter) {
          this.setLastSync(rangeParameter.kind, "until", rangeParameter.value);
        },
        enumerable: false,
        configurable: true
      });
      SyncStateManager2.prototype.setLastSync = function(kind, rangeKey, value) {
        var key = this.keyHelper.generateKey("lastSync", kind, rangeKey);
        this.localStorage.setItem(key, value.toString());
      };
      SyncStateManager2.prototype.getLastSync = function(kind) {
        return {
          since: this.getLastSyncValue(kind, "since"),
          until: this.getLastSyncValue(kind, "until")
        };
      };
      SyncStateManager2.prototype.getLastSyncSince = function(kind) {
        return this.getLastSyncValue(kind, "since");
      };
      SyncStateManager2.prototype.getLastSyncUntil = function(kind) {
        return this.getLastSyncValue(kind, "until");
      };
      SyncStateManager2.prototype.getLastSyncValue = function(kind, rangeKey) {
        var key = this.keyHelper.generateKey("lastSync", kind, rangeKey);
        var returnedValue = this.localStorage.getItem(key);
        var value = parseInt(returnedValue || "0");
        console.log("getLastSyncValue: ".concat(key, " -> ").concat(returnedValue, " === ").concat(value));
        return value;
      };
      return SyncStateManager2;
    }();
  }
});

// ../../../dist/browser/models/_.esm.js
var modelDefaults;
var init_esm = __esm({
  "../../../dist/browser/models/_.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    modelDefaults = function() {
      var defaultObject = {};
      Object.keys(defaultObject).forEach(function(key) {
        defaultObject[key] = null;
      });
      return defaultObject;
    };
  }
});

// ../../../dist/browser/models/Event.esm.js
var NostEvent, transformCheck, Nip66Event, formatGeocodes;
var init_Event_esm = __esm({
  "../../../dist/browser/models/Event.esm.js"() {
    "use strict";
    init_tslib_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    NostEvent = /** @class */
    function() {
      function NostEvent2(event) {
        this._json = event;
      }
      Object.defineProperty(NostEvent2.prototype, "id", {
        get: function() {
          return this.json.id;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "pubkey", {
        get: function() {
          return this.json.pubkey;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "kind", {
        get: function() {
          return this.json.kind;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "tags", {
        get: function() {
          return this.json.tags;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "content", {
        get: function() {
          return this.json.content;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "signature", {
        get: function() {
          return this.json.signature;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "created_at", {
        get: function() {
          return this.json.created_at;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(NostEvent2.prototype, "json", {
        get: function() {
          return this._json;
        },
        enumerable: false,
        configurable: true
      });
      return NostEvent2;
    }();
    transformCheck = function(event) {
      var _a2, _b, _c, _d, _e, _f, _g, _h, _j, _k;
      var nid = event.id;
      var dTag = event.tags.find(function(tag) {
        return tag[0] === "d";
      });
      var relay = dTag ? new URL(dTag[1]).toString() : null;
      var monitorPubkey = event.pubkey;
      var created_at = event.created_at;
      var network = ((_a2 = event.tags.find(function(tag) {
        return tag[0] === "n";
      })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
      var rttOpen = parseInt((_b = event.tags.find(function(tag) {
        return tag[0] === "rtt-open";
      })) === null || _b === void 0 ? void 0 : _b[1]) || null;
      var rttWrite = parseInt((_c = event.tags.find(function(tag) {
        return tag[0] === "rtt-write";
      })) === null || _c === void 0 ? void 0 : _c[1]) || null;
      var rtt = rttOpen || rttWrite || null;
      var operatorPubkey = ((_d = event.tags.find(function(tag) {
        return tag[0] === "p";
      })) === null || _d === void 0 ? void 0 : _d[1]) || null;
      var supportedNips = event.tags.filter(function(tag) {
        return tag[0] === "N";
      }).map(function(tag) {
        return parseInt(tag[1]);
      }) || null;
      var software = ((_e = event.tags.find(function(tag) {
        return tag[0] === "s";
      })) === null || _e === void 0 ? void 0 : _e[1]) || null;
      var version = ((_f = event.tags.find(function(tag) {
        return tag[0] === "l" && tag[2] === "nip11.version";
      })) === null || _f === void 0 ? void 0 : _f[1]) || null;
      var paymentRequired = event.tags.some(function(tag) {
        return tag[0] === "R" && tag[1] === "payment";
      }) ? true : false;
      var authRequired = event.tags.some(function(tag) {
        return tag[0] === "R" && tag[1] === "auth";
      }) ? true : false;
      event.tags.some(function(tag) {
        return tag[0] === "R" && tag[1] === "auth";
      }) ? true : false;
      var geohash = event.tags.filter(function(tag) {
        return tag[0] === "g";
      }).map(function(tag) {
        return tag[1];
      }) || null;
      var geocode = ((_g = event.tags.find(function(tag) {
        return tag[0] === "l" && tag[2] === "countryCode" && tag[1].length === 2;
      })) === null || _g === void 0 ? void 0 : _g[1]) || null;
      var isp = ((_h = event.tags.find(function(tag) {
        return tag[0] === "l" && tag[2].includes("isp");
      })) === null || _h === void 0 ? void 0 : _h[1]) || null;
      var as = ((_j = event.tags.find(function(tag) {
        return tag[0] === "l" && tag[2] === "host.as";
      })) === null || _j === void 0 ? void 0 : _j[1]) || null;
      var asname = ((_k = event.tags.find(function(tag) {
        return tag[0] === "l" && tag[2] === "host.asn";
      })) === null || _k === void 0 ? void 0 : _k[1]) || null;
      var ipv4 = event.tags.filter(function(tag) {
        return tag[0] === "l" && tag[2].includes("ipv4");
      }).map(function(tag) {
        return tag[1];
      }) || null;
      return {
        nid,
        relay,
        monitorPubkey,
        created_at,
        network,
        rtt,
        operatorPubkey,
        supportedNips,
        software,
        version,
        paymentRequired,
        authRequired,
        geohash,
        geocode,
        isp,
        as,
        asname,
        ipv4,
        ipv6: null,
        sslValidTo: null,
        sslIssuer: null
      };
    };
    Nip66Event = /** @class */
    function(_super) {
      __extends(Nip66Event2, _super);
      function Nip66Event2() {
        return _super !== null && _super.apply(this, arguments) || this;
      }
      Object.defineProperty(Nip66Event2.prototype, "keys", {
        get: function() {
          return [
            "nid",
            "relay",
            "monitorPubkey",
            "created_at",
            "network",
            "rtt",
            "operatorPubkey",
            "supportedNips",
            "software",
            "version",
            "paymentRequired",
            "authRequired",
            "geohash",
            "geocode",
            "isp",
            "as",
            "asname",
            "ipv4",
            "ipv6",
            "sslValidTo",
            "sslIssuer"
          ];
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "relay", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "d";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "monitorPubkey", {
        get: function() {
          return this.pubkey;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "created_at", {
        get: function() {
          return this.json.created_at;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "network", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "n";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "rtt", {
        get: function() {
          var _a2;
          var rtt = (_a2 = this.tags.find(function(tag) {
            return tag[0] === "rtt-open";
          })) === null || _a2 === void 0 ? void 0 : _a2[1];
          return rtt ? parseInt(rtt) : null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "operatorPubkey", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "p";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "supportedNips", {
        get: function() {
          return this.tags.filter(function(tag) {
            return tag[0] === "N";
          }).map(function(tag) {
            return tag[1];
          }) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "software", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "s";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "version", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "l" && tag[2] === "nip11.version";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "paymentRequired", {
        get: function() {
          return this.tags.some(function(tag) {
            return tag[0] === "R" && tag[1] === "payment";
          }) ? true : false;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "authRequired", {
        get: function() {
          return this.tags.some(function(tag) {
            return tag[0] === "R" && tag[1] === "auth";
          }) ? true : false;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "powRequired", {
        get: function() {
          return this.tags.some(function(tag) {
            return tag[0] === "R" && tag[1] === "pow";
          }) ? true : false;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "geohash", {
        get: function() {
          return this.tags.filter(function(tag) {
            return tag[0] === "g";
          }).map(function(tag) {
            return tag[1];
          }) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "geocode", {
        get: function() {
          var _a2;
          return ((_a2 = this.geocodes.find(function(code) {
            return code.format === "alpha" && code.length === 2;
          })) === null || _a2 === void 0 ? void 0 : _a2.code) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "geocodeAlpha2", {
        get: function() {
          return this.geocode;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "geocodeAlpha3", {
        get: function() {
          var _a2;
          return ((_a2 = this.geocodes.find(function(code) {
            return code.format === "alpha" && code.length === 3;
          })) === null || _a2 === void 0 ? void 0 : _a2.code) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "geocodeNumeric", {
        get: function() {
          var _a2;
          return ((_a2 = this.geocodes.find(function(code) {
            return code.format === "numeric";
          })) === null || _a2 === void 0 ? void 0 : _a2.code) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "geocodes", {
        get: function() {
          var codes = this.tags.filter(function(tag) {
            return tag[0] === "l" && tag[2] === "countryCode";
          }).map(function(tag) {
            return tag[1];
          });
          if (!codes.length)
            return [];
          return formatGeocodes(codes);
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "isp", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "l" && tag[2].includes("isp");
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "as", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "l" && tag[2] === "host.as";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "asname", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "l" && tag[2] === "host.asn";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "ipv4", {
        get: function() {
          return this.tags.filter(function(tag) {
            return tag[0] === "l" && tag[2].includes("ipv4");
          }).map(function(tag) {
            return tag[1];
          }) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "ipv6", {
        get: function() {
          return this.tags.filter(function(tag) {
            return tag[0] === "l" && tag[2].includes("ipv6");
          }).map(function(tag) {
            return tag[1];
          }) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "sslValidTo", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "l" && tag[2] === "ssl.validTo";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "sslIssuer", {
        get: function() {
          var _a2;
          return ((_a2 = this.tags.find(function(tag) {
            return tag[0] === "l" && tag[2] === "ssl.issuer";
          })) === null || _a2 === void 0 ? void 0 : _a2[1]) || null;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Nip66Event2.prototype, "check", {
        get: function() {
          return transformCheck(this.json);
        },
        enumerable: false,
        configurable: true
      });
      return Nip66Event2;
    }(NostEvent);
    formatGeocodes = function(codes) {
      var results = [];
      for (var _i = 0, codes_1 = codes; _i < codes_1.length; _i++) {
        var code = codes_1[_i];
        var isNumber = !isNaN(Number(code)) && code !== "";
        results.push({
          code,
          type: "ISO-3166-1",
          format: isNumber ? "numeric" : "alpha",
          length: isNumber ? void 0 : code.length
        });
      }
      return results;
    };
  }
});

// ../../../dist/browser/utils/geo.esm.js
var extractGeoCodesByType, extractGeoCodes;
var init_geo_esm = __esm({
  "../../../dist/browser/utils/geo.esm.js"() {
    "use strict";
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    extractGeoCodesByType = function(event, type) {
      return event.tags.filter(function(tag) {
        return tag[0] === "l" && tag[2] === type;
      }).map(function(tag) {
        return tag[1];
      }).filter(function(tag) {
        return tag !== void 0;
      }) || [];
    };
    extractGeoCodes = function(event) {
      var countryCode = [];
      var regionCode = [];
      countryCode = extractGeoCodesByType(
        event,
        "countryCode"
        /* ISO3166Type.CountryCode */
      );
      regionCode = extractGeoCodesByType(
        event,
        "regionCode"
        /* ISO3166Type.RegionCode */
      );
      return { countryCode, regionCode };
    };
  }
});

// ../../../dist/browser/transform/TransformRelays.esm.js
var iGeocodeToArray, geocodeTransform, parseGeocodes, parseGeocode;
var init_TransformRelays_esm = __esm({
  "../../../dist/browser/transform/TransformRelays.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_esm();
    init_Event_esm();
    init_events_esm();
    init_geo_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    iGeocodeToArray = function(geocode_) {
      return geocode_.reduce(function(acc, geocode) {
        acc.push(geocode.code);
        return acc;
      }, []);
    };
    geocodeTransform = function(event) {
      var codes = extractGeoCodes(event);
      var cc = parseGeocodes(
        codes.countryCode,
        "countryCode"
        /* ISO3166Type.CountryCode */
      );
      var rc = parseGeocodes(
        codes.regionCode,
        "regionCode"
        /* ISO3166Type.RegionCode */
      );
      var res = [];
      if (cc)
        res.push.apply(res, cc);
      if (rc)
        res.push.apply(res, rc);
      return res;
    };
    parseGeocodes = function(codes, type) {
      var geocodeEntries = [];
      if (!codes)
        return;
      codes.forEach(function(code) {
        geocodeEntries.push(parseGeocode(type, code));
      });
      return geocodeEntries;
    };
    parseGeocode = function(type, code) {
      var isNumeric = !isNaN(Number(code));
      var ignoreLength = isNumeric || type === "regionCode" ? true : false;
      if (typeof code !== "string")
        code = String(code);
      return {
        code,
        type,
        format: isNumeric ? "numeric" : "alpha",
        length: ignoreLength ? -1 : String(code).length
      };
    };
  }
});

// ../../../dist/browser/utils/general.esm.js
var isGeohash;
var init_general_esm = __esm({
  "../../../dist/browser/utils/general.esm.js"() {
    "use strict";
    init_tslib_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    isGeohash = function(input) {
      var geohashRegex = /^[0-9a-z]{1,20}$/;
      return geohashRegex.test(input);
    };
  }
});

// ../../../dist/browser/transform/TransformMonitors.esm.js
var n66IEventToIMonitor, getFrequency, getGeohash, getChecks;
var init_TransformMonitors_esm = __esm({
  "../../../dist/browser/transform/TransformMonitors.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_esm();
    init_Event_esm();
    init_TransformRelays_esm();
    init_general_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    n66IEventToIMonitor = function(event) {
      var pubkey = event.pubkey, eventId = event.id;
      var frequency = getFrequency(event);
      var checks = getChecks(event);
      var geohash = getGeohash(event);
      var geocode = iGeocodeToArray(geocodeTransform(event));
      var monitor = {
        pubkey,
        eventId,
        checks,
        frequency,
        geohash,
        geocode
      };
      return __assign(__assign({}, modelDefaults()), monitor);
    };
    getFrequency = function(event) {
      var _a2;
      var f = -1;
      try {
        var f_ = (_a2 = event.tags.find(function(tag) {
          return tag[0] === "frequency";
        })) === null || _a2 === void 0 ? void 0 : _a2[1];
        if (f_)
          f = parseInt(f_);
      } catch (e) {
        console.warn("frequency did not validate for monitor: ".concat(event.pubkey));
      }
      return f;
    };
    getGeohash = function(event) {
      var geohashes = event.tags.filter(function(t) {
        return t[0] === "g" && isGeohash(t[1]);
      });
      return geohashes.reduce(function(longest, t) {
        t[0];
        var value = t[1];
        if (value.length > ((longest === null || longest === void 0 ? void 0 : longest.length) || 0)) {
          return value;
        }
        return longest;
      }, null);
    };
    getChecks = function(event) {
      var checks = event.tags.reduce(function(acc, t) {
        var key = t[0];
        var value = t[1];
        var isCheck = key === "c";
        if (isCheck)
          acc.push(value);
        return acc;
      }, []);
      return checks !== null && checks !== void 0 ? checks : null;
    };
  }
});

// ../../../dist/browser/models/Monitor.esm.js
var defaultMonitor, Monitor;
var init_Monitor_esm = __esm({
  "../../../dist/browser/models/Monitor.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_StateManager_esm();
    init_SyncStateManager_esm();
    init_TransformMonitors_esm();
    init_Event_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    defaultMonitor = {
      pubkey: "",
      eventId: "",
      lastActive: -1
    };
    Monitor = /** @class */
    function() {
      function Monitor2(event) {
        this.priority = -1;
        this._forgiveness = 1;
        if (event.kind !== 10166)
          throw new Error("Needs to be instantiated with a Monitor Registration event [kind: 10166");
        this.priority = 0;
        this.registration = {};
        this.profile = {};
        this.relays = [];
        this.addRegistration(event);
        this.state = new SyncStateManager(this.pubkey);
      }
      Object.defineProperty(Monitor2.prototype, "lastActive", {
        get: function() {
          return this.registration.lastActive || -1;
        },
        set: function(value) {
          this.registration.lastActive = value ? value : -1;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "lastSyncSince", {
        set: function(rangeParameter) {
          this.state.lastSyncSince = rangeParameter;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "lastSyncUntil", {
        set: function(rangeParameter) {
          this.state.lastSyncUntil = rangeParameter;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "pubkey", {
        get: function() {
          return this.registration.pubkey;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "eventId", {
        get: function() {
          return this.registration.eventId;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "frequency", {
        get: function() {
          var f = this.registration.frequency;
          return (f || 60 * 60 * 12) * 24;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "geohash", {
        get: function() {
          return this.registration.geohash || "";
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "geocode", {
        get: function() {
          return this.registration.geocode || [];
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(Monitor2.prototype, "checkFilter", {
        get: function() {
          var frequency = this === null || this === void 0 ? void 0 : this.frequency;
          console.log("ensureMonitorsActive: ".concat(this === null || this === void 0 ? void 0 : this.pubkey), frequency);
          var kinds = [30166];
          var since = Math.round(Date.now() / 1e3) - frequency;
          var authors = [this.pubkey];
          return { kinds, since, authors };
        },
        enumerable: false,
        configurable: true
      });
      Monitor2.prototype.getLastSyncSince = function(kind) {
        return this.state.getLastSyncSince(kind);
      };
      Monitor2.prototype.getLastSyncUntil = function(kind) {
        return this.state.getLastSyncUntil(kind);
      };
      Monitor2.prototype.getLastSync = function(kind) {
        return this.state.getLastSync(kind);
      };
      Monitor2.prototype.setLastSync = function(kind, rangeKey, value) {
        this.state.setLastSync(kind, rangeKey, value);
      };
      Monitor2.prototype.addRegistration = function(event) {
        this.registration = __assign(__assign({}, defaultMonitor), n66IEventToIMonitor(event));
        StateManager.emit("monitor:update:registration", { pubkey: this.pubkey, value: this.registration });
        StateManager.emit("monitor:update", this);
      };
      Monitor2.prototype.addProfile = function(event) {
        try {
          var profile = JSON.parse(event.content);
          this.profile = profile;
        } catch (e) {
          console.warn("Monitor addProfile error:", e);
        }
        StateManager.emit("monitor:update:profile", { pubkey: this.pubkey, value: this.profile });
        StateManager.emit("monitor:update", this);
      };
      Monitor2.prototype.addRelays = function(event) {
        try {
          var relays = event.tags.filter(function(t) {
            return t[0] === "r";
          }).map(function(t) {
            return new URL(t[1]).toString();
          });
          relays = relays !== null && relays !== void 0 ? relays : [];
          this.relays = relays;
          StateManager.emit("monitor:update:relays", { pubkey: this.pubkey, value: this.relays });
          StateManager.emit("monitor:update", this);
        } catch (e) {
          console.warn("Monitor addRelays error:", e);
        }
      };
      return Monitor2;
    }();
  }
});

// ../../../dist/browser/managers/MonitorManager.esm.js
var MonitorPriority, MonitorManager;
var init_MonitorManager_esm = __esm({
  "../../../dist/browser/managers/MonitorManager.esm.js"() {
    "use strict";
    init_Monitor_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    (function(MonitorPriority2) {
      MonitorPriority2["Follows"] = "FOLLOWS";
      MonitorPriority2["Wot"] = "WOT";
      MonitorPriority2["Checks"] = "CHECKS";
      MonitorPriority2["LoadSpeed"] = "LOADSPEED";
      MonitorPriority2["Geohash"] = "GEOHASH";
      MonitorPriority2["Country"] = "COUNTRY";
      MonitorPriority2["Network"] = "NETWORK";
    })(MonitorPriority || (MonitorPriority = {}));
    [
      MonitorPriority.Network,
      MonitorPriority.Checks,
      MonitorPriority.Geohash
    ];
    [
      MonitorPriority.Follows,
      MonitorPriority.Wot,
      MonitorPriority.Checks
    ];
    MonitorManager = /** @class */
    function() {
      function MonitorManager2() {
        this.monitors = /* @__PURE__ */ new Map();
      }
      MonitorManager2.getInstance = function() {
        if (!MonitorManager2.instance) {
          MonitorManager2.instance = new MonitorManager2();
        }
        return MonitorManager2.instance;
      };
      Object.defineProperty(MonitorManager2.prototype, "monitorsMap", {
        get: function() {
          return this.monitors;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "monitorsArray", {
        get: function() {
          return Array.from(this.monitors.values());
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "activeMonitors", {
        get: function() {
          return this.monitorsArray.filter(function(monitor) {
            return monitor.lastActive > 0 && monitor.priority >= 0;
          });
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "sortedMonitors", {
        get: function() {
          var sortedMonitors = this.activeMonitors.sort(function(a, b) {
            return a.priority - b.priority;
          });
          return sortedMonitors;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "primary", {
        get: function() {
          return this.monitorsArray.find(function(monitor) {
            return monitor.priority === 1;
          });
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "secondary", {
        get: function() {
          return this.monitorsArray.find(function(monitor) {
            return monitor.priority === 2;
          });
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "tertiary", {
        get: function() {
          return this.monitorsArray.find(function(monitor) {
            return monitor.priority === 3;
          });
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "quaternary", {
        get: function() {
          return this.monitorsArray.find(function(monitor) {
            return monitor.priority === 4;
          });
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorManager2.prototype, "qualified", {
        get: function() {
          var qualified = this.monitorsArray.filter(function(monitor) {
            var _a2, _b, _c;
            if (!((_a2 = monitor === null || monitor === void 0 ? void 0 : monitor.registration) === null || _a2 === void 0 ? void 0 : _a2.lastActive))
              return false;
            if (!((_c = (_b = monitor === null || monitor === void 0 ? void 0 : monitor.registration) === null || _b === void 0 ? void 0 : _b.checks) === null || _c === void 0 ? void 0 : _c.length))
              return false;
            if (!(monitor === null || monitor === void 0 ? void 0 : monitor.profile))
              return false;
            if (!(monitor === null || monitor === void 0 ? void 0 : monitor.relays))
              return false;
            return monitor.registration.lastActive > 0;
          });
          return qualified;
        },
        enumerable: false,
        configurable: true
      });
      MonitorManager2.prototype.handleEvent = function(event) {
        var kind = event.kind, pubkey = event.pubkey;
        var monitor = this.monitors.get(pubkey);
        if (!monitor && kind === 10166) {
          monitor = new Monitor(event);
          this.monitors.set(pubkey, monitor);
          console.log("created new monitor for pubkey: ".concat(pubkey));
        } else if (!monitor) {
          throw new Error("Monitor not found for pubkey: ".concat(pubkey));
        }
        if (kind === 10166) {
          monitor.addRegistration(event);
        } else if (kind === 0) {
          monitor.addProfile(event);
        } else if (kind === 10002) {
          monitor.addRelays(event);
        }
        this.monitors.set(pubkey, monitor);
        console.log("did stuff for ".concat(pubkey));
        console.log("total monitors: ".concat(this.monitors.size));
      };
      MonitorManager2.prototype.sortMonitors = function(priority, apply) {
        if (priority === void 0) {
          priority = MonitorPriority.Checks;
        }
        switch (priority) {
          case MonitorPriority.LoadSpeed:
            return this.sortByNumberOfChecks("ASC");
          case MonitorPriority.Checks:
          default:
            return this.sortByNumberOfChecks();
        }
      };
      MonitorManager2.prototype.sortByNumberOfChecks = function(order) {
        if (order === void 0) {
          order = "DESC";
        }
        var qualifiedMonitors = this.qualified;
        var scores = {};
        qualifiedMonitors.forEach(function(monitor) {
          var _a2, _b, _c, _d, _e;
          var score = 0;
          if (!((_a2 = monitor === null || monitor === void 0 ? void 0 : monitor.registration) === null || _a2 === void 0 ? void 0 : _a2.pubkey))
            return;
          if (monitor === null || monitor === void 0 ? void 0 : monitor.registration)
            score++;
          if ((_c = (_b = monitor === null || monitor === void 0 ? void 0 : monitor.registration) === null || _b === void 0 ? void 0 : _b.checks) === null || _c === void 0 ? void 0 : _c.length)
            score += (_e = (_d = monitor === null || monitor === void 0 ? void 0 : monitor.registration) === null || _d === void 0 ? void 0 : _d.checks) === null || _e === void 0 ? void 0 : _e.length;
          if (monitor === null || monitor === void 0 ? void 0 : monitor.profile)
            score++;
          if (monitor === null || monitor === void 0 ? void 0 : monitor.relays)
            score++;
          console.log("prioritizeMonitors: ".concat(monitor.registration.pubkey, " score: ").concat(score));
          scores[monitor.registration.pubkey] = score;
        });
        qualifiedMonitors.sort(function(a, b) {
          var scoreA = (scores === null || scores === void 0 ? void 0 : scores[a.registration.pubkey]) || 0;
          var scoreB = (scores === null || scores === void 0 ? void 0 : scores[b.registration.pubkey]) || 0;
          if (order === "ASC")
            return scoreA - scoreB;
          return scoreB - scoreA;
        });
        return qualifiedMonitors;
      };
      MonitorManager2.prototype.prioritizeMonitors = function(priority) {
        if (priority === void 0) {
          priority = MonitorPriority.Checks;
        }
        var monitors = this.sortMonitors(priority);
        monitors.forEach(function(sortedMonitor, index) {
          sortedMonitor.priority = index + 1;
        });
      };
      return MonitorManager2;
    }();
  }
});

// ../../../dist/browser/services/MonitorService.esm.js
var MonitorService_esm_exports = {};
__export(MonitorService_esm_exports, {
  MonitorService: () => MonitorService
});
var MonitorService;
var init_MonitorService_esm = __esm({
  "../../../dist/browser/services/MonitorService.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_Subscriber_esm();
    init_WebsocketAdapter_esm();
    init_MonitorManager_esm();
    init_Service_esm();
    init_index_esm3();
    init_StateManager_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    MonitorService = /** @class */
    function(_super) {
      __extends(MonitorService2, _super);
      function MonitorService2(adapters) {
        var _this = _super.call(this, adapters) || this;
        _this._groupedRelays = {};
        _this.subscriber = new Subscriber();
        _this.queue = new PQueue({ concurrency: 1 });
        _this.monitorManager = MonitorManager.getInstance();
        _this.addRelay("nip66", "wss://relay.nostr.watch");
        _this.addRelay("nip66", "wss://relaypag.es");
        _this.addRelay("userMeta", "wss://purplepag.es");
        _this.addRelay("userMeta", "wss://user.kindpag.es");
        return _this;
      }
      MonitorService2.prototype.init = function() {
        return __awaiter(this, void 0, void 0, function() {
          var _a2, _b;
          return __generator(this, function(_c) {
            switch (_c.label) {
              case 0:
                if (!((_a2 = this === null || this === void 0 ? void 0 : this.cacheAdapter) === null || _a2 === void 0 ? void 0 : _a2.init)) return [3, 2];
                return [4, (_b = this === null || this === void 0 ? void 0 : this.cacheAdapter) === null || _b === void 0 ? void 0 : _b.init()];
              case 1:
                _c.sent();
                _c.label = 2;
              case 2:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      Object.defineProperty(MonitorService2.prototype, "monitors", {
        get: function() {
          return this.monitorManager.monitorsMap;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "monitorsArray", {
        get: function() {
          return this.monitorManager.monitorsArray;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "sortedMonitors", {
        get: function() {
          return this.monitorManager.sortedMonitors;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "activeMonitors", {
        get: function() {
          return this.monitorManager.activeMonitors;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "primary", {
        get: function() {
          return this.monitorManager.primary;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "secondary", {
        get: function() {
          return this.monitorManager.secondary;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "tertiary", {
        get: function() {
          return this.monitorManager.tertiary;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "quaternary", {
        get: function() {
          return this.monitorManager.quaternary;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "nip66Relays", {
        get: function() {
          var _a2;
          return ((_a2 = this._groupedRelays) === null || _a2 === void 0 ? void 0 : _a2.nip66) || [];
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(MonitorService2.prototype, "userMetaRelays", {
        get: function() {
          var _a2;
          return ((_a2 = this._groupedRelays) === null || _a2 === void 0 ? void 0 : _a2.userMeta) || [];
        },
        enumerable: false,
        configurable: true
      });
      MonitorService2.prototype.addRelay = function(to, relay) {
        var _a2, _b;
        if (!((_a2 = this._groupedRelays) === null || _a2 === void 0 ? void 0 : _a2[to]))
          this._groupedRelays[to] = [];
        (_b = this._groupedRelays) === null || _b === void 0 ? void 0 : _b[to].push(relay);
      };
      MonitorService2.prototype.removeRelay = function(from, relay) {
        var _a2;
        if (!((_a2 = this._groupedRelays) === null || _a2 === void 0 ? void 0 : _a2[from]))
          return;
        this._groupedRelays[from] = this._groupedRelays[from].filter(function(r) {
          return r !== relay;
        });
      };
      MonitorService2.prototype.fetch = function(args, callbacks) {
        return __awaiter(this, void 0, void 0, function() {
          var filters, relays, options, message, result;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                filters = args.filters, relays = args.relays, options = args.options;
                message = { filters, relays, options };
                return [4, this.websocketAdapter.fetch(message, callbacks)];
              case 1:
                result = _a2.sent();
                return [2, result];
            }
          });
        });
      };
      MonitorService2.prototype.sync = function(args, callbacks) {
        return __awaiter(this, void 0, void 0, function() {
          var since, until, getOrInitNestedMap, onevent, results, updateMonitors;
          var _this = this;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                since = /* @__PURE__ */ new Map();
                until = /* @__PURE__ */ new Map();
                getOrInitNestedMap = function(outerMap, pubkey) {
                  if (!outerMap.has(pubkey)) {
                    outerMap.set(pubkey, /* @__PURE__ */ new Map());
                  }
                  return outerMap.get(pubkey);
                };
                onevent = function(event) {
                  var _a3;
                  (_a3 = callbacks === null || callbacks === void 0 ? void 0 : callbacks.onevent) === null || _a3 === void 0 ? void 0 : _a3.call(callbacks, event);
                  if (!(event === null || event === void 0 ? void 0 : event.created_at))
                    return;
                  var createdAt = event.created_at;
                  var pubkey = event.pubkey;
                  var kind = event.kind;
                  var sinceMap = getOrInitNestedMap(since, pubkey);
                  var untilMap = getOrInitNestedMap(until, pubkey);
                  if (!sinceMap.has(kind) || sinceMap.get(kind) > createdAt) {
                    sinceMap.set(kind, createdAt);
                  }
                  if (!untilMap.has(kind) || untilMap.get(kind) < createdAt) {
                    untilMap.set(kind, createdAt);
                  }
                  var currentSince = sinceMap.get(kind);
                  var currentUntil = untilMap.get(kind);
                  if (currentSince > currentUntil) {
                    console.error("Invalid state detected: since (".concat(currentSince, ") > until (").concat(currentUntil, ") for pubkey: ").concat(pubkey, ", kind: ").concat(kind));
                  }
                };
                return [4, this._fetch(args, __assign(__assign({}, callbacks), { onevent }))];
              case 1:
                results = _a2.sent();
                updateMonitors = function() {
                  for (var _i = 0, _a3 = Array.from(since.entries()); _i < _a3.length; _i++) {
                    var _b = _a3[_i], pubkey = _b[0], sinceMap = _b[1];
                    var monitor = _this.monitors.get(pubkey);
                    if (!monitor) {
                      console.error("Monitor not found for pubkey: ".concat(pubkey));
                      continue;
                    }
                    var untilMap = until.get(pubkey);
                    if (!untilMap) {
                      console.warn('No "until" map found for pubkey: '.concat(pubkey));
                      continue;
                    }
                    for (var _c = 0, _d = Array.from(sinceMap.entries()); _c < _d.length; _c++) {
                      var _e = _d[_c], kind = _e[0], sinceTimestamp = _e[1];
                      var untilTimestamp = untilMap.get(kind);
                      if (typeof untilTimestamp === "undefined") {
                        console.warn('No "until" timestamp for kind: '.concat(kind, " under pubkey: ").concat(pubkey));
                        continue;
                      }
                      if (sinceTimestamp > untilTimestamp) {
                        console.error("Invalid sync state: since (".concat(sinceTimestamp, ") > until (").concat(untilTimestamp, ") for pubkey: ").concat(pubkey, ", kind: ").concat(kind));
                        continue;
                      }
                      monitor.setLastSync(kind, "since", sinceTimestamp);
                      monitor.setLastSync(kind, "until", untilTimestamp);
                    }
                  }
                };
                updateMonitors();
                return [2, results];
            }
          });
        });
      };
      MonitorService2.prototype.modifyCacheFilters = function(filters) {
        return __awaiter(this, void 0, void 0, function() {
          var _this = this;
          return __generator(this, function(_a2) {
            return [2, filters.map(function(filter) {
              var authors = filter.authors, kinds = filter.kinds, requestedSince = filter.since;
              filter.until;
              for (var _i = 0, _a3 = authors || []; _i < _a3.length; _i++) {
                var pubkey = _a3[_i];
                var monitor = _this.monitors.get(pubkey);
                for (var _b = 0, _c = kinds || []; _b < _c.length; _b++) {
                  var kind = _c[_b];
                  var cachedRange = monitor === null || monitor === void 0 ? void 0 : monitor.getLastSync(kind);
                  if (cachedRange === null || cachedRange === void 0 ? void 0 : cachedRange.since) {
                    if (requestedSince && cachedRange.since < requestedSince) ;
                  }
                }
              }
              return filter;
            })];
          });
        });
      };
      MonitorService2.prototype.modifyWebsocketFilters = function(filters) {
        return __awaiter(this, void 0, void 0, function() {
          var _this = this;
          return __generator(this, function(_a2) {
            return [2, filters.map(function(filter) {
              var authors = filter.authors, kinds = filter.kinds, requestedSince = filter.since;
              filter.until;
              for (var _i = 0, _a3 = authors || []; _i < _a3.length; _i++) {
                var pubkey = _a3[_i];
                var monitor = _this.monitors.get(pubkey);
                for (var _b = 0, _c = kinds || []; _b < _c.length; _b++) {
                  var kind = _c[_b];
                  var cachedRange = monitor === null || monitor === void 0 ? void 0 : monitor.getLastSync(kind);
                  if (cachedRange === null || cachedRange === void 0 ? void 0 : cachedRange.until) {
                    if (requestedSince && cachedRange.until > requestedSince) ;
                  }
                }
              }
              return filter;
            })];
          });
        });
      };
      MonitorService2.prototype.bootstrap = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [4, this.bootstrapMonitorRegistrations()];
              case 1:
                _a2.sent();
                return [4, this.bootstrapMonitorData()];
              case 2:
                _a2.sent();
                return [4, this.ensureMonitorsActive()];
              case 3:
                _a2.sent();
                this.prioritizeMonitors();
                return [4, this.bootstrapMonitorChecks()];
              case 4:
                _a2.sent();
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      MonitorService2.prototype.bootstrapMonitorRegistrations = function() {
        return __awaiter(this, void 0, void 0, function() {
          var onevent, result;
          var _this = this;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                onevent = function(event) {
                  if (event.kind !== 10166)
                    return;
                  _this.monitorManager.handleEvent(event);
                };
                return [4, this.sync({
                  filters: [{ kinds: [10166] }],
                  relays: this.nip66Relays,
                  options: {
                    cache: true,
                    returnResults: true,
                    keepAlive: false,
                    stream: true
                  }
                }, { onevent })];
              case 1:
                result = _a2.sent();
                StateManager.emit("bootstrap:monitorRegistrations", { complete: true, status: "success", count: (result === null || result === void 0 ? void 0 : result.length) || 0 });
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      MonitorService2.prototype.bootstrapMonitorData = function() {
        return __awaiter(this, void 0, void 0, function() {
          var monitors, authors, onevent;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                monitors = __spreadArray([], this.monitorsArray.map(function(m) {
                  return m.registration;
                }), true);
                authors = monitors.map(function(monitor) {
                  return monitor.pubkey;
                });
                authors.length = authors.length > 4 ? 4 : authors.length;
                onevent = this.monitorManager.handleEvent.bind(this.monitorManager);
                return [4, this.sync({
                  filters: [{
                    authors,
                    kinds: [0, 10002]
                  }],
                  relays: this.userMetaRelays,
                  options: {
                    cache: true,
                    returnResults: true,
                    keepAlive: false,
                    stream: true
                  }
                }, { onevent })];
              case 1:
                _a2.sent();
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      MonitorService2.prototype.isMonitorActive = function(pubkey) {
        return __awaiter(this, void 0, void 0, function() {
          var monitor, checkFilter, filters, options, relays, result;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                monitor = this.monitors.get(pubkey);
                if (!monitor)
                  return [2, false];
                checkFilter = __assign(__assign({}, monitor.checkFilter), { limit: 1 });
                filters = [checkFilter];
                options = defaultWebsocketAdapterOptions;
                relays = this.nip66Relays;
                return [4, this.fetch({ filters, relays, options })];
              case 1:
                result = _a2.sent();
                return [2, result instanceof Array ? result.length > 0 : result];
            }
          });
        });
      };
      MonitorService2.prototype.getMonitorChecks = function(pubkey) {
        return __awaiter(this, void 0, void 0, function() {
          var monitor, checkFilter, filters, options, relays, result;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                monitor = this.monitors.get(pubkey);
                if (!monitor)
                  return [2, []];
                checkFilter = __assign({}, monitor.checkFilter);
                filters = [checkFilter];
                options = defaultWebsocketAdapterOptions;
                relays = this.nip66Relays;
                return [4, this.fetch({ filters, relays, options })];
              case 1:
                result = _a2.sent();
                return [2, result];
            }
          });
        });
      };
      MonitorService2.prototype.ensureMonitorsActive = function(pubkeys) {
        return __awaiter(this, void 0, void 0, function() {
          var monitors, filters, events, onevent, callbacks, relays, _i, events_1, event_1, pubkey, monitor;
          var _this = this;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                monitors = __spreadArray([], this.monitorsArray, true);
                if (pubkeys) {
                  if (typeof pubkeys === "string")
                    pubkeys = [pubkeys];
                  monitors = monitors.filter(function(m) {
                    return pubkeys.includes(m.registration.pubkey);
                  });
                }
                filters = [];
                events = [];
                monitors.forEach(function(monitor2) {
                  return __awaiter(_this, void 0, void 0, function() {
                    return __generator(this, function(_a3) {
                      filters.push(__assign(__assign({}, monitor2.checkFilter), { limit: 1 }));
                      return [
                        2
                        /*return*/
                      ];
                    });
                  });
                });
                onevent = function(event) {
                  events.push(event);
                };
                callbacks = { onevent };
                relays = this.nip66Relays;
                return [4, this.websocketAdapter.subscribe({
                  relays,
                  filters,
                  options: {
                    cache: false,
                    returnResults: true,
                    keepAlive: false,
                    stream: false
                  }
                }, callbacks)];
              case 1:
                _a2.sent();
                for (_i = 0, events_1 = events; _i < events_1.length; _i++) {
                  event_1 = events_1[_i];
                  pubkey = event_1.pubkey;
                  monitor = this.monitors.get(pubkey);
                  if (monitor === null || monitor === void 0 ? void 0 : monitor.registration) {
                    monitor.lastActive = event_1.created_at;
                    this.monitors.set(pubkey, monitor);
                  }
                }
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      MonitorService2.prototype.prioritizeMonitors = function() {
        this.monitorManager.prioritizeMonitors();
      };
      MonitorService2.prototype.optimizeFilters = function(filters) {
        var _a2, _b, _c;
        var filterMap = /* @__PURE__ */ new Map();
        for (var _i = 0, filters_1 = filters; _i < filters_1.length; _i++) {
          var filter = filters_1[_i];
          var key = JSON.stringify({
            since: (_a2 = filter.since) !== null && _a2 !== void 0 ? _a2 : null,
            until: (_b = filter.until) !== null && _b !== void 0 ? _b : null,
            kinds: (_c = filter.kinds) !== null && _c !== void 0 ? _c : null
          });
          if (filterMap.has(key)) {
            var existingFilter = filterMap.get(key);
            existingFilter.authors = __spreadArray([], Array.from(new Set(__spreadArray(__spreadArray([], existingFilter.authors || [], true), filter.authors || [], true))), true);
          } else {
            filterMap.set(key, __assign(__assign({}, filter), { authors: __spreadArray([], filter.authors || [], true) }));
          }
        }
        return Array.from(filterMap.values());
      };
      MonitorService2.prototype.getMonitorCheckFilters = function() {
        if (!this.sortedMonitors.length) {
          console.warn("MonitorService getMonitorCheckFilters: no monitors");
          return [];
        }
        var monitors = this.sortedMonitors.slice(0, 3);
        var filters = [];
        monitors.forEach(function(monitor) {
          filters.push(monitor.checkFilter);
        });
        return filters;
      };
      MonitorService2.prototype.bootstrapMonitorChecks = function() {
        return __awaiter(this, void 0, void 0, function() {
          var filters, onevent, onevents, relays, options, result;
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                filters = this.getMonitorCheckFilters();
                onevent = function(event) {
                  StateManager.emit("event", event);
                };
                onevents = function(events) {
                  StateManager.emit("events", events);
                };
                relays = this.nip66Relays;
                options = {
                  cache: true,
                  returnResults: true,
                  keepAlive: false,
                  stream: true,
                  batch: 100
                };
                return [4, this.sync({ relays, filters, options }, { onevent, onevents })];
              case 1:
                result = _a2.sent();
                return [2, result];
            }
          });
        });
      };
      MonitorService2.prototype.getMonitor = function(pubkey) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            if (this.monitors.has(pubkey)) {
              return [2, this.monitors.get(pubkey)];
            }
            __spreadArray(__spreadArray(__spreadArray([], this.nip66Relays, true), this.userMetaRelays, true), this.getMonitorRelays(pubkey), true);
            return [2, this.monitors.get(pubkey)];
          });
        });
      };
      MonitorService2.prototype.getMonitorRelays = function(pubkey) {
        var _a2;
        return ((_a2 = this.monitors.get(pubkey)) === null || _a2 === void 0 ? void 0 : _a2.relays) || [];
      };
      MonitorService2.prototype.getMonitorPubkeys = function() {
        if (!this.sortedMonitors.length) {
          console.warn("MonitorService getMonitorPubkeys: no monitors");
          return [];
        }
        return this.sortedMonitors.map(function(monitor) {
          return monitor.registration.pubkey;
        });
      };
      MonitorService2.prototype.getActiveMonitors = function() {
        return __awaiter(this, void 0, void 0, function() {
          var monitors;
          return __generator(this, function(_a2) {
            monitors = [];
            return [2, monitors];
          });
        });
      };
      return MonitorService2;
    }(Service);
  }
});

// ../../../dist/browser/core/Base.esm.js
var default_1;
var init_Base_esm = __esm({
  "../../../dist/browser/core/Base.esm.js"() {
    "use strict";
    init_tslib_esm();
    init_StateManager_esm();
    (function(l, r) {
      if (!l || l.getElementById("livereloadscript")) return;
      r = l.createElement("script");
      r.async = 1;
      r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
      r.id = "livereloadscript";
      l.getElementsByTagName("head")[0].appendChild(r);
    })(self.document);
    default_1 = /** @class */
    function() {
      function default_12(adapters, relayUrls) {
        this.adapters = adapters;
        this.relayUrls = relayUrls;
        if (adapters === null || adapters === void 0 ? void 0 : adapters.websocketAdapter)
          this.useAdapter(adapters.websocketAdapter);
        if (adapters === null || adapters === void 0 ? void 0 : adapters.cacheAdapter)
          this.useAdapter(adapters.cacheAdapter);
      }
      Object.defineProperty(default_12.prototype, "monitors", {
        get: function() {
          return this.monitorService;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "relays", {
        get: function() {
          return this.relayService;
        },
        enumerable: false,
        configurable: true
      });
      default_12.prototype.on = function(event, listener) {
        StateManager.on(event, listener);
      };
      default_12.prototype.once = function(event, listener) {
        StateManager.once(event, listener);
      };
      default_12.prototype.off = function(event, listener) {
        StateManager.off(event, listener);
      };
      default_12.prototype.destroy = function() {
        StateManager.emit("destroy");
      };
      default_12.prototype.useAdapter = function(adapter) {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            if (!adapter) {
              return [2, console.warn("No adapter provided")];
            }
            if (typeof adapter === "function") {
              return [2, console.warn("Adapter should be an instantiated CacheAdapter or WebsocketAdapter")];
            }
            if (this.isCacheAdapter(adapter)) {
              this.cacheAdapter = adapter;
              return [
                2
                /*return*/
              ];
            }
            if (this.isWebsocketAdapter(adapter)) {
              this.websocketAdapter = adapter;
              return [
                2
                /*return*/
              ];
            }
            console.warn("Adapter not recognized: ".concat(adapter.constructor.name, " [should be instance of WebsocketAdapter or CacheAdapter]"));
            return [
              2
              /*return*/
            ];
          });
        });
      };
      default_12.prototype.isCacheAdapter = function(adapter) {
        return adapter.constructor.type === "CacheAdapter";
      };
      default_12.prototype.isWebsocketAdapter = function(adapter) {
        return adapter.constructor.type === "WebsocketAdapter";
      };
      default_12.prototype.init = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [4, this.setupWorkers()];
              case 1:
                _a2.sent();
                return [4, this.setupServices()];
              case 2:
                _a2.sent();
                return [4, this.adaptersReady()];
              case 3:
                _a2.sent();
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      default_12.prototype.adaptersReady = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                if (!(this === null || this === void 0 ? void 0 : this.cacheAdapter)) return [3, 2];
                return [4, this === null || this === void 0 ? void 0 : this.cacheAdapter.ready()];
              case 1:
                _a2.sent();
                _a2.label = 2;
              case 2:
                if (!(this === null || this === void 0 ? void 0 : this.websocketAdapter)) return [3, 4];
                return [4, this === null || this === void 0 ? void 0 : this.websocketAdapter.ready()];
              case 3:
                _a2.sent();
                _a2.label = 4;
              case 4:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      default_12.prototype.setupWorkers = function() {
        return __awaiter(this, void 0, void 0, function() {
          var Workers2, workers;
          var _a2, _b;
          return __generator(this, function(_c) {
            switch (_c.label) {
              case 0:
                if (!((_a2 = this === null || this === void 0 ? void 0 : this.adapters) === null || _a2 === void 0 ? void 0 : _a2.websocketAdapter) || !((_b = this === null || this === void 0 ? void 0 : this.adapters) === null || _b === void 0 ? void 0 : _b.cacheAdapter))
                  return [
                    2
                    /*return*/
                  ];
                return [4, Promise.resolve().then(() => (init_Workers_esm(), Workers_esm_exports))];
              case 1:
                Workers2 = _c.sent().Workers;
                workers = new Workers2(this.adapters);
                _c.label = 2;
              case 2:
                if (!!workers.ready) return [3, 4];
                return [4, new Promise(function(resolve) {
                  return setTimeout(resolve, 1);
                })];
              case 3:
                _c.sent();
                return [3, 2];
              case 4:
                this.adapters.cacheAdapter.workers = workers;
                this.adapters.websocketAdapter.workers = workers;
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      default_12.prototype.setupServices = function() {
        return __awaiter(this, void 0, void 0, function() {
          var _a2, cacheAdapter, websocketAdapter, RelayService2, MonitorService2;
          return __generator(this, function(_b) {
            switch (_b.label) {
              case 0:
                if (!(this === null || this === void 0 ? void 0 : this.websocketAdapter) || !(this === null || this === void 0 ? void 0 : this.cacheAdapter))
                  return [
                    2
                    /*return*/
                  ];
                _a2 = this, cacheAdapter = _a2.cacheAdapter, websocketAdapter = _a2.websocketAdapter;
                return [4, Promise.resolve().then(() => (init_RelayService_esm(), RelayService_esm_exports))];
              case 1:
                RelayService2 = _b.sent().RelayService;
                return [4, Promise.resolve().then(() => (init_MonitorService_esm(), MonitorService_esm_exports))];
              case 2:
                MonitorService2 = _b.sent().MonitorService;
                this.relayService = new RelayService2({ cacheAdapter, websocketAdapter });
                this.monitorService = new MonitorService2({ cacheAdapter, websocketAdapter });
                this.monitorService.init();
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      Object.defineProperty(default_12.prototype, "state", {
        get: function() {
          return StateManager;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "cache", {
        get: function() {
          return this.cacheAdapter;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "websocket", {
        get: function() {
          return this.websocketAdapter;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "wsWorker", {
        get: function() {
          var _a2, _b;
          return (_b = (_a2 = this === null || this === void 0 ? void 0 : this.websocketAdapter) === null || _a2 === void 0 ? void 0 : _a2.workers) === null || _b === void 0 ? void 0 : _b.websocketDedicated;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "wsSharedWorker", {
        get: function() {
          var _a2, _b;
          return (_b = (_a2 = this === null || this === void 0 ? void 0 : this.websocketAdapter) === null || _a2 === void 0 ? void 0 : _a2.workers) === null || _b === void 0 ? void 0 : _b.websocketShared;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "cacheWorker", {
        get: function() {
          var _a2, _b;
          return (_b = (_a2 = this === null || this === void 0 ? void 0 : this.cacheAdapter) === null || _a2 === void 0 ? void 0 : _a2.workers) === null || _b === void 0 ? void 0 : _b.cacheDedicated;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(default_12.prototype, "cacheSharedWorker", {
        get: function() {
          var _a2, _b;
          return (_b = (_a2 = this === null || this === void 0 ? void 0 : this.cacheAdapter) === null || _a2 === void 0 ? void 0 : _a2.workers) === null || _b === void 0 ? void 0 : _b.cacheShared;
        },
        enumerable: false,
        configurable: true
      });
      default_12.prototype.bootstrap = function() {
        return __awaiter(this, void 0, void 0, function() {
          var _a2;
          return __generator(this, function(_b) {
            (_a2 = this.monitorService) === null || _a2 === void 0 ? void 0 : _a2.bootstrap();
            return [
              2
              /*return*/
            ];
          });
        });
      };
      default_12.prototype.bootstrapMonitors = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      default_12.prototype.populateChecksRelays = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            return [
              2
              /*return*/
            ];
          });
        });
      };
      default_12.prototype.ping = function() {
        var _a2, _b;
        (_a2 = this.cacheAdapter) === null || _a2 === void 0 ? void 0 : _a2.ping();
        (_b = this.websocketAdapter) === null || _b === void 0 ? void 0 : _b.ping();
      };
      default_12.prototype.REQ = function(filters) {
        var _a2;
        (_a2 = this.cacheAdapter) === null || _a2 === void 0 ? void 0 : _a2.REQ(filters);
      };
      return default_12;
    }();
  }
});

// ../../../dist/browser/core/index.esm.js
init_Adapter_esm();
init_AdapterCacheWorker_esm();
init_AdapterWebsocketWorker_esm();
init_AdapterWorker_esm();
init_Base_esm();
init_Batcher_esm();
init_CacheAdapter_esm();
init_Workers_esm();
init_Queue_esm();
init_WebsocketAdapter_esm();
(function(l, r) {
  if (!l || l.getElementById("livereloadscript")) return;
  r = l.createElement("script");
  r.async = 1;
  r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
  r.id = "livereloadscript";
  l.getElementsByTagName("head")[0].appendChild(r);
})(self.document);

// src/NostrSqliteWorker.ts
import { handleMsg as relayHandler, insertBatch, relayInit, relayEvent, relayWipe } from "@nostrwatch/worker-relay/dist/worker-utils";
var NostrSqliteWorker = class extends AdapterCacheWorker {
  state = {
    self: this.mainThread,
    eventWriteQueue: [],
    relay: void 0,
    messageChannel: void 0,
    insertBatchEvery: 1e3,
    insertBatchSize: 25,
    lastBatch: 0
  };
  relay = relayHandler;
  batcher = setTimeout(() => {
    insertBatch(this.state);
  }, 1e3);
  constructor(options) {
    super(options);
    this.setupHandlers();
  }
  destroy() {
    clearTimeout(this.batcher);
  }
  async setup(command) {
    const conf = {
      databasePath: "relay.db",
      insertBatchSize: this.state.insertBatchSize
    };
    await relayInit(this.state, conf).catch(async () => {
      await relayWipe(this.state);
      this.setup(command);
    });
    if (command?.channelPort) {
      this.state.messageChannel = command.channelPort;
      this.setupChannelHandlers();
    }
  }
  setupHandlers() {
    if (!this?.mainThread) return console.warn("NostrSqliteWorker: mainThread not defined");
    this.mainThread.onmessage = async (message) => {
      if (message.data.type === "setup") {
        await this.__setup(message.data);
        return;
      } else {
        this.fromMainThread(message);
      }
    };
    if (this.state?.messageChannel) {
      this.state.messageChannel.onmessage = async (message) => {
        this.relay(this.state, message);
      };
    }
  }
  setupChannelHandlers() {
    if (!this.state.messageChannel) return console.warn("channel not defined");
    this.state.messageChannel.onmessage = (message) => {
      const command = message.data;
      this.onChannelMessage(command);
    };
    this.state.messageChannel.onmessageerror = this.onMessageError;
  }
  fromMainThread(ev) {
    this.relay(this.state, ev);
  }
  async addEvent(nostrEvent) {
    relayEvent(this.state, nostrEvent);
  }
  async addEvents(nostrEvents) {
    console.log(`NostrSqliteWorker: Over MessageChannel: relay.eventBatch() -> ${nostrEvents.length}`);
    this?.state?.relay?.eventBatch?.(nostrEvents);
  }
};

// ../../../dist/browser/factory/cache.shared.worker.esm.js
init_tslib_esm();
(function(l, r) {
  if (!l || l.getElementById("livereloadscript")) return;
  r = l.createElement("script");
  r.async = 1;
  r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
  r.id = "livereloadscript";
  l.getElementsByTagName("head")[0].appendChild(r);
})(self.document);

// ../../../dist/browser/factory/cache.worker.esm.js
(function(l, r) {
  if (!l || l.getElementById("livereloadscript")) return;
  r = l.createElement("script");
  r.async = 1;
  r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
  r.id = "livereloadscript";
  l.getElementsByTagName("head")[0].appendChild(r);
})(self.document);
var cache_worker = function(_AdapterWorker_, root) {
  return new _AdapterWorker_({ mainThread: root });
};

// ../../../dist/browser/factory/index.esm.js
(function(l, r) {
  if (!l || l.getElementById("livereloadscript")) return;
  r = l.createElement("script");
  r.async = 1;
  r.src = "//" + (self.location.host || "localhost").split(":")[0] + ":35729/livereload.js?snipver=1";
  r.id = "livereloadscript";
  l.getElementsByTagName("head")[0].appendChild(r);
})(self.document);

// src/workers/nostrsqlite.worker.ts
var $self = self;
var worker = cache_worker(NostrSqliteWorker, $self);
//# sourceMappingURL=nostrsqlite.worker.js.map
