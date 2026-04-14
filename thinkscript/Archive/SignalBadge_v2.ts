#=============================================================================
# THINKSCRIPT SIGNAL BADGE v2.0
# Composite Indicator Scoring System for ThinkorSwim
# April 2026 — Revised Methodology
#
# DESCRIPTION:
#   Consolidates 7 indicator categories into a single weighted score displayed
#   as a color-coded label on the price chart. Designed for intraday use only
#   (1-minute through 15-minute charts, regular trading hours).
#   Visual arrows with S/W strength labels added in v2.1
#
# SCORING:
#   +7 to +11  → STRONG BUY  — CALL  (Bright Green)
#   +4 to +6   → WEAK BUY   — CALL  (Light Green)
#   -3 to +3   → NO TRADE          (Gray)
#   -4 to -6   → WEAK SELL  — PUT   (Light Red)
#   -7 to -11  → STRONG SELL — PUT  (Bright Red)
#
# TIER WEIGHTS:
#   Tier 1 (×2): SuperTrend, VWAP, TTM Squeeze
#   Tier 2 (×1): 15m HTF Bias, Volume, ADX, Pivot/ScalerAlert
#   Max Score: ±11
#
# OVERRIDES:
#   ADX < 15             → Hard NO TRADE (regardless of score)
#   Active count < 5     → INSUFFICIENT DATA
#   ADX 15–25            → Score penalty: -2
#   Volume < average     → Score penalty: -2
#   ST/HTF conflict      → Score penalty: -1
#
# KNOWN LIMITATIONS:
#   - Intraday only. VWAP resets daily; unreliable on daily+ timeframes.
#   - All indicators are lagging/coincident. Not predictive.
#   - ScalerAlert pivot uses swing high/low approximation (not proprietary logic).
#   - VWAP unstable in first 30 minutes of session.
#   - Uses close[1] (prior confirmed bar) for all signals.
#
# CHANGES FROM ORIGINAL BLUEPRINT:
#   1. TTM Squeeze consolidated from 2 votes → 1 composite (anti-multicollinearity)
#   2. ADX: hard override < 15; penalty 15–25 (Wilder 1978)
#   3. Volume < avg converted from hard NO TRADE → penalty -2
#   4. ST/HTF conflict converted from hard NO TRADE → penalty -1
#   5. SuperTrend gray state removed (ADX handles chop detection)
#   6. Tier 1/Tier 2 weighting added (was equal weight)
#   7. INSUFFICIENT DATA rule added for < 5 active indicators
#   8. [Confirmed] tag added; all calcs use close[1]
#=============================================================================

declare upper;

#-----------------------------------------------------------------------------
# PHASE 1: INPUT PARAMETERS
#-----------------------------------------------------------------------------

input show_arrows = yes;
# Chart bubbles are fixed-size in Thinkorswim (often large). Off by default; arrow line weight still shows S vs W (5 vs 3).
input show_strength_bubbles = no;

# SuperTrend
input st_atr_period   = 10;
input st_multiplier   = 3.0;

# ADX
input adx_length      = 14;

# VWAP
input vwap_num_dev_dn = -2.0;
input vwap_num_dev_up =  2.0;

# Volume
input vol_avg_length  = 50;

# TTM Squeeze (Bollinger Bands + Keltner Channel)
input sq_bb_length    = 20;
input sq_bb_mult      = 2.0;
input sq_kc_length    = 20;
input sq_kc_mult      = 1.5;
input sq_hist_length  = 12;

# Pivot / ScalerAlert
input pivot_lookback  = 5;

# HTF Bias
input htf_aggregation = AggregationPeriod.FIFTEEN_MIN;

# Tier Weights (adjustable without code edits)
input tier1_weight    = 2;
input tier2_weight    = 1;

# Display options
input show_detail_label   = yes;
input show_override_label = yes;

#-----------------------------------------------------------------------------
# PHASE 2: INDICATOR RECALCULATION ENGINE
#-----------------------------------------------------------------------------

#--- 2A. SUPERTREND -----------------------------------------------------------
def st_atr     = Average(TrueRange(high, close, low), st_atr_period);
def st_upper   = HL2 + st_multiplier * st_atr;
def st_lower   = HL2 - st_multiplier * st_atr;

def st_upper_b;
def st_lower_b;
def st_trend;

