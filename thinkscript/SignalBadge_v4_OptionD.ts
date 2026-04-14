# ============================================================
# THINKSCRIPT SIGNAL BADGE v4.3-D (Option D: Combined B+C)
# Composite Indicator Scoring System for ThinkorSwim
# April 2026
#
# WHAT'S NEW IN V4.0:
#   - Complete rewrite from Cursor Implementation Brief
#   - Labels on strip + arrow badges on candles
#   - Adaptive SuperTrend params for 1-2 min charts
#   - Directional ADX vote (symmetric)
#   - All def-as-string/color bugs eliminated (inline only)
#
# WHAT'S NEW IN V4.1:
#   V4.1: Fixed HTF repainting (source-level [1] offset on HTF data pull)
#         Corrected max score comment (10 not 12)
#   - Max theoretical |rawScore| = 10 with default weights
#     (Tier1: 3 indicators x2 = 6, Tier2: 4 indicators x1 = 4)
#
# WHAT'S NEW IN V4.2:
#   V4.2: Recalibrated thresholds (strong=6, weak=3) for practical score range
#         Badge reinforcement every N bars during sustained signals
#         Initial vs reinforcement badge visual distinction
#
# WHAT'S NEW IN V4.2.1:
#   V4.2.1: HideTitle on all plots, HTF default 5m, NO TRADE diagnostic bubble
#
# WHAT'S NEW IN V4.3:
#   V4.3: ADX hard override lowered to 15 (input), gray zone 15-25,
#         adaptive ADX length for short timeframes
#
# SCORING:
#   +5 to +10  -> STRONG BUY
#   +2 to +4   -> WEAK BUY
#   -1 to +1   -> NO TRADE
#   -2 to -4   -> WEAK SELL
#   -5 to -10  -> STRONG SELL
#
# TIER WEIGHTS:
#   Tier 1 (x2): SuperTrend, VWAP, TTM Squeeze
#   Tier 2 (x1): HTF Bias (default 5m), Volume, ADX, Pivot
#
# OVERRIDES:
#   ADX < hard override (default 15; adaptive 1-2m: 12) -> Hard NO TRADE
#   Active count < 5   -> INSUFFICIENT DATA
#   ADX in gray zone (override threshold .. 25) -> Score penalty: -2
#   Volume < average   -> Score penalty: -2
#   ST/HTF conflict    -> Score penalty: -3
#
# VISUAL OUTPUT:
#   1) Label strip: signal name, score, indicator states, penalties
#   2) Candle badges: thick arrow on signal change; thinner arrows every N bars
#      during sustained signal (reinforcement). Score bubbles on change only.
#      Green up-arrow = BUY; red down-arrow = SELL
#      Toggle with input showBadges = yes/no
#
# KNOWN LIMITATIONS:
#   - Intraday only (VWAP resets daily)
#   - All indicators lagging/coincident
#   - VWAP unstable first 30 minutes
#   - Uses close[1] for anti-repainting
#   - def cannot hold strings or Colors in ThinkScript
# ============================================================

declare upper;

# ===========================================================
# INPUTS
# ===========================================================

# ---- Tier Weights ----
input tier1Weight = 2;
input tier2Weight = 1;

# ---- SuperTrend ----
input stATRPeriod = 10;
input stMultiplier = 3.0;

# ---- VWAP ----
input vwapSDLength = 20;
input vwapSDMult = 2.0;

# ---- TTM Squeeze ----
input sqzLength = 20;
input sqzBBMult = 2.0;
input sqzKCMult = 1.5;

# ---- ADX ----
input adxLength = 14;
input adxHardOverride = 15;  # ADX below this = hard NO TRADE (adaptive 1-2m uses 12)

# ---- Volume ----
input volAvgLength = 50;

# ---- HTF Bias ----
input htfAggPeriod = AggregationPeriod.FIVE_MIN;
input htfATRPeriod = 10;
input htfMultiplier = 3.0;

# ---- Pivot ----
input pivotLookback = 5;

# ---- Signal Thresholds ----
input strongThreshold = 5;
input weakThreshold = 2;

# ---- Adaptive Mode ----
input adaptiveParams = yes;

# ---- Display Toggles ----
input showDetailLabel = yes;
input showPenaltyLabel = yes;
input showScoreLabel = yes;
input showBadges = yes;
input badgeInterval = 10;  # Bars between repeated badges during sustained signal

# ===========================================================
# ADAPTIVE PARAMETER OVERRIDE
# ===========================================================
# SuperTrend (ATR 10, mult 3) is calibrated for 5-15 min.
# On 1-2 min charts, use faster params (ATR 7, mult 2.0).

