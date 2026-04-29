import { useState, useCallback, useEffect, useRef } from "react";

// --- HHKB Topre switch sound synthesizer ---
function createHHKBSound(audioCtx) {
  const now = audioCtx.currentTime;
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.18, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  masterGain.connect(audioCtx.destination);

  // Thock body: filtered noise burst
  const bufferSize = audioCtx.sampleRate * 0.1;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 900;
  bandpass.Q.value = 0.8;

  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2200;

  noise.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.1);

  // Subtle transient click
  const clickOsc = audioCtx.createOscillator();
  clickOsc.frequency.setValueAtTime(1800, now);
  clickOsc.frequency.exponentialRampToValueAtTime(400, now + 0.015);
  const clickGain = audioCtx.createGain();
  clickGain.gain.setValueAtTime(0.06, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  clickOsc.connect(clickGain);
  clickGain.connect(audioCtx.destination);
  clickOsc.start(now);
  clickOsc.stop(now + 0.02);
}

const BUTTONS = [
  { label: "AC", type: "fn", wide: false },
  { label: "+/-", type: "fn" },
  { label: "%", type: "fn" },
  { label: "÷", type: "op" },
  { label: "7", type: "num" },
  { label: "8", type: "num" },
  { label: "9", type: "num" },
  { label: "×", type: "op" },
  { label: "4", type: "num" },
  { label: "5", type: "num" },
  { label: "6", type: "num" },
  { label: "−", type: "op" },
  { label: "1", type: "num" },
  { label: "2", type: "num" },
  { label: "3", type: "num" },
  { label: "+", type: "op" },
  { label: "0", type: "num", wide: true },
  { label: ".", type: "num" },
  { label: "=", type: "eq" },
];

