# Warsh Dashboard: Metric Spec

## Primary source
**Kevin Warsh, "In Our Time"**, keynote at the Kansas City Fed's Jackson Hole symposium, Aug 28, 2026.
https://www.federalreserve.gov/newsevents/speech/warsh20260828a.htm

The speech lays out seven principles. Two of them shape this dashboard:
- **Principle 1:** trends matter most. Data should be "relevant, contemporaneous, accurate, and actionable."
- **Principle 6:** "money matters."

The speech has no charts. The metrics below come from its text. Values in "Speech value" are the figures he quoted as of Aug 2026.

**Secondary source:** Warsh's Senate confirmation hearing in April 2026, as reported by Yahoo Finance on Apr 26, 2026. There he favored trimmed-mean and median inflation measures over standard PCE.

## Tier 1: Inflation (the core of his speech)
| Metric | Speech value | Data series | Notes |
|---|---|---|---|
| PCE price index, 12-month change | 3.7% | FRED `PCEPI` | Headline gauge for the 2% target |
| PCE price index, 6-month change | 4.1% | FRED `PCEPI` | Calculated from the index; show it annualized and label it clearly |
| Core PCE | "elevated" | FRED `PCEPILFE` | |
| CPI / core CPI | "elevated" | FRED `CPIAUCSL`, `CPILFESL` | |
| **Breadth:** share of the 199 PCE components rising faster than 3% | 54% (12m), 49% (6m annualized); pre-pandemic about 32%, post-pandemic peak about 77% | BEA NIPA underlying detail, Table 2.4.4U | His signature metric. No ready-made series exists, so we compute it from the 221 most detailed lines. Using current data, the replication gives 50.7% / 48.4% for Jul 2026, a 31.7% pre-pandemic average and a 74.4% peak |
| Dallas Fed trimmed-mean PCE | 2.3% (April) | FRED `PCETRIM12M159SFRBDAL` | From the April hearing |
| Cleveland Fed median PCE | 2.8% (April) | Cleveland Fed `median-pce-full-history.csv` | From the April hearing |
| Inflation expectations | "stable" | FRED `T5YIFR` (5y5y), `T5YIE`, `MICH` | The speech cited swaps-based inflation compensation, which isn't free. Breakevens are the closest free substitute |
| Commodity prices | "bears watching" | FRED `PALLFNFINDEXM` (IMF all-commodity index) | |
| Wage growth | "moderate" | FRED `ECIWAG`, Atlanta Fed Wage Tracker | He said wages are *not* a reliable inflation signal, so show them but give them less weight |

## Tier 2: Demand and activity
| Metric | Speech value | Data series |
|---|---|---|
| Investment in equipment and intellectual property (intangibles), 4-quarter change | about 9%, highest since 2021 | FRED `Y033RX1Q020SBEA` + `Y001RX1Q020SBEA` (real) |
| Real consumer spending, 4-quarter change | >2% | FRED `PCEC96` |
| Private domestic final purchases | about 3% year to date | FRED `LB0000031Q020SBEA` (real final sales to private domestic purchasers, verified) |
| Corporate profits, 4-quarter change | S&P 500 profits >20% YoY | FRED `CP` (all U.S. corporate profits from the national accounts, used in place of S&P 500 earnings; label the tile accordingly) |

## Tier 3: Labor
| Metric | Speech value | Data series |
|---|---|---|
| Unemployment rate | 4.1% | FRED `UNRATE` |
| Initial jobless claims, 4-week average ("real-time indicator") | near multi-decade lows | FRED `IC4WSA` |
| Payroll gains | expected to run "low" | FRED `PAYEMS` |

## Tier 4: Financial conditions (he said conditions are not restrictive)
| Metric | Data series |
|---|---|
| Investment-grade and high-yield corporate spreads | FRED `BAMLC0A0CM`, `BAMLH0A0HYM2` |
| Senior Loan Officer Survey: C&I lending standards | FRED `DRTSCILM` |
| Equity volatility | FRED `VIXCLS` |
| Broad trade-weighted dollar | FRED `DTWEXBGS` |
| Treasury yields (2-year, 10-year) | FRED `DGS2`, `DGS10` |
| Fed funds target range | FRED `DFEDTARU`, `DFEDTARL` |

## Tier 5: Money and the balance sheet ("money matters")
| Metric | Data series |
|---|---|
| Fed balance sheet (total assets) | FRED `WALCL` |
| Monetary base | FRED `BOGMBASE` |
| M2 money supply | FRED `M2SL` |

The balance sheet is a long-running Warsh theme, but he did **not** discuss it in the Jackson Hole speech.

## Not available for free (leave out or substitute)
- Leveraged loan spreads
- Swaps-based inflation compensation
- S&P 500 earnings (free S&P spreadsheet exists but is not automatable or licensed for republishing; using FRED `CP` instead)
- Treasury trading volumes
- AI "token sales" (an anecdote in the speech, not a data series)

## Corrections to press coverage
- CPI at 3.4% comes from CNBC, not the speech.
- The 6-month 4.1% is not labeled "annualized" in the speech.
- The speech does not cite the Dallas or Cleveland trimmed and median measures. Those come from the April hearing.