def currentAgg = GetAggregationPeriod();

def effSTATR = if adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN
    then 7
    else stATRPeriod;

def effSTMult = if adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN
    then 2.0
    else stMultiplier;

def effADXLength = if adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN
    then 10
    else adxLength;

# On 1-2 min charts, ADX below 12 = truly no movement.
# On 5min+, use the user's adxHardOverride input (default 15).
def effADXHardOverride = if adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN
    then 12
    else adxHardOverride;

# ===========================================================
# INDICATOR MODULE 1: SUPERTREND (Current Timeframe)
# ===========================================================
# Binary trend direction. Uses adaptive params on short TFs.
# Flip decision uses close (current bar) vs prior bands.
# Signal reads stTrend[1] (confirmed prior bar).

def stATR = WildersAverage(TrueRange(high, close, low), effSTATR);
def stMid = (high + low) / 2;
def stUp = stMid + effSTMult * stATR;
def stDn = stMid - effSTMult * stATR;

def stUpperBand = CompoundValue(1,
    if stUp < stUpperBand[1] or close[1] > stUpperBand[1]
    then stUp
    else stUpperBand[1],
    stUp);

def stLowerBand = CompoundValue(1,
    if stDn > stLowerBand[1] or close[1] < stLowerBand[1]
    then stDn
    else stLowerBand[1],
    stDn);

# Trend flip: close (current) vs prior bar bands
def stTrend = CompoundValue(1,
    if stTrend[1] == -1 and close > stUpperBand[1] then 1
    else if stTrend[1] == 1 and close < stLowerBand[1] then -1
    else stTrend[1],
    1);

# Confirmed signal from prior bar
def stBull = stTrend[1] == 1;
def stBear = stTrend[1] == -1;

# Hidden debug plot (user can unhide in study settings)
plot stLine = if stTrend == 1 then stLowerBand else stUpperBand;
stLine.SetDefaultColor(Color.CYAN);
stLine.SetLineWeight(2);
stLine.Hide();
stLine.HideTitle();

# ===========================================================
# INDICATOR MODULE 2: VWAP
# ===========================================================
# Uses built-in reference (only indicator we don't recalculate)

def vwapLine = reference VWAP();
def vwapSD = StDev(close - vwapLine, vwapSDLength);
def vwapUpper = vwapLine + vwapSDMult * vwapSD;
def vwapLower = vwapLine - vwapSDMult * vwapSD;

def vwapDist = close[1] - vwapLine[1];
def vwapDistPrev = close[2] - vwapLine[2];
def vwapMovingAway = AbsValue(vwapDist) > AbsValue(vwapDistPrev);
def vwapBull = close[1] > vwapLine[1] and vwapMovingAway;
def vwapBear = close[1] < vwapLine[1] and vwapMovingAway;

# ===========================================================
# INDICATOR MODULE 3: TTM SQUEEZE (Single Composite Vote)
# ===========================================================
# ONE vote, not two. Squeeze state + momentum direction combined.

def sqzBBBasis = Average(close, sqzLength);
def sqzBBUpper = sqzBBBasis + sqzBBMult * StDev(close, sqzLength);
def sqzBBLower = sqzBBBasis - sqzBBMult * StDev(close, sqzLength);

def sqzKCBasis = Average(close, sqzLength);
def sqzKCATR = Average(TrueRange(high, close, low), sqzLength);
def sqzKCUpper = sqzKCBasis + sqzKCMult * sqzKCATR;
def sqzKCLower = sqzKCBasis - sqzKCMult * sqzKCATR;

def squeezeOn = sqzBBLower > sqzKCLower and sqzBBUpper < sqzKCUpper;

def sqzDonchianMid = (Highest(high, sqzLength) + Lowest(low, sqzLength)) / 2;
def sqzDelta = close - (sqzDonchianMid + sqzBBBasis) / 2;
def sqzMomentum = Inertia(sqzDelta, sqzLength);

# Composite vote using [1] offset
def sqzBull = !squeezeOn[1] and sqzMomentum[1] > 0;
def sqzBear = !squeezeOn[1] and sqzMomentum[1] < 0;
def sqzNeutral = squeezeOn[1];

# ===========================================================
# INDICATOR MODULE 4: ADX / DMI
# ===========================================================
# Directional: +weight when bullish trending, -weight when
# bearish trending, 0 when not trending. Symmetric by design.

def hiDiff = high - high[1];
def loDiff = low[1] - low;
def plusDM = if hiDiff > loDiff and hiDiff > 0 then hiDiff else 0;
def minusDM = if loDiff > hiDiff and loDiff > 0 then loDiff else 0;

