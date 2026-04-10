# TOS Signal Badge

Thinkorswim (ThinkScript) study that draws **trading signal badges** on **Japanese candlestick** charts—chart bubbles and optional arrows when your conditions are true.

## Repository layout

| Path | Purpose |
|------|---------|
| `thinkscript/SignalBadgeCandles.thinkscript` | Main study source (copy/paste into TOS) |

## Install in Thinkorswim

1. Open **Charts** on a symbol with **Candle** chart type (Japanese candles).
2. **Studies** → **Edit studies…** → **Create…**
3. Delete the template, paste the contents of `thinkscript/SignalBadgeCandles.thinkscript`.
4. **Save** as `SignalBadgeCandles` (or any name) → **OK**.
5. **Studies** → **Add study** → choose your saved study.

## Customize signals

Edit the `bullSignal` and `bearSignal` definitions in the study. The defaults are simple placeholders (direction + volume); replace them with your indicators, price patterns, or conditions from your trading plan.

## Inputs

- **showBullishBadges / showBearishBadges** — toggle long/short markers.
- **useChartBubbles** — text bubbles on bars; when off, arrows only (if not hidden).
- **bubbleOffsetTicks** — vertical spacing from the candle high/low.
- **badgeTextBull / badgeTextBear** — label text for each side.

## Requirements

- [Thinkorswim](https://www.thinkorswim.com/) desktop or web (ThinkScript features vary slightly by platform; this targets the standard chart study API).

## Disclaimer

This is educational scaffolding, not financial advice. Test on historical data and paper trading before relying on any signal logic.