st_upper_b = if close[1] > st_upper_b[1] then Min(st_upper, st_upper_b[1]) else st_upper;
st_lower_b = if close[1] < st_lower_b[1] then Max(st_lower, st_lower_b[1]) else st_lower;
st_trend   = if close > st_upper_b[1] then 1 else if close < st_lower_b[1] then -1 else st_trend[1];

def stBull = st_trend[1] == 1;   # Use confirmed (prior) bar
def stBear = st_trend[1] == -1;
def stActive = 1;                 # SuperTrend always produces a reading

#--- 2B. VWAP -----------------------------------------------------------------
def vwap_sum_pv = CompoundValue(1, vwap_sum_pv[1] + close * volume, close * volume);
def vwap_sum_v  = CompoundValue(1, vwap_sum_v[1]  + volume, volume);
def vwapLine    = vwap_sum_pv / vwap_sum_v;

def vwap_sq_sum = CompoundValue(1, vwap_sq_sum[1] + Sqr(close - vwapLine) * volume, 0);
def vwap_vdev   = Sqrt(vwap_sq_sum / vwap_sum_v);
def vwapUpper   = vwapLine + vwap_num_dev_up * vwap_vdev;
def vwapLower   = vwapLine + vwap_num_dev_dn * vwap_vdev;

def vwapAbove   = close[1] > vwapLine[1];
def vwapBelow   = close[1] < vwapLine[1];
def vwapActive  = 1;

#--- 2C. TTM SQUEEZE (single composite vote) ---------------------------------
# Bollinger Bands
def sq_basis  = Average(close, sq_bb_length);
def sq_dev    = StDev(close, sq_bb_length);
def sq_bb_up  = sq_basis + sq_bb_mult * sq_dev;
def sq_bb_dn  = sq_basis - sq_bb_mult * sq_dev;

# Keltner Channel
def sq_kc_atr = Average(TrueRange(high, close, low), sq_kc_length);
def sq_kc_up  = Average(close, sq_kc_length) + sq_kc_mult * sq_kc_atr;
def sq_kc_dn  = Average(close, sq_kc_length) - sq_kc_mult * sq_kc_atr;

# Squeeze state: BB inside KC
def squeezeOn = sq_bb_up <= sq_kc_up and sq_bb_dn >= sq_kc_dn;

# Momentum histogram via linear regression of midline delta
def sq_delta  = close - Average(Highest(high, sq_kc_length) + Lowest(low, sq_kc_length), 2) / 2 + Average(close, sq_kc_length) / 2;
def sq_hist   = Inertia(sq_delta, sq_hist_length);

# Composite vote: squeeze just fired + histogram direction
def sqFired   = squeezeOn[1] and !squeezeOn;   # Fired on prior confirmed bar
def sqGreen   = sq_hist[1] > 0;
def sqRed     = sq_hist[1] < 0;
def squeezeActive = 1;

#--- 2D. ADX ------------------------------------------------------------------
def adx_hi_diff  = high  - high[1];
def adx_lo_diff  = low[1] - low;
def adx_dm_plus  = if adx_hi_diff > adx_lo_diff and adx_hi_diff > 0 then adx_hi_diff else 0;
def adx_dm_minus = if adx_lo_diff > adx_hi_diff and adx_lo_diff > 0 then adx_lo_diff else 0;
def adx_tr       = TrueRange(high, close, low);

def adx_sm_tr    = CompoundValue(1, adx_sm_tr[1] - adx_sm_tr[1] / adx_length + adx_tr, adx_tr);
def adx_sm_plus  = CompoundValue(1, adx_sm_plus[1]  - adx_sm_plus[1]  / adx_length + adx_dm_plus,  adx_dm_plus);
def adx_sm_minus = CompoundValue(1, adx_sm_minus[1] - adx_sm_minus[1] / adx_length + adx_dm_minus, adx_dm_minus);

def plusDI   = 100 * adx_sm_plus  / adx_sm_tr;
def minusDI  = 100 * adx_sm_minus / adx_sm_tr;
def adx_di_diff = AbsValue(plusDI - minusDI);
def adx_di_sum  = plusDI + minusDI;
def adx_dx      = if adx_di_sum == 0 then 0 else 100 * adx_di_diff / adx_di_sum;
def adxValue    = CompoundValue(1, (adxValue[1] * (adx_length - 1) + adx_dx) / adx_length, adx_dx);