export default function HHKBCalculator() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState("");
  const [pressedKey, setPressedKey] = useState(null);
  const audioCtxRef = useRef(null);

  const getAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playSound = useCallback(() => {
    try {
      createHHKBSound(getAudio());
    } catch (e) {}
  }, []);

  const animateKey = (label) => {
    setPressedKey(label);
    setTimeout(() => setPressedKey(null), 100);
  };

  const handleInput = useCallback((label) => {
    playSound();
    animateKey(label);

    if (label === "AC") {
      setDisplay("0"); setPrev(null); setOp(null);
      setWaitingForOperand(false); setExpression("");
      return;
    }
    if (label === "+/-") {
      setDisplay(d => String(parseFloat(d) * -1));
      return;
    }
    if (label === "%") {
      setDisplay(d => String(parseFloat(d) / 100));
      return;
    }

    const isOp = ["÷", "×", "−", "+"].includes(label);
    if (isOp) {
      const current = parseFloat(display);
      if (prev !== null && !waitingForOperand) {
        const result = calculate(prev, current, op);
        setDisplay(formatResult(result));
        setPrev(result);
      } else {
        setPrev(current);
      }
      setOp(label);
      setWaitingForOperand(true);
      setExpression(`${display} ${label}`);
      return;
    }

    if (label === "=") {
      if (op && prev !== null) {
        const current = parseFloat(display);
        const result = calculate(prev, current, op);
        setExpression(`${prev} ${op} ${display} =`);
        setDisplay(formatResult(result));
        setPrev(null); setOp(null); setWaitingForOperand(false);
      }
      return;
    }

    if (label === ".") {
      if (waitingForOperand) {
        setDisplay("0."); setWaitingForOperand(false); return;
      }
      if (!display.includes(".")) setDisplay(d => d + ".");
      return;
    }

    // Number
    if (waitingForOperand) {
      setDisplay(label); setWaitingForOperand(false);
    } else {
      setDisplay(d => d === "0" ? label : d.length < 12 ? d + label : d);
    }
  }, [display, prev, op, waitingForOperand, playSound]);

  function calculate(a, b, operator) {
    switch (operator) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : NaN;
      default: return b;
    }
  }

  function formatResult(n) {
    if (isNaN(n)) return "Error";
    if (!isFinite(n)) return "∞";
    const s = parseFloat(n.toPrecision(10)).toString();
    return s.length > 12 ? parseFloat(n.toFixed(6)).toString() : s;
  }

  // Keyboard support
  useEffect(() => {
    const map = {
      "0":"0","1":"1","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9",
      ".":".","Enter":"=","Escape":"AC","+":"+","-":"−","*":"×","/":"÷","%":"%"
    };
    const handler = (e) => {
      const label = map[e.key];
      if (label) { e.preventDefault(); handleInput(label); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleInput]);

  const displayFontSize = display.length > 9 ? "2rem" : display.length > 6 ? "2.6rem" : "3.2rem";

  return (
    <>
      <style>{`
    

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #1a1a1a;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'IBM Plex Mono', monospace;
        }

        .calc-shell {
          background: #2c2c2c;
          border-radius: 14px;
          padding: 20px;
          box-shadow:
            0 2px 0px #111,
            0 4px 0px #0d0d0d,
            0 8px 32px rgba(0,0,0,0.7),
            inset 0 1px 0 rgba(255,255,255,0.06);
          width: 320px;
          position: relative;
        }

        .calc-shell::before {
          content: 'HHKB CALC';
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          letter-spacing: 4px;
          color: #555;
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 400;
        }

        .display-area {
          background: #141414;
          border-radius: 8px;
          padding: 18px 18px 14px;
          margin-top: 18px;
          margin-bottom: 16px;
          min-height: 100px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: flex-end;
          border: 1px solid #1f1f1f;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);
          position: relative;
          overflow: hidden;
        }

        .display-area::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
        }

        .expression {
          font-size: 11px;
          color: #4a4a4a;
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 300;
          letter-spacing: 1px;
          min-height: 16px;
          margin-bottom: 6px;
        }

        .main-display {
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          color: #e8dfc0;
          transition: font-size 0.1s ease;
          letter-spacing: -1px;
          line-height: 1;
          text-shadow: 0 0 20px rgba(232, 223, 192, 0.15);
        }

        .keys-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .key {
          border: none;
          outline: none;
          cursor: pointer;
          border-radius: 7px;
          padding: 0;
          height: 62px;
          position: relative;
          transition: transform 0.06s ease;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.5px;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }

        .key-top {
          position: absolute;
          inset: 0;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 500;
          transition: transform 0.06s ease, box-shadow 0.06s ease;
        }

        /* Base key colors */
        .key-num .key-top {
          background: linear-gradient(180deg, #424242 0%, #363636 100%);
          color: #d4cbb0;
          box-shadow:
            0 3px 0 #222,
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 0 0 1px rgba(255,255,255,0.04);
        }

        .key-fn .key-top {
          background: linear-gradient(180deg, #4a4740 0%, #3e3b35 100%);
          color: #a09880;
          box-shadow:
            0 3px 0 #222,
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset 0 0 0 1px rgba(255,255,255,0.04);
        }

        .key-op .key-top {
          background: linear-gradient(180deg, #5a5040 0%, #4a4235 100%);
          color: #c9a96e;
          box-shadow:
            0 3px 0 #1e1a12,
            inset 0 1px 0 rgba(255,255,255,0.08),
            inset 0 0 0 1px rgba(201,169,110,0.1);
        }

        .key-eq .key-top {
          background: linear-gradient(180deg, #7a6840 0%, #685835 100%);
          color: #f0d898;
          box-shadow:
            0 3px 0 #2a2010,
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 0 0 1px rgba(240,216,152,0.15);
        }

        /* Wide key (0) */
        .key-wide {
          grid-column: span 2;
        }
        .key-wide .key-top {
          justify-content: flex-start;
          padding-left: 22px;
        }

        /* Press state */
        .key.pressed .key-top,
        .key:active .key-top {
          transform: translateY(2px);
          box-shadow:
            0 1px 0 #222,
            inset 0 1px 0 rgba(0,0,0,0.1);
        }

        /* Keycap texture — subtle dot pattern */
        .key-top::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 7px;
          background-image: radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 4px 4px;
          pointer-events: none;
        }

        /* Small legend dots (HHKB style) */
        .key-num .key-top::after,
        .key-fn .key-top::after {
          content: '';
          position: absolute;
          bottom: 7px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
        }

        .scanline {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.03) 2px,
            rgba(0,0,0,0.03) 4px
          );
          pointer-events: none;
          border-radius: 8px;
        }
      `}</style>

      <div className="calc-shell">
        <div className="display-area">
          <div className="scanline" />
          <div className="expression">{expression || "\u00a0"}</div>
          <div className="main-display" style={{ fontSize: displayFontSize }}>
            {display}
          </div>
        </div>

        <div className="keys-grid">
          {BUTTONS.map((btn) => (
            <button
              key={btn.label}
              className={`key key-${btn.type}${btn.wide ? " key-wide" : ""}${pressedKey === btn.label ? " pressed" : ""}`}
              onMouseDown={() => handleInput(btn.label)}
            >
              <div className="key-top">{btn.label}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
