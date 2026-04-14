# V3.3 — Optional ADX score lock; ATR-based arrow Y (fixes missing sells + alignment)
# ============================================================
# THINKSCRIPT SIGNAL BADGE v2.0
# Composite Indicator Scoring System
#
# This study consolidates 7 indicator categories into a single
# weighted score displayed as a color-coded label.
# Max theoretical |rawScore| is 12 when ADX votes ±tier2Weight (V3.2 directional ADX).
# All calculations use close[1] (prior confirmed bar) to
# prevent repainting. The [Confirmed] tag in the label is
# the architectural guarantee against mid-bar signals.
#
# INTRADAY ONLY: Designed for 1-min through 15-min charts
# during regular trading hours (9:30 AM - 4:00 PM ET).
# VWAP resets daily; badge is unreliable on daily+ charts.
#
# HTF data with `period = AggregationPeriod.FIFTEEN_MIN`
# If current chart is already 15m or higher, this returns the SAME data (no upsample)
# Document that HTF bias is only meaningful when chart timeframe < 15m
# ============================================================

declare upper;

# ---- Tier Weights (user-adjustable) ----
input tier1Weight = 2;    # Weight for SuperTrend, VWAP, TTM Squeeze
input tier2Weight = 1;    # Weight for HTF Bias, Volume, ADX, Pivot

# ---- SuperTrend Parameters ----
input stATRPeriod = 10;
input stMultiplier = 3.0;

# ---- VWAP Parameters ----
input vwapSDLength = 20;  # Lookback for standard deviation bands
input vwapSDMult = 2.0;   # Standard deviation multiplier

# ---- TTM Squeeze Parameters ----
input sqzLength = 20;
input sqzBBMult = 2.0;    # Bollinger Band std dev multiplier
input sqzKCMult = 1.5;    # Keltner Channel ATR multiplier

# ---- ADX Parameters ----
input adxLength = 14;

# ---- Volume Parameters ----
input volAvgLength = 50;

# ---- HTF Bias Parameters ----
# Uses SuperTrend on the 15-minute aggregation
input htfAggPeriod = AggregationPeriod.FIFTEEN_MIN;
input htfATRPeriod = 10;
input htfMultiplier = 3.0;

# ---- Pivot Parameters ----
input pivotLookback = 5;

# ---- Signal Thresholds ----
input strongThreshold = 9;
input weakThreshold = 5;

# ---- Display Toggles ----
input showDetailLabel = yes;   # Show indicator-level detail
input showPenaltyLabel = yes;  # Show active penalties
input showScoreLabel = yes;    # Show numeric score
input show_arrows = yes;       # Up/down arrows on chart (same signalClass as labels); no S/W bubbles

# Original brief: ADX<20 forced finalScore=0 (no trade). That also removes ALL sell arrows when ADX is low.
# Set to yes to restore that strict rule; default no so bearish adjustedScore can show WEAK/STRONG SELL.
input zeroScoreIfAdxBelow20 = no;

# ---- Adaptive Parameter Override ----
# SuperTrend (ATR 10, mult 3) is calibrated for 5-15 min charts.
# On 1-min charts, we need faster parameters to detect trend flips.
# On 5-min+, use the user's configured defaults.
input adaptiveParams = yes;  # Set to 'no' to always use manual inputs

def currentAgg = GetAggregationPeriod();

# Effective SuperTrend parameters
def effSTATR = if adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN
    then 7
    else stATRPeriod;

def effSTMult = if adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN
    then 2.0
    else stMultiplier;

# ---- SuperTrend Calculation ----
# Trend flip uses current close vs prior bands; stBull/stBear read stTrend[1] (confirmed).
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

def stTrend = CompoundValue(1,
    if stTrend[1] == -1 and close > stUpperBand[1] then 1
    else if stTrend[1] == 1 and close < stLowerBand[1] then -1
    else stTrend[1],
    1);

def stBull = stTrend[1] == 1;
def stBear = stTrend[1] == -1;

# ---- VWAP Calculation ----
def vwapLine = reference VWAP();
def vwapSD = StDev(close - vwapLine, vwapSDLength);
def vwapUpper = vwapLine + vwapSDMult * vwapSD;
def vwapLower = vwapLine - vwapSDMult * vwapSD;

def vwapBull = close[1] > vwapLine[1];
def vwapBear = close[1] < vwapLine[1];

# ---- TTM Squeeze Calculation ----
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

def sqzBull = !squeezeOn[1] and sqzMomentum[1] > 0;
def sqzBear = !squeezeOn[1] and sqzMomentum[1] < 0;
def sqzNeutral = squeezeOn[1];

# ---- ADX / DMI Calculation ----
def hiDiff = high - high[1];
def loDiff = low[1] - low;
def plusDM = if hiDiff > loDiff and hiDiff > 0 then hiDiff else 0;
def minusDM = if loDiff > hiDiff and loDiff > 0 then loDiff else 0;