def adxStrong  = adxValue[1] >= 25 and adxValue[1] > adxValue[2];
def adxGrayZone = adxValue[1] >= 15 and adxValue[1] < 25;
def adxWeak    = adxValue[1] < 15;
def adxActive  = 1;

#--- 2E. VOLUME ---------------------------------------------------------------
def volAvg      = Average(volume, vol_avg_length);
def volAboveAvg = volume[1] >= volAvg[1];
def volActive   = 1;

#--- 2F. 15-MINUTE HTF BIAS ---------------------------------------------------
def htf_close = close(period = htf_aggregation);
def htf_st_atr   = Average(TrueRange(high(period = htf_aggregation), close(period = htf_aggregation), low(period = htf_aggregation)), st_atr_period);
def htf_upper_raw = (high(period = htf_aggregation) + low(period = htf_aggregation)) / 2 + st_multiplier * htf_st_atr;
def htf_lower_raw = (high(period = htf_aggregation) + low(period = htf_aggregation)) / 2 - st_multiplier * htf_st_atr;

def htf_upper_b;
def htf_lower_b;
def htf_trend;

htf_upper_b = if htf_close[1] > htf_upper_b[1] then Min(htf_upper_raw, htf_upper_b[1]) else htf_upper_raw;
htf_lower_b = if htf_close[1] < htf_lower_b[1] then Max(htf_lower_raw, htf_lower_b[1]) else htf_lower_raw;
htf_trend   = if htf_close > htf_upper_b[1] then 1 else if htf_close < htf_lower_b[1] then -1 else htf_trend[1];

def htfBull   = htf_trend[1] == 1;
def htfBear   = htf_trend[1] == -1;
def htfActive = 1;

#--- 2G. PIVOT / SCALERALERT --------------------------------------------------
def pivotHigh_raw = Highest(high, pivot_lookback);
def pivotLow_raw  = Lowest(low,  pivot_lookback);

# Central Pivot Point from prior session (daily high/low/close)
def daily_high   = high(period = AggregationPeriod.DAY)[1];
def daily_low    = low(period  = AggregationPeriod.DAY)[1];
def daily_close  = close(period = AggregationPeriod.DAY)[1];
def ppLevel      = (daily_high + daily_low + daily_close) / 3;

def abovePP   = close[1] > ppLevel;
def aboveSwingLow = low[1] > pivotLow_raw[1];
def belowSwingHigh = high[1] < pivotHigh_raw[1];

def pivotBull = abovePP and aboveSwingLow;
def pivotBear = !abovePP and !aboveSwingLow;
def pivotActive = if daily_high > 0 and daily_low > 0 then 1 else 0;

#-----------------------------------------------------------------------------
# PHASE 3: SCORING ENGINE AND OVERRIDE LOGIC
#-----------------------------------------------------------------------------

#--- 3A. ACTIVE INDICATOR COUNT -----------------------------------------------
def activeCount = stActive + vwapActive + squeezeActive + adxActive + volActive + htfActive + pivotActive;

#--- 3B. INDIVIDUAL VOTES (before weighting) ----------------------------------

# SuperTrend vote: +1 bull / -1 bear
def stVote = if stBull then 1 else if stBear then -1 else 0;

# VWAP vote only counts when price is meaningfully away from VWAP (else neutral)
def vwapDist = AbsValue(close[1] - vwapLine[1]) / vwapLine[1] * 100;
def vwapVote = if vwapDist < 0.1 then 0
               else if vwapAbove then 1
               else if vwapBelow then -1
               else 0;

# TTM Squeeze composite vote:
#   Fired + green histogram = +1 (bullish momentum release)
#   Fired + red histogram   = -1 (bearish momentum release)
#   Squeeze on              = 0  (coiling, no directional signal)
#   No squeeze + histogram  = partial credit: direction only
def sqVote = if squeezeOn[1] then 0
             else if sqGreen then 1
             else if sqRed   then -1
             else 0;

# ADX vote: strong + rising = +1 (trend confirmation); weak/declining = 0
# Direction comes from ST/HTF; ADX just confirms strength
def adxVote = if adxStrong then 1 else 0;

# Volume vote: above average = +1; below = 0 (penalty applied separately)
def volVote = if volAboveAvg then 1 else 0;

