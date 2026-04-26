/**
 * Continent dot clouds — lifted from the wireframe SVG in
 * `Tenda V2/landing/sections/07-coverage.html`. Each continent is a `<g>` of
 * static circles forming an approximate silhouette in a 1600×800 viewBox.
 * Pings (city markers) are rendered separately by CoverageMap; this file is
 * pure background geography.
 */

interface Props {
  /** Stroke colour of the dots — pass var(--content-primary) to adapt to theme. */
  dotColor?: string
  /** 0..1. */
  dotOpacity?: number
  /** Override the viewBox to crop the rendered region (zoom). */
  viewBox?: string
}

export function WorldMapDots({
  dotColor = 'currentColor',
  dotOpacity = 0.32,
  viewBox = '0 0 1600 800',
}: Props) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full transition-[viewBox] duration-300 ease-out"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g fill={dotColor} fillOpacity={dotOpacity}>
        {/* North America */}
        <g>
          <circle cx="130" cy="180" r="1.2"/><circle cx="160" cy="180" r="1.2"/><circle cx="190" cy="180" r="1.2"/><circle cx="220" cy="180" r="1.2"/><circle cx="250" cy="180" r="1.2"/><circle cx="280" cy="180" r="1.2"/><circle cx="310" cy="180" r="1.2"/><circle cx="340" cy="180" r="1.2"/><circle cx="370" cy="180" r="1.2"/><circle cx="400" cy="180" r="1.2"/><circle cx="430" cy="180" r="1.2"/>
          <circle cx="140" cy="200" r="1.2"/><circle cx="170" cy="200" r="1.2"/><circle cx="200" cy="200" r="1.2"/><circle cx="230" cy="200" r="1.2"/><circle cx="260" cy="200" r="1.2"/><circle cx="290" cy="200" r="1.2"/><circle cx="320" cy="200" r="1.2"/><circle cx="350" cy="200" r="1.2"/><circle cx="380" cy="200" r="1.2"/><circle cx="410" cy="200" r="1.2"/><circle cx="440" cy="200" r="1.2"/>
          <circle cx="150" cy="220" r="1.2"/><circle cx="180" cy="220" r="1.2"/><circle cx="210" cy="220" r="1.2"/><circle cx="240" cy="220" r="1.2"/><circle cx="270" cy="220" r="1.2"/><circle cx="300" cy="220" r="1.2"/><circle cx="330" cy="220" r="1.2"/><circle cx="360" cy="220" r="1.2"/><circle cx="390" cy="220" r="1.2"/><circle cx="420" cy="220" r="1.2"/>
          <circle cx="190" cy="240" r="1.2"/><circle cx="220" cy="240" r="1.2"/><circle cx="250" cy="240" r="1.2"/><circle cx="280" cy="240" r="1.2"/><circle cx="310" cy="240" r="1.2"/><circle cx="340" cy="240" r="1.2"/><circle cx="370" cy="240" r="1.2"/>
          <circle cx="200" cy="260" r="1.2"/><circle cx="230" cy="260" r="1.2"/><circle cx="260" cy="260" r="1.2"/><circle cx="290" cy="260" r="1.2"/><circle cx="320" cy="260" r="1.2"/><circle cx="350" cy="260" r="1.2"/>
          <circle cx="220" cy="280" r="1.2"/><circle cx="250" cy="280" r="1.2"/><circle cx="280" cy="280" r="1.2"/><circle cx="310" cy="280" r="1.2"/><circle cx="340" cy="280" r="1.2"/>
          <circle cx="240" cy="300" r="1.2"/><circle cx="260" cy="300" r="1.2"/><circle cx="280" cy="300" r="1.2"/><circle cx="300" cy="320" r="1.2"/><circle cx="320" cy="320" r="1.2"/>
        </g>

        {/* South America */}
        <g>
          <circle cx="340" cy="380" r="1.2"/><circle cx="360" cy="380" r="1.2"/><circle cx="380" cy="380" r="1.2"/><circle cx="400" cy="380" r="1.2"/>
          <circle cx="350" cy="410" r="1.2"/><circle cx="370" cy="410" r="1.2"/><circle cx="390" cy="410" r="1.2"/><circle cx="410" cy="410" r="1.2"/><circle cx="430" cy="410" r="1.2"/>
          <circle cx="350" cy="440" r="1.2"/><circle cx="370" cy="440" r="1.2"/><circle cx="390" cy="440" r="1.2"/><circle cx="410" cy="440" r="1.2"/>
          <circle cx="360" cy="470" r="1.2"/><circle cx="380" cy="470" r="1.2"/><circle cx="400" cy="470" r="1.2"/>
          <circle cx="370" cy="500" r="1.2"/><circle cx="390" cy="500" r="1.2"/>
          <circle cx="370" cy="530" r="1.2"/><circle cx="390" cy="530" r="1.2"/>
          <circle cx="370" cy="560" r="1.2"/><circle cx="385" cy="590" r="1.2"/><circle cx="380" cy="620" r="1.2"/><circle cx="375" cy="650" r="1.2"/>
        </g>

        {/* Europe */}
        <g>
          <circle cx="730" cy="170" r="1.2"/><circle cx="755" cy="170" r="1.2"/><circle cx="780" cy="170" r="1.2"/><circle cx="805" cy="170" r="1.2"/><circle cx="830" cy="170" r="1.2"/><circle cx="855" cy="170" r="1.2"/>
          <circle cx="715" cy="190" r="1.2"/><circle cx="740" cy="190" r="1.2"/><circle cx="765" cy="190" r="1.2"/><circle cx="790" cy="190" r="1.2"/><circle cx="815" cy="190" r="1.2"/><circle cx="840" cy="190" r="1.2"/><circle cx="865" cy="190" r="1.2"/>
          <circle cx="725" cy="210" r="1.2"/><circle cx="750" cy="210" r="1.2"/><circle cx="775" cy="210" r="1.2"/><circle cx="800" cy="210" r="1.2"/><circle cx="825" cy="210" r="1.2"/><circle cx="850" cy="210" r="1.2"/>
          <circle cx="735" cy="230" r="1.2"/><circle cx="760" cy="230" r="1.2"/><circle cx="785" cy="230" r="1.2"/><circle cx="810" cy="230" r="1.2"/><circle cx="835" cy="230" r="1.2"/>
          <circle cx="745" cy="250" r="1.2"/><circle cx="770" cy="250" r="1.2"/><circle cx="795" cy="250" r="1.2"/><circle cx="820" cy="250" r="1.2"/>
          <circle cx="755" cy="270" r="1.2"/><circle cx="780" cy="270" r="1.2"/><circle cx="805" cy="270" r="1.2"/>
        </g>

        {/* Africa */}
        <g>
          <circle cx="740" cy="310" r="1.2"/><circle cx="760" cy="310" r="1.2"/><circle cx="780" cy="310" r="1.2"/><circle cx="800" cy="310" r="1.2"/><circle cx="820" cy="310" r="1.2"/><circle cx="840" cy="310" r="1.2"/><circle cx="860" cy="310" r="1.2"/><circle cx="880" cy="310" r="1.2"/>
          <circle cx="730" cy="335" r="1.2"/><circle cx="755" cy="335" r="1.2"/><circle cx="780" cy="335" r="1.2"/><circle cx="805" cy="335" r="1.2"/><circle cx="830" cy="335" r="1.2"/><circle cx="855" cy="335" r="1.2"/><circle cx="880" cy="335" r="1.2"/><circle cx="905" cy="335" r="1.2"/>
          <circle cx="740" cy="360" r="1.2"/><circle cx="765" cy="360" r="1.2"/><circle cx="790" cy="360" r="1.2"/><circle cx="815" cy="360" r="1.2"/><circle cx="840" cy="360" r="1.2"/><circle cx="865" cy="360" r="1.2"/><circle cx="890" cy="360" r="1.2"/>
          <circle cx="745" cy="385" r="1.2"/><circle cx="770" cy="385" r="1.2"/><circle cx="795" cy="385" r="1.2"/><circle cx="820" cy="385" r="1.2"/><circle cx="845" cy="385" r="1.2"/><circle cx="870" cy="385" r="1.2"/><circle cx="895" cy="385" r="1.2"/>
          <circle cx="755" cy="410" r="1.2"/><circle cx="780" cy="410" r="1.2"/><circle cx="805" cy="410" r="1.2"/><circle cx="830" cy="410" r="1.2"/><circle cx="855" cy="410" r="1.2"/><circle cx="880" cy="410" r="1.2"/>
          <circle cx="765" cy="435" r="1.2"/><circle cx="790" cy="435" r="1.2"/><circle cx="815" cy="435" r="1.2"/><circle cx="840" cy="435" r="1.2"/><circle cx="865" cy="435" r="1.2"/>
          <circle cx="775" cy="460" r="1.2"/><circle cx="800" cy="460" r="1.2"/><circle cx="825" cy="460" r="1.2"/><circle cx="850" cy="460" r="1.2"/><circle cx="875" cy="460" r="1.2"/>
          <circle cx="785" cy="490" r="1.2"/><circle cx="810" cy="490" r="1.2"/><circle cx="835" cy="490" r="1.2"/><circle cx="860" cy="490" r="1.2"/>
          <circle cx="795" cy="520" r="1.2"/><circle cx="820" cy="520" r="1.2"/><circle cx="845" cy="520" r="1.2"/>
          <circle cx="800" cy="550" r="1.2"/><circle cx="825" cy="550" r="1.2"/><circle cx="850" cy="550" r="1.2"/>
          <circle cx="810" cy="580" r="1.2"/><circle cx="835" cy="580" r="1.2"/>
          <circle cx="820" cy="610" r="1.2"/>
        </g>

        {/* Middle East */}
        <g>
          <circle cx="900" cy="270" r="1.2"/><circle cx="925" cy="270" r="1.2"/><circle cx="950" cy="270" r="1.2"/>
          <circle cx="910" cy="295" r="1.2"/><circle cx="935" cy="295" r="1.2"/><circle cx="960" cy="295" r="1.2"/>
          <circle cx="920" cy="320" r="1.2"/><circle cx="945" cy="320" r="1.2"/>
        </g>

        {/* Asia mainland (with India + SE Asia sub-clusters) */}
        <g>
          <circle cx="990" cy="200" r="1.2"/><circle cx="1020" cy="200" r="1.2"/><circle cx="1050" cy="200" r="1.2"/><circle cx="1080" cy="200" r="1.2"/><circle cx="1110" cy="200" r="1.2"/><circle cx="1140" cy="200" r="1.2"/><circle cx="1170" cy="200" r="1.2"/><circle cx="1200" cy="200" r="1.2"/><circle cx="1230" cy="200" r="1.2"/><circle cx="1260" cy="200" r="1.2"/><circle cx="1290" cy="200" r="1.2"/><circle cx="1320" cy="200" r="1.2"/>
          <circle cx="1000" cy="225" r="1.2"/><circle cx="1030" cy="225" r="1.2"/><circle cx="1060" cy="225" r="1.2"/><circle cx="1090" cy="225" r="1.2"/><circle cx="1120" cy="225" r="1.2"/><circle cx="1150" cy="225" r="1.2"/><circle cx="1180" cy="225" r="1.2"/><circle cx="1210" cy="225" r="1.2"/><circle cx="1240" cy="225" r="1.2"/><circle cx="1270" cy="225" r="1.2"/><circle cx="1300" cy="225" r="1.2"/><circle cx="1330" cy="225" r="1.2"/>
          <circle cx="1010" cy="250" r="1.2"/><circle cx="1040" cy="250" r="1.2"/><circle cx="1070" cy="250" r="1.2"/><circle cx="1100" cy="250" r="1.2"/><circle cx="1130" cy="250" r="1.2"/><circle cx="1160" cy="250" r="1.2"/><circle cx="1190" cy="250" r="1.2"/><circle cx="1220" cy="250" r="1.2"/><circle cx="1250" cy="250" r="1.2"/><circle cx="1280" cy="250" r="1.2"/><circle cx="1310" cy="250" r="1.2"/>
          <circle cx="1020" cy="275" r="1.2"/><circle cx="1050" cy="275" r="1.2"/><circle cx="1080" cy="275" r="1.2"/><circle cx="1110" cy="275" r="1.2"/><circle cx="1140" cy="275" r="1.2"/><circle cx="1170" cy="275" r="1.2"/><circle cx="1200" cy="275" r="1.2"/><circle cx="1230" cy="275" r="1.2"/><circle cx="1260" cy="275" r="1.2"/><circle cx="1290" cy="275" r="1.2"/>
          <circle cx="1030" cy="300" r="1.2"/><circle cx="1060" cy="300" r="1.2"/><circle cx="1090" cy="300" r="1.2"/><circle cx="1120" cy="300" r="1.2"/><circle cx="1150" cy="300" r="1.2"/><circle cx="1180" cy="300" r="1.2"/><circle cx="1210" cy="300" r="1.2"/><circle cx="1240" cy="300" r="1.2"/><circle cx="1270" cy="300" r="1.2"/>
          {/* India */}
          <circle cx="1080" cy="325" r="1.2"/><circle cx="1100" cy="325" r="1.2"/><circle cx="1120" cy="325" r="1.2"/>
          <circle cx="1090" cy="350" r="1.2"/><circle cx="1110" cy="350" r="1.2"/>
          <circle cx="1100" cy="375" r="1.2"/>
          {/* SE Asia */}
          <circle cx="1200" cy="330" r="1.2"/><circle cx="1230" cy="330" r="1.2"/><circle cx="1260" cy="330" r="1.2"/>
          <circle cx="1220" cy="355" r="1.2"/><circle cx="1250" cy="355" r="1.2"/>
        </g>

        {/* Indonesia / Malaysia archipelago */}
        <g>
          <circle cx="1240" cy="410" r="1.2"/><circle cx="1265" cy="410" r="1.2"/><circle cx="1290" cy="410" r="1.2"/><circle cx="1315" cy="410" r="1.2"/><circle cx="1340" cy="410" r="1.2"/>
          <circle cx="1280" cy="435" r="1.2"/><circle cx="1305" cy="435" r="1.2"/><circle cx="1330" cy="435" r="1.2"/>
        </g>

        {/* Philippines */}
        <g>
          <circle cx="1340" cy="370" r="1.2"/><circle cx="1340" cy="390" r="1.2"/><circle cx="1340" cy="410" r="1.2"/>
        </g>

        {/* Japan / Korea */}
        <g>
          <circle cx="1380" cy="240" r="1.2"/><circle cx="1395" cy="260" r="1.2"/><circle cx="1410" cy="280" r="1.2"/>
          <circle cx="1340" cy="240" r="1.2"/><circle cx="1340" cy="260" r="1.2"/>
        </g>

        {/* Australia */}
        <g>
          <circle cx="1300" cy="540" r="1.2"/><circle cx="1330" cy="540" r="1.2"/><circle cx="1360" cy="540" r="1.2"/><circle cx="1390" cy="540" r="1.2"/><circle cx="1420" cy="540" r="1.2"/><circle cx="1450" cy="540" r="1.2"/>
          <circle cx="1310" cy="565" r="1.2"/><circle cx="1340" cy="565" r="1.2"/><circle cx="1370" cy="565" r="1.2"/><circle cx="1400" cy="565" r="1.2"/><circle cx="1430" cy="565" r="1.2"/><circle cx="1460" cy="565" r="1.2"/>
          <circle cx="1320" cy="590" r="1.2"/><circle cx="1350" cy="590" r="1.2"/><circle cx="1380" cy="590" r="1.2"/><circle cx="1410" cy="590" r="1.2"/><circle cx="1440" cy="590" r="1.2"/>
          <circle cx="1340" cy="615" r="1.2"/><circle cx="1370" cy="615" r="1.2"/><circle cx="1400" cy="615" r="1.2"/>
        </g>

        {/* New Zealand */}
        <g>
          <circle cx="1500" cy="620" r="1.2"/><circle cx="1510" cy="640" r="1.2"/>
        </g>
      </g>
    </svg>
  )
}
