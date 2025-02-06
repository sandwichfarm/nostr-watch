<script lang="ts">
  import { Orientation, Scale, TopoJSONMap } from '@unovis/ts'
  import { WorldMapTopoJSON } from '@unovis/ts/maps'
  import {
    VisSingleContainer,
    VisTopoJSONMap,
    VisTooltip,
    VisXYContainer,
    VisStackedBar,
    VisAxis,
  } from '@unovis/svelte'

  type ISO3166Alpha2 = string

  export let data: Map<ISO3166Alpha2, number>
  export let legend: string

  const areas = Object.fromEntries(
    [...data].map(([countryCode, val]) => [countryCode, { value: val }])
  )
  const mapData = { areas }

  function niceExtent(minVal: number, maxVal: number): [number, number] {
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      return [0, 0] 
    }
    const range = maxVal - minVal

    // order of magnitude rounding
    const order = Math.floor(Math.log10(range))
    const roundTo = Math.pow(10, order)

    // Round min down, max up
    const newMin = Math.floor(minVal / roundTo) * roundTo
    const newMax = Math.ceil(maxVal / roundTo) * roundTo

    return [newMin, newMax]
  }

  // min and max
  const values = Array.from(data.values())
  const [minVal, maxVal] = niceExtent(
    Math.min(...values),
    Math.max(...values)
  )

  // sequential color scale
  const colorScale = Scale.scaleSequential(['#f7fbff', '#08306b'])
    .domain([minVal, maxVal])

  // map area to color
  const getAreaColor = (d) => colorScale(d?.value ?? 0)

  const tooltipTriggers = {
    [TopoJSONMap.selectors.feature]: d =>
      `${d.properties.name}: ${d.data?.value ?? 'No data'}`
  }

  const stepCount = 10
  const stepSize = (maxVal - minVal) / (stepCount - 1)
  const gradientSteps = Array.from(
    { length: stepCount },
    (_, i) => minVal + i * stepSize
  )

  const color = (d) => colorScale(d)

  const tickFormat = (v: number) => Math.round(v).toString()
</script>

<div class="topojson-map">

  <VisSingleContainer data={mapData} height={550} duration={0}>
    <VisTopoJSONMap
      topojson={WorldMapTopoJSON}
      areaColor={getAreaColor}
      disableZoom
    />
    <VisTooltip triggers={tooltipTriggers} />
  </VisSingleContainer>


  <VisXYContainer data={[gradientSteps]} height={70} width={500}>
    <VisStackedBar
      x={0}
      y={gradientSteps}
      {color}
      orientation={Orientation.Horizontal}
    />
    <VisAxis
      type="x"
      position="top"
      label={legend}
      numTicks={5}
      {tickFormat}
    />
  </VisXYContainer>
</div>

<style>
  .topojson-map {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