# HTF only penalizes conflict (see penaltySTHTF); doesn't add HTF conviction vs SuperTrend
def htfVote = if htfBull and stBull then 1
              else if htfBear and stBear then -1
              else 0;

# Pivot vote: +1 bull structure / -1 bear structure / 0 neutral
def pivotVote = if pivotActive == 0 then 0
                else if pivotBull  then 1
                else if pivotBear  then -1
                else 0;

#--- 3C. RAW WEIGHTED SCORE ---------------------------------------------------
def rawScore =
    stVote     * tier1_weight +
    vwapVote   * tier1_weight +
    sqVote     * tier1_weight +
    htfVote    * tier2_weight +
    volVote    * tier2_weight +
    adxVote    * tier2_weight +
    pivotVote  * tier2_weight;

#--- 3D. SCORE PENALTIES ------------------------------------------------------
def penaltyVol    = if !volAboveAvg then -2 else 0;
def penaltyADX    = if adxGrayZone  then -2 else 0;
def penaltySTHTF  = if (stBull and htfBear) or (stBear and htfBull) then -1 else 0;
def totalPenalty  = penaltyVol + penaltyADX + penaltySTHTF;

def adjustedScore = rawScore + totalPenalty;

# Fast-lane bearish: price below VWAP + squeeze histogram red +
# ST bearish OR HTF bearish (only one needs to confirm)
def bearFastLane = close[1] < vwapLine[1]
                   and sqRed
                   and !squeezeOn[1]
                   and (stBear or htfBear)
                   and adxValue[1] >= 15;

# Fast-lane bullish: mirror condition
def bullFastLane = close[1] > vwapLine[1]
                   and sqGreen
                   and !squeezeOn[1]
                   and (stBull or htfBull)
                   and adxValue[1] >= 15;

#--- 3E. HARD OVERRIDES -------------------------------------------------------
# 0 = normal scoring, 1 = force NO TRADE, 2 = INSUFFICIENT DATA
def overrideState =
    if activeCount < 5             then 2
    else if adxWeak                then 1
    else                                0;

#--- 3F. SIGNAL CLASSIFICATION ------------------------------------------------
# Signal codes: 4=STRONG BUY, 3=WEAK BUY, 2=NO TRADE, 1=WEAK SELL, 0=STRONG SELL, -1=INSUFFICIENT DATA
def signalCode =
    if overrideState == 2          then -1   # INSUFFICIENT DATA
    else if overrideState == 1     then 2    # Hard NO TRADE (ADX < 15)
    else if bearFastLane
         and adjustedScore <= -2   then 1    # Fast-lane WEAK SELL
    else if bullFastLane
         and adjustedScore >= 2    then 3    # Fast-lane WEAK BUY
    else if adjustedScore >= 7     then 4    # STRONG BUY
    else if adjustedScore >= 4     then 3    # WEAK BUY
    else if adjustedScore <= -7    then 0    # STRONG SELL
    else if adjustedScore <= -4    then 1    # WEAK SELL
    else                                2;   # NO TRADE

#-----------------------------------------------------------------------------
# PHASE 4: DISPLAY AND LABEL RENDERING
#-----------------------------------------------------------------------------

#--- 4A. SIGNAL BADGE COLORS --------------------------------------------------
def labelColor =
    if signalCode == 4  then 1   # Bright Green
    else if signalCode == 3 then 2   # Light Green
    else if signalCode == 1 then 3   # Light Red
    else if signalCode == 0 then 4   # Bright Red
    else                       5;    # Gray / White

#--- 4B. INDICATOR STATE ABBREVIATIONS ----------------------------------------
# ThinkScript doesn't support string variables, so we encode states numerically
# and use conditional label text.

# ST: Bull / Bear
def stState = if stBull then 1 else -1;

# VWAP: Above / Below
def vwapState = if vwapAbove then 1 else -1;

# Squeeze: Green / Red / On (coiling)
def sqState = if squeezeOn[1] then 0 else if sqGreen then 1 else -1;

# ADX display value (rounded)
def adxDisplay = Round(adxValue[1], 0);

# HTF: Bull / Bear
def htfState = if htfBull then 1 else -1;

# Pivot: + / -
def pvtState = if pivotBull then 1 else if pivotBear then -1 else 0;

# Vol: High / Low
def volState = if volAboveAvg then 1 else -1;