def adxATR = WildersAverage(TrueRange(high, close, low), adxLength);
def plusDI = if adxATR > 0 then 100 * WildersAverage(plusDM, adxLength) / adxATR else 0;
def minusDI = if adxATR > 0 then 100 * WildersAverage(minusDM, adxLength) / adxATR else 0;
def dx = if (plusDI + minusDI) > 0
    then 100 * AbsValue(plusDI - minusDI) / (plusDI + minusDI)
    else 0;
def adxValue = WildersAverage(dx, adxLength);

# ---- Volume Calculation ----
# Compare prior bar's volume to 50-bar average (also at [1])
def volAboveAvg = volume[1] > Average(volume, volAvgLength)[1];

# ---- HTF Bias Calculation ----
# Pull 15-minute OHLC data; TrueRange must use HTF series (not chart TF high/close/low).
def htfHigh = high(period = htfAggPeriod);
def htfLow = low(period = htfAggPeriod);
def htfClose = close(period = htfAggPeriod);

def htfTR = TrueRange(htfHigh, htfClose, htfLow);
def htfATR = WildersAverage(htfTR, htfATRPeriod);
def htfMid = (htfHigh + htfLow) / 2;
def htfUp = htfMid + htfMultiplier * htfATR;
def htfDn = htfMid - htfMultiplier * htfATR;

def htfUpperBand = CompoundValue(1,
    if htfUp < htfUpperBand[1] or htfClose[1] > htfUpperBand[1]
    then htfUp
    else htfUpperBand[1],
    htfUp);

def htfLowerBand = CompoundValue(1,
    if htfDn > htfLowerBand[1] or htfClose[1] < htfLowerBand[1]
    then htfDn
    else htfLowerBand[1],
    htfDn);

def htfTrend = CompoundValue(1,
    if htfTrend[1] == -1 and htfClose > htfUpperBand[1] then 1
    else if htfTrend[1] == 1 and htfClose < htfLowerBand[1] then -1
    else htfTrend[1],
    1);

def htfBull = htfTrend[1] == 1;
def htfBear = htfTrend[1] == -1;

# ---- Pivot Calculation ----
# Central Pivot Point from prior daily session
def priorDayHigh = high(period = AggregationPeriod.DAY)[1];
def priorDayLow = low(period = AggregationPeriod.DAY)[1];
def priorDayClose = close(period = AggregationPeriod.DAY)[1];
def ppLevel = (priorDayHigh + priorDayLow + priorDayClose) / 3;

def pivotBull = close[1] > ppLevel;
def pivotBear = close[1] < ppLevel;

# ---- Vote Assignment ----
def stVote = if stBull then tier1Weight
    else if stBear then -tier1Weight
    else 0;

def vwapVote = if vwapBull then tier1Weight
    else if vwapBear then -tier1Weight
    else 0;

def sqzVote = if sqzBull then tier1Weight
    else if sqzBear then -tier1Weight
    else 0;

def htfVote = if htfBull then tier2Weight
    else if htfBear then -tier2Weight
    else 0;

def volVote = if volAboveAvg then tier2Weight else 0;

# ADX contributes directionally: +weight when bullish trending, -weight when bearish, 0 when not trending.
def adxVote = if adxValue[1] > 25 and plusDI[1] > minusDI[1]
    then tier2Weight
    else if adxValue[1] > 25 and minusDI[1] > plusDI[1]
    then -tier2Weight
    else 0;

def pivotVote = if pivotBull then tier2Weight
    else if pivotBear then -tier2Weight
    else 0;

# ---- Active Indicator Count ----
def stActive = if !IsNaN(close[1]) and !IsNaN(stATR) then 1 else 0;
def vwapActive = if !IsNaN(vwapLine[1]) then 1 else 0;
def sqzActive = if !IsNaN(sqzMomentum[1]) then 1 else 0;
def adxActive = if !IsNaN(adxValue[1]) then 1 else 0;
def volActive = if !IsNaN(volume[1]) then 1 else 0;
def htfActive = if !IsNaN(htfClose[1]) then 1 else 0;
def pivotActive = if !IsNaN(ppLevel) then 1 else 0;

def activeCount = stActive + vwapActive + sqzActive + adxActive
    + volActive + htfActive + pivotActive;

# ---- Raw Weighted Score ----
def rawScore = stVote + vwapVote + sqzVote + htfVote
    + volVote + adxVote + pivotVote;

# ---- Penalty Calculation ----
# volPenalty, adxPenalty, conflictPenalty are positive magnitudes (2, 2, 3); applied toward zero via adjustedScore.
def volPenalty = if !volAboveAvg then 2 else 0;
def adxPenalty = if adxValue[1] >= 20 and adxValue[1] < 25 then 2 else 0;
def conflictPenalty = if (stBull and htfBear) or (stBear and htfBull) then 3 else 0;

def totalPenalty = volPenalty + adxPenalty + conflictPenalty;

