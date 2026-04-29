import { useState, useCallback, useEffect, useRef } from "react";

// ––––––––––––––––––––––––––––––––
// HHKB サウンド — 低域重視
// ––––––––––––––––––––––––––––––––
function createHHKBSound(audioCtx) {
const now = audioCtx.currentTime;

// ① ボトムアウト衝撃（さらに低域）
const impactBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.05), audioCtx.sampleRate);
const id = impactBuf.getChannelData(0);
for (let i = 0; i < id.length; i++) id[i] = (Math.random() * 2 - 1) * Math.exp(-i / (id.length * 0.18));
const impact = audioCtx.createBufferSource();
impact.buffer = impactBuf;
const impactLP = audioCtx.createBiquadFilter();
impactLP.type = “lowpass”; impactLP.frequency.value = 180;
const impactGain = audioCtx.createGain();
impactGain.gain.setValueAtTime(0.45, now);
impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
impact.connect(impactLP); impactLP.connect(impactGain); impactGain.connect(audioCtx.destination);
impact.start(now); impact.stop(now + 0.05);

// ② thock ノイズ本体（低域寄りに）
const thockBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.15), audioCtx.sampleRate);
const td = thockBuf.getChannelData(0);
for (let i = 0; i < td.length; i++) td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (td.length * 0.3));
const thock = audioCtx.createBufferSource();
thock.buffer = thockBuf;
const bp = audioCtx.createBiquadFilter();
bp.type = “bandpass”; bp.frequency.value = 200; bp.Q.value = 0.5;
const lp = audioCtx.createBiquadFilter();
lp.type = “lowpass”; lp.frequency.value = 400;
const thockGain = audioCtx.createGain();
thockGain.gain.setValueAtTime(0.28, now);
thockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
thock.connect(bp); bp.connect(lp); lp.connect(thockGain); thockGain.connect(audioCtx.destination);
thock.start(now); thock.stop(now + 0.15);

// ③ サブ低音（ハウジング共鳴）— 音程を下げる
const sub = audioCtx.createOscillator();
sub.type = “sine”; sub.frequency.setValueAtTime(45, now);
sub.frequency.exponentialRampToValueAtTime(22, now + 0.1);
const subG = audioCtx.createGain();
subG.gain.setValueAtTime(0.35, now);
subG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
sub.connect(subG); subG.connect(audioCtx.destination);
sub.start(now); sub.stop(now + 0.12);
}

// ––––––––––––––––––––––––––––––––
// ボタン定義
// ––––––––––––––––––––––––––––––––
const BUTTONS = [
{ label: “AC”,  sub: “”,     type: “fn”  },
{ label: “+/-”, sub: “”,     type: “fn”  },
{ label: “%”,   sub: “”,     type: “fn”  },
{ label: “÷”,   sub: “DIV”,  type: “op”  },
{ label: “7”,   sub: “PQRS”, type: “num” },
{ label: “8”,   sub: “TUV”,  type: “num” },
{ label: “9”,   sub: “WXYZ”, type: “num” },
{ label: “×”,   sub: “MUL”,  type: “op”  },
{ label: “4”,   sub: “GHI”,  type: “num” },
{ label: “5”,   sub: “JKL”,  type: “num” },
{ label: “6”,   sub: “MNO”,  type: “num” },
{ label: “−”,   sub: “SUB”,  type: “op”  },
{ label: “1”,   sub: “”,     type: “num” },
{ label: “2”,   sub: “ABC”,  type: “num” },
{ label: “3”,   sub: “DEF”,  type: “num” },
{ label: “+”,   sub: “ADD”,  type: “op”  },
{ label: “0”,   sub: “+”,    type: “num”, wide: true },
{ label: “.”,   sub: “”,     type: “num” },
{ label: “=”,   sub: “”,     type: “eq”  },
];