#--- 4C. PRIMARY SIGNAL LABEL -------------------------------------------------
# Format: SIGNAL [SCORE] [Confirmed] ST:X VWAP:X Vol:X Sqz:X ADX:XX HTF:X Pvt:X

AddLabel(signalCode == 4,
    "STRONG BUY — CALL" +
    " [+" + adjustedScore + "]" +
    " [Confirmed]" +
    " ST:" + (if stState == 1 then "Bull" else "Bear") +
    " VWAP:" + (if vwapState == 1 then "Above" else "Below") +
    " Vol:" + (if volState == 1 then "High" else "Low") +
    " Sqz:" + (if sqState == 1 then "Green" else if sqState == -1 then "Red" else "On") +
    " ADX:" + adxDisplay +
    " HTF:" + (if htfState == 1 then "Bull" else "Bear") +
    " Pvt:" + (if pvtState == 1 then "+" else if pvtState == -1 then "-" else "0"),
    Color.GREEN);

AddLabel(signalCode == 3,
    "WEAK BUY — CALL" +
    " [+" + adjustedScore + "]" +
    " [Confirmed]" +
    " ST:" + (if stState == 1 then "Bull" else "Bear") +
    " VWAP:" + (if vwapState == 1 then "Above" else "Below") +
    " Vol:" + (if volState == 1 then "High" else "Low") +
    " Sqz:" + (if sqState == 1 then "Green" else if sqState == -1 then "Red" else "On") +
    " ADX:" + adxDisplay +
    " HTF:" + (if htfState == 1 then "Bull" else "Bear") +
    " Pvt:" + (if pvtState == 1 then "+" else if pvtState == -1 then "-" else "0"),
    Color.LIGHT_GREEN);

AddLabel(signalCode == 2,
    "NO TRADE" +
    " [" + adjustedScore + "]" +
    " [Confirmed]" +
    " ST:" + (if stState == 1 then "Bull" else "Bear") +
    " VWAP:" + (if vwapState == 1 then "Above" else "Below") +
    " Vol:" + (if volState == 1 then "High" else "Low") +
    " Sqz:" + (if sqState == 1 then "Green" else if sqState == -1 then "Red" else "On") +
    " ADX:" + adxDisplay +
    " HTF:" + (if htfState == 1 then "Bull" else "Bear") +
    " Pvt:" + (if pvtState == 1 then "+" else if pvtState == -1 then "-" else "0"),
    Color.GRAY);

AddLabel(signalCode == 1,
    "WEAK SELL — PUT" +
    " [" + adjustedScore + "]" +
    " [Confirmed]" +
    " ST:" + (if stState == 1 then "Bull" else "Bear") +
    " VWAP:" + (if vwapState == 1 then "Above" else "Below") +
    " Vol:" + (if volState == 1 then "High" else "Low") +
    " Sqz:" + (if sqState == 1 then "Green" else if sqState == -1 then "Red" else "On") +
    " ADX:" + adxDisplay +
    " HTF:" + (if htfState == 1 then "Bull" else "Bear") +
    " Pvt:" + (if pvtState == 1 then "+" else if pvtState == -1 then "-" else "0"),
    Color.LIGHT_RED);

AddLabel(signalCode == 0,
    "STRONG SELL — PUT" +
    " [" + adjustedScore + "]" +
    " [Confirmed]" +
    " ST:" + (if stState == 1 then "Bull" else "Bear") +
    " VWAP:" + (if vwapState == 1 then "Above" else "Below") +
    " Vol:" + (if volState == 1 then "High" else "Low") +
    " Sqz:" + (if sqState == 1 then "Green" else if sqState == -1 then "Red" else "On") +
    " ADX:" + adxDisplay +
    " HTF:" + (if htfState == 1 then "Bull" else "Bear") +
    " Pvt:" + (if pvtState == 1 then "+" else if pvtState == -1 then "-" else "0"),
    Color.RED);

AddLabel(signalCode == -1,
    "INSUFFICIENT DATA [" + activeCount + "/7 active]",
    Color.WHITE);

#--- 4D. OVERRIDE / PENALTY DETAIL LABEL (secondary, smaller context) --------

AddLabel(show_override_label and overrideState == 1,
    "[OVERRIDE: ADX < 15 — Hard NO TRADE]",
    Color.YELLOW);

