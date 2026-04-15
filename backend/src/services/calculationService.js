import dayjs from 'dayjs'

export const simpleInterest = ({ principal, rate, timeInYears }) => Number((principal * rate * timeInYears).toFixed(2))

export const capitalGain = ({ sellingPrice, buyingPrice }) => Number((sellingPrice - buyingPrice).toFixed(2))

export const dividend = ({ shares, dividendRate }) => Number((shares * dividendRate).toFixed(2))

export const recalcInvestment = (investment) => {
  const durationYears = investment.duration / 12
  const interest = simpleInterest({ principal: Number(investment.principal), rate: Number(investment.interestRate), timeInYears: durationYears })
  const maturityDate = dayjs(investment.startDate).add(investment.duration, 'month').toDate()
  const capGain = investment.sellingPrice && investment.buyingPrice
    ? capitalGain({ sellingPrice: Number(investment.sellingPrice), buyingPrice: Number(investment.buyingPrice) })
    : 0
  const div = investment.shares && investment.dividendRate
    ? dividend({ shares: Number(investment.shares), dividendRate: Number(investment.dividendRate) })
    : 0
  return { interest, maturityDate, capGain, div }
}