// ––––––––––––––––––––––––––––––––
// Calculator
// ––––––––––––––––––––––––––––––––
export default function HHKBCalculator() {
const [display, setDisplay] = useState(“0”);
const [prev, setPrev] = useState(null);
const [op, setOp] = useState(null);
const [waitingForOperand, setWaitingForOperand] = useState(false);
const [expression, setExpression] = useState(””);
const [pressedKey, setPressedKey] = useState(null);
const audioCtxRef = useRef(null);
// 二重入力防止: 処理中フラグ
const processingRef = useRef(false);

const getAudio = () => {
if (!audioCtxRef.current)
audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
if (audioCtxRef.current.state === “suspended”) audioCtxRef.current.resume();
return audioCtxRef.current;
};

const playSound = useCallback(() => {
try { createHHKBSound(getAudio()); } catch (e) {}
}, []);

const animateKey = (label) => {
setPressedKey(label);
setTimeout(() => setPressedKey(null), 130);
};

const handleInput = useCallback((label) => {
// 二重入力ガード
if (processingRef.current) return;
processingRef.current = true;
setTimeout(() => { processingRef.current = false; }, 80);

```
playSound();
animateKey(label);

if (label === "AC") {
  setDisplay("0"); setPrev(null); setOp(null);
  setWaitingForOperand(false); setExpression(""); return;
}
if (label === "+/-") { setDisplay(d => String(parseFloat(d) * -1)); return; }
if (label === "%")   { setDisplay(d => String(parseFloat(d) / 100)); return; }

const isOp = ["÷", "×", "−", "+"].includes(label);
if (isOp) {
  const current = parseFloat(display);
  if (prev !== null && !waitingForOperand) {
    const r = calc(prev, current, op);
    setDisplay(fmt(r)); setPrev(r);
  } else { setPrev(current); }
  setOp(label); setWaitingForOperand(true);
  setExpression(`${addCommas(display)} ${label}`); return;
}
if (label === "=") {
  if (op && prev !== null) {
    const current = parseFloat(display);
    const r = calc(prev, current, op);
    setExpression(`${addCommas(String(prev))} ${op} ${addCommas(display)} =`);
    setDisplay(fmt(r)); setPrev(null); setOp(null); setWaitingForOperand(false);
  }
  return;
}
if (label === ".") {
  if (waitingForOperand) { setDisplay("0."); setWaitingForOperand(false); return; }
  if (!display.includes(".")) setDisplay(d => d + ".");
  return;
}
if (waitingForOperand) { setDisplay(label); setWaitingForOperand(false); }
else { setDisplay(d => d === "0" ? label : d.length < 12 ? d + label : d); }
```

}, [display, prev, op, waitingForOperand, playSound]);

const handleUnit = useCallback((multiplier) => {
if (processingRef.current) return;
processingRef.current = true;
setTimeout(() => { processingRef.current = false; }, 80);
playSound();
setDisplay(d => {
const n = parseFloat(d.replace(/,/g, “”));
if (isNaN(n)) return d;
return fmt(n * multiplier);
});
}, [playSound]);

function calc(a, b, operator) {
switch (operator) {
case “+”: return a + b; case “−”: return a - b;
case “×”: return a * b; case “÷”: return b !== 0 ? a / b : NaN;
default: return b;
}
}
function fmt(n) {
if (isNaN(n)) return “Error”;
if (!isFinite(n)) return “∞”;
const s = parseFloat(n.toPrecision(10)).toString();
return s.length > 12 ? parseFloat(n.toFixed(6)).toString() : s;
}

function addCommas(str) {
if (!str || str === “Error” || str === “∞”) return str;
const neg = str.startsWith(”-”);
const abs = neg ? str.slice(1) : str;
const [int, dec] = abs.split(”.”);
const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, “,”);
const result = dec !== undefined ? formatted + “.” + dec : formatted;
return neg ? “-” + result : result;
}

useEffect(() => {
const map = { “0”:“0”,“1”:“1”,“2”:“2”,“3”:“3”,“4”:“4”,“5”:“5”,“6”:“6”,“7”:“7”,“8”:“8”,“9”:“9”,
“.”:”.”,“Enter”:”=”,“Escape”:“AC”,”+”:”+”,”-”:“−”,”*”:“×”,”/”:“÷”,”%”:”%” };
const h = (e) => { const l = map[e.key]; if (l) { e.preventDefault(); handleInput(l); } };
window.addEventListener(“keydown”, h);
return () => window.removeEventListener(“keydown”, h);
}, [handleInput]);

const rawLen = display.replace(/[,]/g, “”).length;
const displayFontSize = rawLen > 9 ? “2rem” : rawLen > 6 ? “2.6rem” : “3.2rem”;

