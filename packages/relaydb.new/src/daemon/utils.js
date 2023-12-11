export const generateModulePath = (jobData) => {
  const { action, condition, type, batch } = jobData
  if(!action || !type)  throw new Error("No action or type provided, absolutely necessary!!!")
  const batchStr = batch? batch+"-": ""
  return `./jobs/${type.toLowerCase()}-${batchStr.toLowerCase()}${action.toLowerCase()}-${condition.toLowerCase()}.js`
}
