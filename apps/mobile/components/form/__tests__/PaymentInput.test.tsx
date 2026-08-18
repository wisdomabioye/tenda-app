/**
 * PaymentInput — the budget field, in both entry modes.
 *
 * It had NO test before #32, which is how the float conversion
 * (`Math.round(units * 10 ** decimals)`) survived: an 18-decimal budget was
 * corrupted and nothing said so. What is proved here is that the text on
 * screen and the base-unit string handed out can never disagree.
 */
import { TextInput } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'

type Rates = Record<string, number> | null
let mockRates: Rates = null
let mockCurrency = 'NGN'
jest.mock('@/stores/exchange-rate.store', () => ({
  useExchangeRateStore: (sel: (s: { rates: Rates }) => unknown) => sel({ rates: mockRates }),
}))
jest.mock('@/stores/settings.store', () => ({
  useSettingsStore: (sel: (s: { currency: string }) => unknown) => sel({ currency: mockCurrency }),
}))
jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        brand: { primary: '#0a0', primarySurface: '#efe' },
        surface: { inset: '#eee' },
        content: { primary: '#000', tertiary: '#999' },
      },
    },
  }),
}))
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

import { PaymentInput } from '@/components/form/PaymentInput'

/** The SOL rate cache the component converts through. */
const RATES = { NGN: 150_000, USD: 100 }

function setup(value = '', asset = 'USDC_SOL') {
  const onChange = jest.fn()
  const view = render(<PaymentInput asset={asset} value={value} onChange={onChange} />)
  return { onChange, view, field: () => screen.UNSAFE_getByType(TextInput) }
}

/** Switch to the asset tab, whose label is the asset symbol. */
function toAssetMode(symbol = 'USDC') {
  fireEvent.press(screen.getByText(symbol))
}

beforeEach(() => {
  mockRates = RATES
  mockCurrency = 'NGN'
})

describe('ASSET mode', () => {
  test('emits a base-unit string at the asset decimals', () => {
    const { onChange, field } = setup()
    toAssetMode()
    fireEvent.changeText(field(), '12.5')
    expect(onChange).toHaveBeenLastCalledWith('12500000')
  })

  test('an 18-decimal budget survives exactly — what float math could not do', () => {
    const { onChange, field } = setup('', 'cUSD')
    toAssetMode('cUSD')
    fireEvent.changeText(field(), '1250.75')
    expect(onChange).toHaveBeenLastCalledWith('1250750000000000000000')
    expect(String(Math.round(1250.75 * 10 ** 18))).not.toBe('1250750000000000000000')
  })

  test('refuses the digit past the asset precision rather than rounding it', () => {
    const { onChange, field } = setup()
    toAssetMode()
    fireEvent.changeText(field(), '1.9999999')
    expect(field().props.value).toBe('1.999999')
    expect(onChange).toHaveBeenLastCalledWith('1999999')
  })

  test("clearing the field clears the budget, rather than leaving the last one", () => {
    const { onChange, field } = setup()
    toAssetMode()
    fireEvent.changeText(field(), '12')
    expect(onChange).toHaveBeenLastCalledWith('12000000')
    fireEvent.changeText(field(), '')
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  test('a LEADING decimal point is 0.x, not a vanished budget', () => {
    // '.5' is what a decimal-pad produces. It used to show in the field and
    // report no budget at all.
    const { onChange, field } = setup()
    toAssetMode()
    fireEvent.changeText(field(), '.5')
    expect(field().props.value).toBe('.5')
    expect(onChange).toHaveBeenLastCalledWith('500000')
  })

  test('a negative never enters the field, so no negative raw can be emitted', () => {
    const { onChange, field } = setup()
    toAssetMode()
    fireEvent.changeText(field(), '-5')
    expect(field().props.value).toBe('5')
    expect(onChange).toHaveBeenLastCalledWith('5000000')
  })
})

describe('FIAT mode', () => {
  test('converts the typed fiat amount through the rate into base units', () => {
    // Stables ride the USD leg: NGN-per-USDC = 150000/100 = 1500.
    // ₦150,000 / 1500 = 100 USDC = 100000000 base units.
    const { onChange, field } = setup()
    fireEvent.changeText(field(), '150000')
    expect(onChange).toHaveBeenLastCalledWith('100000000')
  })

  test('emits NOTHING while the rate is unknown, rather than mispricing by 1500x', () => {
    // The guard that matters: treating a fiat number as asset units would
    // escrow ₦150,000 as 150,000 USDC.
    mockRates = null
    const { onChange, field } = setup()
    fireEvent.changeText(field(), '150000')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('a fiat entry keeps 2 decimals — the asset precision does not apply to naira', () => {
    const { field } = setup()
    fireEvent.changeText(field(), '1500.756')
    expect(field().props.value).toBe('1500.75')
  })

  test('switching mode clears the budget, not just the text', () => {
    // The field is emptied on toggle; leaving the raw behind kept the step
    // satisfied by a number that was no longer on screen.
    const { onChange, field } = setup()
    fireEvent.changeText(field(), '150000')
    expect(onChange).toHaveBeenLastCalledWith('100000000')
    toAssetMode()
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(field().props.value).toBe('')
  })
})

test('seeds the field from an existing raw budget — a resumed draft', () => {
  const { field } = setup('2000000')
  expect(field().props.value).toBe('2')
})

test('seeds an 18-decimal draft without losing a digit', () => {
  const { field } = setup('1250750000000000000000', 'cUSD')
  expect(field().props.value).toBe('1250.75')
})

test('shows the budget rail in the asset being spent', () => {
  setup()
  expect(screen.getByText('Budget 1 – 50000 USDC')).toBeTruthy()
})
