# TOS Signal Badge

Thinkorswim (ThinkScript) study: **Signal Badge v2.0** — a composite score from seven indicator groups, shown as **color-coded labels** on the chart (intraday-oriented; see script header for scoring and overrides).

## Repository layout

| Path | Purpose |
|------|---------|
| `thinkscript/SignalBadge_v2.ts` | **Main study** — paste into Thinkorswim (ThinkScript; `.ts` is for editor recognition, not TypeScript) |
| `docs/ThinkScript_Signal_Badge_Execution_Plan.docx` | Execution plan (methodology / rollout) |

## Install in Thinkorswim

1. Open a chart (candlesticks recommended; script targets **1m–15m intraday** per its comments).
2. **Studies** → **Edit studies…** → **Create…**
3. Paste the full contents of `thinkscript/SignalBadge_v2.ts`.
4. **Save** (e.g. `SignalBadge_v2`) → **OK** → add the study to the chart.

Labels appear in the study/label area; optional SuperTrend/VWAP plots are commented at the bottom of the file.

## Configuration

Use the **inputs** at the top of the script (SuperTrend, ADX, VWAP bands, volume length, squeeze, pivot lookback, HTF aggregation, tier weights, `show_override_label`, etc.). The file header documents score bands, tier weights, and hard overrides (for example `ADX < 20`).

## Requirements

- [Thinkorswim](https://www.thinkorswim.com/) with ThinkScript studies enabled.

## Disclaimer

Not financial advice. Indicators are lagging; backtest and paper trade before live use.