def adxATR = WildersAverage(TrueRange(high, close, low), effADXLength);
def plusDI = 100 * WildersAverage(plusDM, effADXLength) / adxATR;
def minusDI = 100 * WildersAverage(minusDM, effADXLength) / adxATR;
def dx = if (plusDI + minusDI) > 0
    then 100 * AbsValue(plusDI - minusDI) / (plusDI + minusDI)
    else 0;
def adxValue = WildersAverage(dx, effADXLength);

# ===========================================================
# INDICATOR MODULE 5: RELATIVE VOLUME
# ===========================================================

def volAboveAvg = volume[1] > VolumeAvg(volAvgLength)[1];

# ===========================================================
# INDICATOR MODULE 6: HTF BIAS (aggregated SuperTrend)
# ===========================================================
# Full SuperTrend on HTF OHLC (default 5m aggregation; user-configurable).
# HTF params are NOT adaptive (chart TF uses effSTATR; HTF uses htfATRPeriod).
# Pull HTF data with [1] offset at the source to ensure we only
# use the COMPLETED HTF candle, not the currently forming one.
# Without this, htfClose updates every tick on the current HTF bar,
# causing the HTF SuperTrend to flutter mid-candle (repainting).

def htfHigh = high(period = htfAggPeriod)[1];
def htfLow = low(period = htfAggPeriod)[1];
def htfClose = close(period = htfAggPeriod)[1];

def htfTR = TrueRange(htfHigh, htfClose, htfLow);
def htfATR = WildersAverage(htfTR, htfATRPeriod);
def htfMid = (htfHigh + htfLow) / 2;
def htfUp = htfMid + htfMultiplier * htfATR;
def htfDn = htfMid - htfMultiplier * htfATR;

def htfUpperBand = CompoundValue(1,
    if htfUp < htfUpperBand[1] or htfClose > htfUpperBand[1]
    then htfUp
    else htfUpperBand[1],
    htfUp);

def htfLowerBand = CompoundValue(1,
    if htfDn > htfLowerBand[1] or htfClose < htfLowerBand[1]
    then htfDn
    else htfLowerBand[1],
    htfDn);

def htfTrend = CompoundValue(1,
    if htfTrend[1] == -1 and htfClose > htfUpperBand[1] then 1
    else if htfTrend[1] == 1 and htfClose < htfLowerBand[1] then -1
    else htfTrend[1],
    1);

# No additional [1] needed on htfTrend — the data itself is already
# one completed HTF bar behind, so htfTrend represents the confirmed state.
def htfBull = htfTrend == 1;
def htfBear = htfTrend == -1;

# ===========================================================
# INDICATOR MODULE 7: PIVOT / STRUCTURE
# ===========================================================

def priorDayHigh = high(period = AggregationPeriod.DAY)[1];
def priorDayLow = low(period = AggregationPeriod.DAY)[1];
def priorDayClose = close(period = AggregationPeriod.DAY)[1];
def ppLevel = (priorDayHigh + priorDayLow + priorDayClose) / 3;

def pivotBull = close[1] > ppLevel;
def pivotBear = close[1] < ppLevel;

# ===========================================================
# VOTE ASSIGNMENT
# ===========================================================

# Tier 1 votes (weight = tier1Weight, default 2)
def stVote = if stBull then tier1Weight
    else if stBear then -tier1Weight
    else 0;

def vwapVote = if vwapBull then tier1Weight
    else if vwapBear then -tier1Weight
    else 0;

def sqzVote = if sqzBull then tier1Weight
    else if sqzBear then -tier1Weight
    else 0;

# Tier 2 votes (weight = tier2Weight, default 1)
def htfVote = if htfBull then tier2Weight
    else if htfBear then -tier2Weight
    else 0;

def volVote = if volAboveAvg then tier2Weight else 0;

# ADX: directional (symmetric) - contributes in both directions
def adxVote = if adxValue[1] > 25 and plusDI[1] > minusDI[1]
    then tier2Weight
    else if adxValue[1] > 25 and minusDI[1] > plusDI[1]
    then -tier2Weight
    else 0;

def pivotVote = if pivotBull then tier2Weight
    else if pivotBear then -tier2Weight
    else 0;

# ===========================================================
# ACTIVE INDICATOR COUNT
# ===========================================================

def stActive = if !IsNaN(close[1]) and !IsNaN(stATR) then 1 else 0;
def vwapActive = if !IsNaN(vwapLine[1]) then 1 else 0;
def sqzActive = if !IsNaN(sqzMomentum[1]) then 1 else 0;
def adxActive = if !IsNaN(adxValue[1]) then 1 else 0;
def volActive = if !IsNaN(volume[1]) then 1 else 0;
def htfActive = if !IsNaN(htfClose) then 1 else 0;
def pivotActive = if !IsNaN(ppLevel) then 1 else 0;