def adjustedScore = if rawScore > 0 then Max(rawScore - totalPenalty, 0)
    else if rawScore < 0 then Min(rawScore + totalPenalty, 0)
    else 0;

# ---- Hard Overrides ----
def finalScore =
    if activeCount < 5 then -99
    else if zeroScoreIfAdxBelow20 and adxValue[1] < 20 then 0
    else adjustedScore;

# ---- Signal Classification ----
def signalClass =
    if finalScore == -99 then 5
    else if finalScore >= strongThreshold then 1
    else if finalScore >= weakThreshold then 2
    else if finalScore <= -strongThreshold then 4
    else if finalScore <= -weakThreshold then 3
    else 0;

# Arrow Y: offset by fraction of ST ATR so spacing scales with volatility (cleaner than fixed % of price).
def arrowYBuy = low - stATR * 0.35;
def arrowYSell = high + stATR * 0.35;

# ---- Plots (TOS: declare all plots before AddLabel or labels may not render) ----
# SuperTrend line: hidden by default; unhide in study settings to debug vs price.
plot stLine = if stTrend == 1 then stLowerBand else stUpperBand;
stLine.SetDefaultColor(Color.CYAN);
stLine.SetLineWeight(2);
stLine.Hide();

# Placeholder plots — use 0 not NaN (NaN can trigger study warnings / N/A in title bar).
plot _p1 = 0;
_p1.Hide();
plot _p2 = 0;
_p2.Hide();

# ---- Signal arrows (same signalClass as labels; one class per bar) ----
plot arrowStrongBuy = if show_arrows and signalClass == 1 then arrowYBuy else Double.NaN;
arrowStrongBuy.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
arrowStrongBuy.SetDefaultColor(Color.GREEN);
arrowStrongBuy.SetLineWeight(5);

plot arrowWeakBuy = if show_arrows and signalClass == 2 then arrowYBuy else Double.NaN;
arrowWeakBuy.SetPaintingStrategy(PaintingStrategy.ARROW_UP);
arrowWeakBuy.SetDefaultColor(Color.LIGHT_GREEN);
arrowWeakBuy.SetLineWeight(3);

plot arrowStrongSell = if show_arrows and signalClass == 4 then arrowYSell else Double.NaN;
arrowStrongSell.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
arrowStrongSell.SetDefaultColor(Color.RED);
arrowStrongSell.SetLineWeight(5);

plot arrowWeakSell = if show_arrows and signalClass == 3 then arrowYSell else Double.NaN;
arrowWeakSell.SetPaintingStrategy(PaintingStrategy.ARROW_DOWN);
arrowWeakSell.SetDefaultColor(Color.LIGHT_RED);
arrowWeakSell.SetLineWeight(3);

# ---- Primary Signal Label ----
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

# ---- Timeframe adaptation notice ----
AddLabel(adaptiveParams and currentAgg <= AggregationPeriod.TWO_MIN,
    "ST adapted: ATR=" + effSTATR + " Mult=" + effSTMult,
    Color.DARK_ORANGE);

# ---- Indicator Detail Label ----
# Neutral color; primary label carries signal color.
AddLabel(showDetailLabel,
    "ST:" + (if stBull then "Bull" else "Bear") +
    " VWAP:" + (if vwapBull then "Above" else "Below") +
    " Sqz:" + (if sqzNeutral then "On" else if sqzBull then "Grn+" else "Red-") +
    " Vol:" + (if volAboveAvg then "High" else "Low") +
    " ADX:" + Round(adxValue[1], 0) +
    " HTF:" + (if htfBull then "Bull" else "Bear") +
    " Pvt:" + (if pivotBull then "+" else "-"),
    Color.LIGHT_GRAY);

# ---- Penalty Detail Label ----
AddLabel(showPenaltyLabel and (volPenalty > 0 or adxPenalty > 0 or conflictPenalty > 0 or adxValue[1] < 20),
    (if zeroScoreIfAdxBelow20 and adxValue[1] < 20 then "[ADX<20: NO TRADE] " else "") +
    (if !zeroScoreIfAdxBelow20 and adxValue[1] < 20 then "[ADX<20: low trend strength] " else "") +
    (if adxPenalty > 0 then "[ADX Gray:-2] " else "") +
    (if volPenalty > 0 then "[LowVol:-2] " else "") +
    (if conflictPenalty > 0 then "[TF Conflict:-3] " else ""),
    Color.YELLOW);

# ---- Numeric Score Label (optional) ----
AddLabel(showScoreLabel and signalClass != 5,
    "Raw:" + rawScore + " Pen:-" + totalPenalty + " Adj:" + adjustedScore,
    Color.LIGHT_GRAY);

# Optional hidden stLine for SuperTrend debug. Arrows: toggle show_arrows (no S/W bubbles).

# FLAG: If adaptiveParams + TWO_MIN comparison mis-detects chart TF on your build, confirm GetAggregationPeriod() vs AggregationPeriod enums.
