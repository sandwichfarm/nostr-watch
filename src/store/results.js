import { defineStore } from 'pinia'

export const useResultsStore = defineStore(
  'results', 
  {
    state: () => ({ 
      data: {},
    }),
    getters: {
      all: state => state.data,
      get: state => relay => state.data?.[relay] || {}
    },
    actions: {
      setAll(results) {
        this.data = results
      },
      set(result){
        if(!result?.url)
          return
        this.data[result.url] = result
      },
      merge(results) {
        this.mergeLeft(results)
      },
      mergeDeep(results){
        this.data = mergeDeep(this.data, results)
      },
      mergeLeft(results) {
        this.data = Object.assign({}, this.data, results)
      },
      mergeRight(results){
        this.data = Object.assign({}, results, this.data)
      },
    }
})

function mergeDeep(...objects) {
  const isObject = obj => obj && typeof obj === 'object';
  
  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];
      
      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      }
      else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      }
      else {
        prev[key] = oVal;
      }
    });
    
    return prev;
  }, {});
}