def activeCount = stActive + vwapActive + sqzActive + adxActive
    + volActive + htfActive + pivotActive;

# ===========================================================
# SCORING ENGINE
# ===========================================================

# Raw weighted score
def rawScore = stVote + vwapVote + sqzVote + htfVote
    + volVote + adxVote + pivotVote;

# Penalties (positive integers = deduction amount)
def volPenalty = if !volAboveAvg then 2 else 0;
def adxPenalty = if adxValue[1] >= effADXHardOverride and adxValue[1] < 25 then 2 else 0;
def conflictPenalty = if (stBull and htfBear) or (stBear and htfBull) then 3 else 0;
def totalPenalty = volPenalty + adxPenalty + conflictPenalty;

# Apply penalty toward zero (reduce absolute value, don't flip sign)
def adjustedScore = if rawScore > 0 then Max(rawScore - totalPenalty, 0)
    else if rawScore < 0 then Min(rawScore + totalPenalty, 0)
    else 0;

# Hard overrides
def finalScore = if adxValue[1] < effADXHardOverride then 0
    else if activeCount < 5 then -99
    else adjustedScore;

# Signal classification
# 1=STRONG BUY, 2=WEAK BUY, 0=NO TRADE, 3=WEAK SELL, 4=STRONG SELL, 5=INSUFFICIENT
def signalClass =
    if finalScore == -99 then 5
    else if finalScore >= strongThreshold then 1
    else if finalScore >= weakThreshold then 2
    else if finalScore <= -strongThreshold then 4
    else if finalScore <= -weakThreshold then 3
    else 0;

# ===========================================================
# LABELS (all strings/colors inline — never in def)
# ===========================================================

# ---- Primary Signal Label (one per signal state) ----
AddLabel(signalClass == 1,
    "STRONG BUY -- CALL [+" + finalScore + "] [Confirmed]",
    Color.GREEN);

AddLabel(signalClass == 2,
    "WEAK BUY -- CALL [+" + finalScore + "] [Confirmed]",
    Color.LIGHT_GREEN);

AddLabel(signalClass == 0,
    "NO TRADE [" + (if finalScore >= 0 then "+" else "") + finalScore + "] [Confirmed]",
    Color.GRAY);

AddLabel(signalClass == 3,
    "WEAK SELL -- PUT [" + finalScore + "] [Confirmed]",
    Color.LIGHT_RED);

AddLabel(signalClass == 4,
    "STRONG SELL -- PUT [" + finalScore + "] [Confirmed]",
    Color.RED);

AddLabel(signalClass == 5,
    "INSUFFICIENT DATA [" + activeCount + "/7 active]",
    Color.WHITE);

# ---- Adaptive Mode Notice ----
AddLabel(adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN,
    "Adapted: ST(" + effSTATR + "," + effSTMult + ") ADX(len=" + effADXLength + " kill=" + effADXHardOverride + ")",
    Color.DARK_ORANGE);

# ---- Indicator Detail Label ----
AddLabel(showDetailLabel,
    "ST:" + (if stBull then "Bull" else "Bear") +
    " VWAP:" + (if vwapBull then "Away+" else if vwapBear then "Away-" else "Fade") +
    " Sqz:" + (if sqzNeutral then "On" else if sqzBull then "Grn+" else "Red-") +
    " Vol:" + (if volAboveAvg then "High" else "Low") +
    " ADX:" + Round(adxValue[1], 0) +
    " HTF:" + (if htfBull then "Bull" else "Bear") +
    " Pvt:" + (if pivotBull then "+" else "-"),
    Color.LIGHT_GRAY);

# ---- Penalty Detail Label ----
AddLabel(showPenaltyLabel and (volPenalty > 0 or adxPenalty > 0 or conflictPenalty > 0 or adxValue[1] < effADXHardOverride),
    (if adxValue[1] < effADXHardOverride then "[ADX<" + effADXHardOverride + ": NO TRADE] " else "") +
    (if adxPenalty > 0 then "[ADX Gray:-2] " else "") +
    (if volPenalty > 0 then "[LowVol:-2] " else "") +
    (if conflictPenalty > 0 then "[TF Conflict:-3] " else ""),
    Color.YELLOW);

# ---- Numeric Score Label ----
AddLabel(showScoreLabel and signalClass != 5,
    "Raw:" + rawScore + " Pen:-" + totalPenalty + " Adj:" + adjustedScore,
    Color.LIGHT_GRAY);

