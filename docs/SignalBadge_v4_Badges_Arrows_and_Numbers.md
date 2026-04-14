# Signal Badge v4.2 — Arrows & score numbers (one table)

**Study:** `SignalBadge_v4.ts`  
**Toggles:** `showBadges` must be **yes** for arrows and bubbles.  
**Number in the bubble** = **`finalScore`** (adjusted score after penalties toward zero), not a 1st/2nd/3rd event counter.

---

## Combined reference (arrow + number)

| Signal (class) | Arrow direction | Arrow color | Initial line weight | Reinforcement line weight | **Number shown?** | What the number is | When the **initial** arrow + number appear | When **reinforcement** arrow (no number) appears |
|----------------|-----------------|-------------|----------------------|----------------------------|-------------------|--------------------|---------------------------------------------|--------------------------------------------------|
| STRONG BUY (1) | Up | Green | 3 | 1 | **Yes**, below bar | `finalScore` | First bar where class becomes **1** (`signalChanged`); green bubble + thick arrow | Same class **1** continues: thin arrow every **`badgeInterval`** bars (`showBadgeNow`, not `signalChanged`) |
| WEAK BUY (2) | Up | Light green | 2 | 1 | **Yes**, below bar | `finalScore` | First bar where class becomes **2** | Same class **2**: thin arrow on interval |
| WEAK SELL (3) | Down | Light red | 2 | 1 | **Yes**, above bar | `finalScore` | First bar where class becomes **3** | Same class **3**: thin arrow on interval |
| STRONG SELL (4) | Down | Red | 3 | 1 | **Yes**, above bar | `finalScore` | First bar where class becomes **4** | Same class **4**: thin arrow on interval |
| NO TRADE (0) | *(none)* | — | — | — | **No** | — | No arrows | No arrows |
| INSUFFICIENT (5) | *(none)* | — | — | — | **No** | — | No arrows | No arrows |

---

## Short rules

1. **Arrow + number (same bar):** happens only on **`signalChanged`** into an actionable buy/sell class (1–4). The **AddChartBubble** uses `signalChanged` + class; the **initial** plots use `signalChanged` + class.
2. **Arrow, no number:** **reinforcement** — same class still on; **`!signalChanged`** and **`showBadgeNow`** (includes every `badgeInterval` bars). No bubble by design (less clutter).
3. **Buy** bubbles are **green**, below the bar; **sell** bubbles are **red**, above the bar.

---

*Generated for Signal Badge v4.2.*
