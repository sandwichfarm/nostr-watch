/**
 * ISO 3166-1 Country Code Normalization
 *
 * Normalizes Alpha-3 and numeric codes to Alpha-2.
 * Unknown inputs are returned as-is (uppercased).
 */

// Alpha-3 → Alpha-2
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', ASM: 'AS', AND: 'AD', AGO: 'AO', AIA: 'AI',
  ATA: 'AQ', ATG: 'AG', ARG: 'AR', ARM: 'AM', ABW: 'AW', AUS: 'AU', AUT: 'AT',
  AZE: 'AZ', BHS: 'BS', BHR: 'BH', BGD: 'BD', BRB: 'BB', BLR: 'BY', BEL: 'BE',
  BLZ: 'BZ', BEN: 'BJ', BMU: 'BM', BTN: 'BT', BOL: 'BO', BES: 'BQ', BIH: 'BA',
  BWA: 'BW', BVT: 'BV', BRA: 'BR', IOT: 'IO', BRN: 'BN', BGR: 'BG', BFA: 'BF',
  BDI: 'BI', CPV: 'CV', KHM: 'KH', CMR: 'CM', CAN: 'CA', CYM: 'KY', CAF: 'CF',
  TCD: 'TD', CHL: 'CL', CHN: 'CN', CXR: 'CX', CCK: 'CC', COL: 'CO', COM: 'KM',
  COD: 'CD', COG: 'CG', COK: 'CK', CRI: 'CR', HRV: 'HR', CUB: 'CU', CUW: 'CW',
  CYP: 'CY', CZE: 'CZ', CIV: 'CI', DNK: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO',
  ECU: 'EC', EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER', EST: 'EE', SWZ: 'SZ',
  ETH: 'ET', FLK: 'FK', FRO: 'FO', FJI: 'FJ', FIN: 'FI', FRA: 'FR', GUF: 'GF',
  PYF: 'PF', ATF: 'TF', GAB: 'GA', GMB: 'GM', GEO: 'GE', DEU: 'DE', GHA: 'GH',
  GIB: 'GI', GRC: 'GR', GRL: 'GL', GRD: 'GD', GLP: 'GP', GUM: 'GU', GTM: 'GT',
  GGY: 'GG', GIN: 'GN', GNB: 'GW', GUY: 'GY', HTI: 'HT', HMD: 'HM', VAT: 'VA',
  HND: 'HN', HKG: 'HK', HUN: 'HU', ISL: 'IS', IND: 'IN', IDN: 'ID', IRN: 'IR',
  IRQ: 'IQ', IRL: 'IE', IMN: 'IM', ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP',
  JEY: 'JE', JOR: 'JO', KAZ: 'KZ', KEN: 'KE', KIR: 'KI', PRK: 'KP', KOR: 'KR',
  KWT: 'KW', KGZ: 'KG', LAO: 'LA', LVA: 'LV', LBN: 'LB', LSO: 'LS', LBR: 'LR',
  LBY: 'LY', LIE: 'LI', LTU: 'LT', LUX: 'LU', MAC: 'MO', MDG: 'MG', MWI: 'MW',
  MYS: 'MY', MDV: 'MV', MLI: 'ML', MLT: 'MT', MHL: 'MH', MTQ: 'MQ', MRT: 'MR',
  MUS: 'MU', MYT: 'YT', MEX: 'MX', FSM: 'FM', MDA: 'MD', MCO: 'MC', MNG: 'MN',
  MNE: 'ME', MSR: 'MS', MAR: 'MA', MOZ: 'MZ', MMR: 'MM', NAM: 'NA', NRU: 'NR',
  NPL: 'NP', NLD: 'NL', NCL: 'NC', NZL: 'NZ', NIC: 'NI', NER: 'NE', NGA: 'NG',
  NIU: 'NU', NFK: 'NF', MKD: 'MK', MNP: 'MP', NOR: 'NO', OMN: 'OM', PAK: 'PK',
  PLW: 'PW', PSE: 'PS', PAN: 'PA', PNG: 'PG', PRY: 'PY', PER: 'PE', PHL: 'PH',
  PCN: 'PN', POL: 'PL', PRT: 'PT', PRI: 'PR', QAT: 'QA', ROU: 'RO', RUS: 'RU',
  RWA: 'RW', REU: 'RE', BLM: 'BL', SHN: 'SH', KNA: 'KN', LCA: 'LC', MAF: 'MF',
  SPM: 'PM', VCT: 'VC', WSM: 'WS', SMR: 'SM', STP: 'ST', SAU: 'SA', SEN: 'SN',
  SRB: 'RS', SYC: 'SC', SLE: 'SL', SGP: 'SG', SXM: 'SX', SVK: 'SK', SVN: 'SI',
  SLB: 'SB', SOM: 'SO', ZAF: 'ZA', SGS: 'GS', SSD: 'SS', ESP: 'ES', LKA: 'LK',
  SDN: 'SD', SUR: 'SR', SJM: 'SJ', SWE: 'SE', CHE: 'CH', SYR: 'SY', TWN: 'TW',
  TJK: 'TJ', TZA: 'TZ', THA: 'TH', TLS: 'TL', TGO: 'TG', TKL: 'TK', TON: 'TO',
  TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', TCA: 'TC', TUV: 'TV', UGA: 'UG',
  UKR: 'UA', ARE: 'AE', GBR: 'GB', USA: 'US', UMI: 'UM', URY: 'UY', UZB: 'UZ',
  VUT: 'VU', VEN: 'VE', VNM: 'VN', VGB: 'VG', VIR: 'VI', WLF: 'WF', ESH: 'EH',
  YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW', ALA: 'AX',
}