# ===========================================================
# CANDLE BADGES (initial + periodic reinforcement)
# ===========================================================
# Badge appears on signal changes + periodic reinforcement every N bars
# BUY signals: green up-arrow BELOW the candle
# SELL signals: red down-arrow ABOVE the candle
# NO TRADE / INSUFFICIENT DATA: no badge

def prevSignalClass = signalClass[1];
def signalChanged = signalClass != prevSignalClass;

# Count bars since last signal change
def barsSinceChange = if signalChanged then 0 else barsSinceChange[1] + 1;

# Show badge on: signal change OR every N bars during sustained signal
# Only for actionable signals (not NO TRADE or INSUFFICIENT DATA)
def showBadgeNow = (signalChanged or (barsSinceChange % badgeInterval == 0))
    and signalClass != 0 and signalClass != 5;

# ---- Strong Buy: initial (thick) + reinforcement (thin) ----
plot strongBuyInit = if showBadges and signalChanged and signalClass == 1
    then low - 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
strongBuyInit.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
strongBuyInit.SetDefaultColor(Color.GREEN);
strongBuyInit.SetLineWeight(3);
strongBuyInit.HideTitle();

plot strongBuyReinf = if showBadges and !signalChanged and showBadgeNow and signalClass == 1
    then low - 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
strongBuyReinf.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
strongBuyReinf.SetDefaultColor(Color.GREEN);
strongBuyReinf.SetLineWeight(1);
strongBuyReinf.HideTitle();

# ---- Weak Buy: initial + reinforcement ----
plot weakBuyInit = if showBadges and signalChanged and signalClass == 2
    then low - 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
weakBuyInit.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
weakBuyInit.SetDefaultColor(Color.LIGHT_GREEN);
weakBuyInit.SetLineWeight(2);
weakBuyInit.HideTitle();

plot weakBuyReinf = if showBadges and !signalChanged and showBadgeNow and signalClass == 2
    then low - 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
weakBuyReinf.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
weakBuyReinf.SetDefaultColor(Color.LIGHT_GREEN);
weakBuyReinf.SetLineWeight(1);
weakBuyReinf.HideTitle();

# ---- Strong Sell: initial + reinforcement ----
plot strongSellInit = if showBadges and signalChanged and signalClass == 4
    then high + 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
strongSellInit.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
strongSellInit.SetDefaultColor(Color.RED);
strongSellInit.SetLineWeight(3);
strongSellInit.HideTitle();

plot strongSellReinf = if showBadges and !signalChanged and showBadgeNow and signalClass == 4
    then high + 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
strongSellReinf.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
strongSellReinf.SetDefaultColor(Color.RED);
strongSellReinf.SetLineWeight(1);
strongSellReinf.HideTitle();

# ---- Weak Sell: initial + reinforcement ----
plot weakSellInit = if showBadges and signalChanged and signalClass == 3
    then high + 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
weakSellInit.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
weakSellInit.SetDefaultColor(Color.LIGHT_RED);
weakSellInit.SetLineWeight(2);
weakSellInit.HideTitle();

plot weakSellReinf = if showBadges and !signalChanged and showBadgeNow and signalClass == 3
    then high + 0.15 * Average(TrueRange(high, close, low), 14)
    else Double.NaN;
weakSellReinf.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
weakSellReinf.SetDefaultColor(Color.LIGHT_RED);
weakSellReinf.SetLineWeight(1);
weakSellReinf.HideTitle();

# ---- Score bubble at initial signal change only ----
AddChartBubble(
    showBadges and signalChanged and (signalClass == 1 or signalClass == 2),
    low - 0.30 * Average(TrueRange(high, close, low), 14),
    "" + finalScore,
    Color.GREEN,
    no);

AddChartBubble(
    showBadges and signalChanged and (signalClass == 3 or signalClass == 4),
    high + 0.30 * Average(TrueRange(high, close, low), 14),
    "" + finalScore,
    Color.RED,
    yes);

# Score bubble when signal drops to NO TRADE from active signal
AddChartBubble(
    showBadges and signalChanged and signalClass == 0
    and (prevSignalClass == 1 or prevSignalClass == 2
         or prevSignalClass == 3 or prevSignalClass == 4),
    close,
    "x" + finalScore,
    Color.GRAY,
    no);

# ===========================================================
# PLACEHOLDER PLOTS (prevent N/A in study title bar)
# ===========================================================
plot _p1 = Double.NaN;
_p1.Hide();
_p1.HideTitle();
plot _p2 = Double.NaN;
_p2.Hide();
_p2.HideTitle();

# ============================================================
# END OF SIGNAL BADGE v4.3
# ============================================================