return (
<>
<style>{`
@import url(‘https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;400;500;600;700&display=swap’);

```
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      background: #111;
      font-family: 'IBM Plex Mono', monospace;
      -webkit-font-smoothing: antialiased;
    }
    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .calc-shell {
      width: 100%;
      max-width: 480px;
      min-height: 100dvh;
      background: #1e1e20;
      display: flex;
      flex-direction: column;
    }

    @media (min-width: 481px) {
      body { align-items: center; }
      .calc-shell {
        min-height: unset;
        border-radius: 18px;
        overflow: hidden;
        box-shadow:
          0 8px 0 #0a0a0b,
          0 10px 2px rgba(0,0,0,0.6),
          0 24px 60px rgba(0,0,0,0.85);
      }
    }

    .display-area {
      flex: 1;
      background: #0d0d0f;
      padding: 28px 24px 20px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: flex-end;
      position: relative;
      overflow: hidden;
      min-height: 150px;
      box-shadow: inset 0 4px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(0,0,0,0.9);
    }

    .display-area::before {
      content: 'HHKB CALC';
      position: absolute;
      top: 14px; left: 50%;
      transform: translateX(-50%);
      font-size: 9.6px;
      letter-spacing: 5px;
      color: #9999aa;
      font-weight: 500;
    }

    .display-area::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 3px,
        rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px
      );
      pointer-events: none;
    }

    .expression {
      font-size: 22px;
      color: #aaaabc;
      letter-spacing: 1px;
      min-height: 18px;
      margin-bottom: 10px;
      position: relative; z-index: 1;
    }

    .main-display {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 600;
      color: #e8dfc0;
      letter-spacing: -1px;
      line-height: 1;
      text-shadow: 0 0 28px rgba(232,223,192,0.2);
      transition: font-size 0.1s ease;
      position: relative; z-index: 1;
    }

    .keys-plate {
      background: #171719;
      padding: 10px 10px 14px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
    }

    .key {
      border: none;
      outline: none;
      cursor: pointer;
      padding: 0;
      aspect-ratio: 1 / 1;
      position: relative;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      border-radius: 6px;
      transition: transform 0.07s cubic-bezier(0.25,0.46,0.45,0.94),
                  box-shadow 0.07s cubic-bezier(0.25,0.46,0.45,0.94);
    }

    .key-wide {
      grid-column: span 2;
      aspect-ratio: unset;
    }

    .key-num {
      background: #323236;
      box-shadow:
        0 5px 0 #141416,
        inset -2px 0 0 rgba(0,0,0,0.35),
        inset 2px 0 0 rgba(255,255,255,0.04),
        inset 0 1px 0 rgba(255,255,255,0.09),
        inset 0 3px 6px rgba(0,0,0,0.25);
    }

    .key-fn {
      background: #2c2a28;
      box-shadow:
        0 5px 0 #111110,
        inset -2px 0 0 rgba(0,0,0,0.35),
        inset 2px 0 0 rgba(255,255,255,0.03),
        inset 0 1px 0 rgba(255,255,255,0.07),
        inset 0 3px 6px rgba(0,0,0,0.28);
    }

    .key-op {
      background: #2e2818;
      box-shadow:
        0 5px 0 #100e06,
        inset -2px 0 0 rgba(0,0,0,0.4),
        inset 2px 0 0 rgba(255,255,255,0.04),
        inset 0 1px 0 rgba(201,169,110,0.15),
        inset 0 3px 6px rgba(0,0,0,0.3);
    }

    .key-eq {
      background: #3e3018;
      box-shadow:
        0 5px 0 #181208,
        inset -2px 0 0 rgba(0,0,0,0.4),
        inset 2px 0 0 rgba(255,255,255,0.05),
        inset 0 1px 0 rgba(240,216,152,0.2),
        inset 0 3px 6px rgba(0,0,0,0.25);
    }

    .key.pressed,
    .key:active {
      transform: translateY(4px);
    }

    .key-num.pressed, .key-num:active {
      box-shadow:
        0 1px 0 #141416,
        inset -2px 0 0 rgba(0,0,0,0.4),
        inset 2px 0 0 rgba(255,255,255,0.03),
        inset 0 1px 0 rgba(255,255,255,0.04),
        inset 0 4px 10px rgba(0,0,0,0.45);
      background: #29292d;
    }

    .key-fn.pressed, .key-fn:active {
      box-shadow:
        0 1px 0 #111110,
        inset -2px 0 0 rgba(0,0,0,0.4),
        inset 2px 0 0 rgba(255,255,255,0.02),
        inset 0 1px 0 rgba(255,255,255,0.03),
        inset 0 4px 10px rgba(0,0,0,0.48);
      background: #252320;
    }

    .key-op.pressed, .key-op:active {
      box-shadow:
        0 1px 0 #100e06,
        inset -2px 0 0 rgba(0,0,0,0.45),
        inset 2px 0 0 rgba(255,255,255,0.02),
        inset 0 1px 0 rgba(201,169,110,0.08),
        inset 0 4px 10px rgba(0,0,0,0.5);
      background: #252010;
    }

    .key-eq.pressed, .key-eq:active {
      box-shadow:
        0 1px 0 #181208,
        inset -2px 0 0 rgba(0,0,0,0.45),
        inset 2px 0 0 rgba(255,255,255,0.03),
        inset 0 1px 0 rgba(240,216,152,0.1),
        inset 0 4px 10px rgba(0,0,0,0.45);
      background: #332810;
    }

    .key-content {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border-radius: inherit;
      background: linear-gradient(170deg, rgba(255,255,255,0.04) 0%, transparent 50%);
    }

    .key-wide .key-content {
      flex-direction: row;
      justify-content: flex-start;
      padding-left: 22px;
      gap: 8px;
    }

    .key-main {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(20px, 5vw, 28px);
      font-weight: 500;
      color: #c8c4bc;
      line-height: 1;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8), 0 -1px 0 rgba(255,255,255,0.04);
      letter-spacing: 0.5px;
    }

    .key-fn .key-main {
      font-size: clamp(11px, 3vw, 14px);
      color: #a09070;
      font-family: 'IBM Plex Mono', monospace;
      letter-spacing: 0.3px;
    }

    .key-op .key-main {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(22px, 5.5vw, 28px);
      color: #c9a96e;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(201,169,110,0.2);
    }

    .key-eq .key-main {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(24px, 6vw, 30px);
      color: #f0d898;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 16px rgba(240,216,152,0.25);
    }

    .key-sub {
      font-size: clamp(6.5px, 1.8vw, 8.5px);
      letter-spacing: 1.8px;
      color: #7a7a82;
      font-family: 'IBM Plex Mono', monospace;
      line-height: 1;
    }

    .key-op .key-sub,
    .key-fn .key-sub,
    .key-eq .key-sub { display: none; }
    /* ==============================
       単位補助ボタン
    ============================== */
    .unit-bar {
      background: #131315;
      padding: 8px 10px 10px;
      display: flex;
      gap: 7px;
      border-top: 2px solid #0c0c0e;
    }

    .unit-btn {
      flex: 1;
      border: none;
      outline: none;
      cursor: pointer;
      background: #252528;
      border-radius: 6px;
      padding: 10px 0;
      font-family: 'IBM Plex Mono', monospace;
      font-size: clamp(11px, 3vw, 13px);
      color: #888890;
      letter-spacing: 1px;
      box-shadow:
        0 3px 0 #0e0e10,
        inset 0 1px 0 rgba(255,255,255,0.06),
        inset 0 2px 4px rgba(0,0,0,0.2);
      transition: transform 0.07s, box-shadow 0.07s, background 0.07s;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .unit-btn:active, .unit-btn.pressed {
      transform: translateY(2px);
      box-shadow: 0 1px 0 #0e0e10, inset 0 2px 6px rgba(0,0,0,0.4);
      background: #1e1e21;
      color: #c9a96e;
    }

    .unit-btn-label {
      display: block;
      font-size: clamp(13px, 3.5vw, 16px);
      color: #aaaabc;
      margin-bottom: 2px;
      font-family: 'Barlow Condensed', sans-serif;
    }

  `}</style>

  <div className="calc-shell">
    <div className="display-area">
      <div className="expression">{expression || "\u00a0"}</div>
      <div className="main-display" style={{ fontSize: displayFontSize }}>
        {addCommas(display)}
      </div>
    </div>

    <div className="keys-plate">
      {BUTTONS.map((btn) => (
        <button
          key={btn.label}
          className={[
            "key",
            `key-${btn.type}`,
            btn.wide ? "key-wide" : "",
            pressedKey === btn.label ? "pressed" : "",
          ].filter(Boolean).join(" ")}
          onPointerDown={(e) => {
            e.preventDefault(); // touchstart による mousedown の二重発火を防ぐ
            handleInput(btn.label);
          }}
        >
          <div className="key-content">
            <span className="key-main">{btn.label}</span>
            {btn.sub && <span className="key-sub">{btn.sub}</span>}
          </div>
        </button>
      ))}
    </div>

    {/* 億・万・千 補助バー */}
    <div className="unit-bar">
      {[
        { label: "億", multiplier: 100000000 },
        { label: "千万", multiplier: 10000000 },
        { label: "百万", multiplier: 1000000 },
        { label: "万", multiplier: 10000 },
        { label: "千", multiplier: 1000 },
      ].map(({ label, multiplier }) => (
        <button
          key={label}
          className="unit-btn"
          onPointerDown={(e) => { e.preventDefault(); handleUnit(multiplier); }}
        >
          <span className="unit-btn-label">{label}</span>
        </button>
      ))}
    </div>
  </div>
</>
```

);
}