// Numeric → Alpha-2
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '004': 'AF', '008': 'AL', '012': 'DZ', '016': 'AS', '020': 'AD', '024': 'AO',
  '660': 'AI', '010': 'AQ', '028': 'AG', '032': 'AR', '051': 'AM', '533': 'AW',
  '036': 'AU', '040': 'AT', '031': 'AZ', '044': 'BS', '048': 'BH', '050': 'BD',
  '052': 'BB', '112': 'BY', '056': 'BE', '084': 'BZ', '204': 'BJ', '060': 'BM',
  '064': 'BT', '068': 'BO', '535': 'BQ', '070': 'BA', '072': 'BW', '074': 'BV',
  '076': 'BR', '086': 'IO', '096': 'BN', '100': 'BG', '854': 'BF', '108': 'BI',
  '132': 'CV', '116': 'KH', '120': 'CM', '124': 'CA', '136': 'KY', '140': 'CF',
  '148': 'TD', '152': 'CL', '156': 'CN', '162': 'CX', '166': 'CC', '170': 'CO',
  '174': 'KM', '180': 'CD', '178': 'CG', '184': 'CK', '188': 'CR', '191': 'HR',
  '192': 'CU', '531': 'CW', '196': 'CY', '203': 'CZ', '384': 'CI', '208': 'DK',
  '262': 'DJ', '212': 'DM', '214': 'DO', '218': 'EC', '818': 'EG', '222': 'SV',
  '226': 'GQ', '232': 'ER', '233': 'EE', '748': 'SZ', '231': 'ET', '238': 'FK',
  '234': 'FO', '242': 'FJ', '246': 'FI', '250': 'FR', '254': 'GF', '258': 'PF',
  '260': 'TF', '266': 'GA', '270': 'GM', '268': 'GE', '276': 'DE', '288': 'GH',
  '292': 'GI', '300': 'GR', '304': 'GL', '308': 'GD', '312': 'GP', '316': 'GU',
  '320': 'GT', '831': 'GG', '324': 'GN', '624': 'GW', '328': 'GY', '332': 'HT',
  '334': 'HM', '336': 'VA', '340': 'HN', '344': 'HK', '348': 'HU', '352': 'IS',
  '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ', '372': 'IE', '833': 'IM',
  '376': 'IL', '380': 'IT', '388': 'JM', '392': 'JP', '832': 'JE', '400': 'JO',
  '398': 'KZ', '404': 'KE', '296': 'KI', '408': 'KP', '410': 'KR', '414': 'KW',
  '417': 'KG', '418': 'LA', '428': 'LV', '422': 'LB', '426': 'LS', '430': 'LR',
  '434': 'LY', '438': 'LI', '440': 'LT', '442': 'LU', '446': 'MO', '450': 'MG',
  '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '584': 'MH',
  '474': 'MQ', '478': 'MR', '480': 'MU', '175': 'YT', '484': 'MX', '583': 'FM',
  '498': 'MD', '492': 'MC', '496': 'MN', '499': 'ME', '500': 'MS', '504': 'MA',
  '508': 'MZ', '104': 'MM', '516': 'NA', '520': 'NR', '524': 'NP', '528': 'NL',
  '540': 'NC', '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '570': 'NU',
  '574': 'NF', '807': 'MK', '580': 'MP', '578': 'NO', '512': 'OM', '586': 'PK',
  '585': 'PW', '275': 'PS', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE',
  '608': 'PH', '612': 'PN', '616': 'PL', '620': 'PT', '630': 'PR', '634': 'QA',
  '642': 'RO', '643': 'RU', '646': 'RW', '638': 'RE', '652': 'BL', '654': 'SH',
  '659': 'KN', '662': 'LC', '663': 'MF', '666': 'PM', '670': 'VC', '882': 'WS',
  '674': 'SM', '678': 'ST', '682': 'SA', '686': 'SN', '688': 'RS', '690': 'SC',
  '694': 'SL', '702': 'SG', '534': 'SX', '703': 'SK', '705': 'SI', '090': 'SB',
  '706': 'SO', '710': 'ZA', '239': 'GS', '728': 'SS', '724': 'ES', '144': 'LK',
  '729': 'SD', '740': 'SR', '744': 'SJ', '752': 'SE', '756': 'CH', '760': 'SY',
  '158': 'TW', '762': 'TJ', '834': 'TZ', '764': 'TH', '626': 'TL', '768': 'TG',
  '772': 'TK', '776': 'TO', '780': 'TT', '788': 'TN', '792': 'TR', '795': 'TM',
  '796': 'TC', '798': 'TV', '800': 'UG', '804': 'UA', '784': 'AE', '826': 'GB',
  '840': 'US', '581': 'UM', '858': 'UY', '860': 'UZ', '548': 'VU', '862': 'VE',
  '704': 'VN', '092': 'VG', '850': 'VI', '876': 'WF', '732': 'EH', '887': 'YE',
  '894': 'ZM', '716': 'ZW', '248': 'AX',
}

// Known Alpha-2 codes (for fast validation)
const ALPHA2_CODES = new Set(Object.values(ALPHA3_TO_ALPHA2))
// Also add codes that only appear directly
for (const code of Object.values(NUMERIC_TO_ALPHA2)) {
  ALPHA2_CODES.add(code)
}

/**
 * Normalize a country code to ISO 3166-1 Alpha-2.
 * Accepts Alpha-2, Alpha-3, or numeric (with or without leading zeros).
 * Returns uppercase Alpha-2, or the uppercased input if unrecognized.
 */
export function normalizeCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()

  // Already Alpha-2?
  if (upper.length === 2 && ALPHA2_CODES.has(upper)) {
    return upper
  }

  // Alpha-3?
  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
    return ALPHA3_TO_ALPHA2[upper] ?? upper
  }

  // Numeric (may be 1-3 digits)?
  if (/^\d{1,3}$/.test(upper)) {
    const padded = upper.padStart(3, '0')
    return NUMERIC_TO_ALPHA2[padded] ?? upper
  }

  return upper
}