AddLabel(show_override_label and overrideState == 0 and totalPenalty < 0,
    "[Penalties:" +
    (if penaltyVol  < 0 then " LowVol:" + penaltyVol  else "") +
    (if penaltyADX  < 0 then " ADX-Gray:" + penaltyADX  else "") +
    (if penaltySTHTF < 0 then " ST/HTF-Conflict:" + penaltySTHTF else "") +
    "]" +
    (if bearFastLane then " [FastLane:Bear]" else "") +
    (if bullFastLane then " [FastLane:Bull]" else ""),
    Color.YELLOW);

#--- 4G. SIGNAL ARROWS WITH STRENGTH LABELS -----------------------------------
# Buy arrows below the bar; sell arrows above. S = strong, W = weak per signalCode.
# Strength without bubbles: thick arrow = strong (line weight 5), thin = weak (line weight 3).
# NO TRADE (2) and INSUFFICIENT DATA (-1): no arrows or bubbles. Toggle: show_arrows.
# SELL arrows (signalCode 0 or 1) only when ADX >= 15. If ADX < 15, Phase 3 forces NO TRADE
# (signalCode 2), so no bearish arrows appear — same rule as the top badge / override label.
# Optional S/W chart bubbles: show_strength_bubbles (Thinkorswim does not resize bubble boxes).
# Placement uses low[1]/high[1] for confirmed-bar alignment with the rest of the study.

plot arrowStrongBuy = if show_arrows and signalCode == 4 then low[1] * 0.999 else Double.NaN;
arrowStrongBuy.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
arrowStrongBuy.SetDefaultColor(Color.GREEN);
arrowStrongBuy.SetLineWeight(5);

plot arrowWeakBuy = if show_arrows and signalCode == 3 then low[1] * 0.9995 else Double.NaN;
arrowWeakBuy.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
arrowWeakBuy.SetDefaultColor(Color.LIGHT_GREEN);
arrowWeakBuy.SetLineWeight(3);

plot arrowStrongSell = if show_arrows and signalCode == 0 then high[1] * 1.001 else Double.NaN;
arrowStrongSell.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
arrowStrongSell.SetDefaultColor(Color.RED);
arrowStrongSell.SetLineWeight(5);

plot arrowWeakSell = if show_arrows and signalCode == 1 then high[1] * 1.0005 else Double.NaN;
arrowWeakSell.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
arrowWeakSell.SetDefaultColor(Color.LIGHT_RED);
arrowWeakSell.SetLineWeight(3);

AddChartBubble(show_arrows and show_strength_bubbles and signalCode == 4, low[1] * 0.998,  "S", Color.GREEN,       no);
AddChartBubble(show_arrows and show_strength_bubbles and signalCode == 3, low[1] * 0.998,  "W", Color.LIGHT_GREEN, no);
AddChartBubble(show_arrows and show_strength_bubbles and signalCode == 0, high[1] * 1.002, "S", Color.RED,         yes);
AddChartBubble(show_arrows and show_strength_bubbles and signalCode == 1, high[1] * 1.002, "W", Color.LIGHT_RED,   yes);

#--- 4E. OPTIONAL: SUPERTREND LINE OVERLAY ------------------------------------
# Uncomment to plot the SuperTrend line directly on the chart
# plot stLine = if st_trend == 1 then st_lower_b else st_upper_b;
# stLine.SetPaintingStrategy(PaintingStrategy.LINE);
# stLine.AssignValueColor(if st_trend == 1 then Color.GREEN else Color.RED);

#--- 4F. OPTIONAL: VWAP LINES -------------------------------------------------
# Uncomment to plot VWAP and deviation bands
# plot vwapPlot  = vwapLine;  vwapPlot.SetDefaultColor(Color.CYAN);
# plot vwapUpPlot = vwapUpper; vwapUpPlot.SetDefaultColor(Color.DARK_GRAY);
# plot vwapDnPlot = vwapLower; vwapDnPlot.SetDefaultColor(Color.DARK_GRAY);

# plot ppPlot = ppLevel; ppPlot.SetDefaultColor(Color.YELLOW); ppPlot.SetStyle(Curve.SHORT_DASH);

#=============================================================================
# END OF SCRIPT — SignalBadge_v2.0
# CONFIDENTIAL — FOR PERSONAL TRADING USE ONLY
# Not financial advice. Backtest before live use.
#=============================================================================
