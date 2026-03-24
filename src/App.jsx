import { useEffect, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "pomodoro-flow-settings";

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function clampMinutes(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return fallback;
  return Math.min(180, Math.floor(num));
}

export default function App() {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);

  const [mode, setMode] = useState("Pomodoro");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [soundOn, setSoundOn] = useState(true);

  const audioContextRef = useRef(null);

  function getDuration(selectedMode, f = focusMinutes, s = shortBreakMinutes, l = longBreakMinutes) {
    if (selectedMode === "Pomodoro") return f * 60;
    if (selectedMode === "Short Break") return s * 60;
    return l * 60;
  }

  function playBeep() {
    if (!soundOn) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      const nextFocus = clampMinutes(parsed.focusMinutes, 25);
      const nextShort = clampMinutes(parsed.shortBreakMinutes, 5);
      const nextLong = clampMinutes(parsed.longBreakMinutes, 15);
      const nextMode =
        parsed.mode === "Short Break" || parsed.mode === "Long Break"
          ? parsed.mode
          : "Pomodoro";

      setFocusMinutes(nextFocus);
      setShortBreakMinutes(nextShort);
      setLongBreakMinutes(nextLong);
      setMode(nextMode);
      setTimeLeft(
        typeof parsed.timeLeft === "number" && parsed.timeLeft > 0
          ? Math.min(parsed.timeLeft, getDuration(nextMode, nextFocus, nextShort, nextLong))
          : getDuration(nextMode, nextFocus, nextShort, nextLong)
      );
      setSessions(Number(parsed.sessions) || 0);
      setSoundOn(parsed.soundOn !== false);
    } catch {
      // ignore broken saved data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        focusMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        mode,
        timeLeft,
        sessions,
        soundOn,
      })
    );
  }, [focusMinutes, shortBreakMinutes, longBreakMinutes, mode, timeLeft, sessions, soundOn]);

  useEffect(() => {
    document.title = `${formatTime(timeLeft)} • ${mode}`;
    return () => {
      document.title = "Pomodoro Flow";
    };
  }, [timeLeft, mode]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev > 1) return prev - 1;

        if (mode === "Pomodoro") {
          let nextMode = "Short Break";
          let nextDuration = shortBreakMinutes * 60;

          setSessions((current) => {
            const nextSessions = current + 1;
            if (nextSessions % 4 === 0) {
              nextMode = "Long Break";
              nextDuration = longBreakMinutes * 60;
            }
            return nextSessions;
          });

          setMode(nextMode);
          playBeep();
          return nextDuration;
        }

        setMode("Pomodoro");
        playBeep();
        return focusMinutes * 60;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, mode, focusMinutes, shortBreakMinutes, longBreakMinutes, soundOn]);

  function switchMode(nextMode) {
    setIsRunning(false);
    setMode(nextMode);
    setTimeLeft(getDuration(nextMode));
  }

  function handleStartPause() {
    setIsRunning((prev) => !prev);
  }

  function handleReset() {
    setIsRunning(false);
    setMode("Pomodoro");
    setTimeLeft(focusMinutes * 60);
    setSessions(0);
  }

  function updateMinutes(type, value) {
    const num = clampMinutes(
      value,
      type === "focus" ? 25 : type === "short" ? 5 : 15
    );

    if (type === "focus") {
      setFocusMinutes(num);
      if (mode === "Pomodoro") {
        setIsRunning(false);
        setTimeLeft(num * 60);
      }
    }

    if (type === "short") {
      setShortBreakMinutes(num);
      if (mode === "Short Break") {
        setIsRunning(false);
        setTimeLeft(num * 60);
      }
    }

    if (type === "long") {
      setLongBreakMinutes(num);
      if (mode === "Long Break") {
        setIsRunning(false);
        setTimeLeft(num * 60);
      }
    }
  }

  const totalTime = getDuration(mode);
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🍅</div>
          <div>
            <h1>Pomodoro Flow</h1>
            <p>Cozy focus timer theme</p>
          </div>
        </div>
      </header>

      <main className="hero-card">
        <div className="mode-switch">
          <button
            className={mode === "Pomodoro" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("Pomodoro")}
          >
            Pomodoro
          </button>
          <button
            className={mode === "Short Break" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("Short Break")}
          >
            Short Break
          </button>
          <button
            className={mode === "Long Break" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("Long Break")}
          >
            Long Break
          </button>
        </div>

        <div className="mascot-wrap">
          <div className="mascot-scene">
            <div className="tomato-top">
              <div className="leaf leaf-left"></div>
              <div className="leaf leaf-right"></div>
              <div className="tomato-body"></div>
            </div>

            <div className="hamster">
              <div className="ear ear-left"></div>
              <div className="ear ear-right"></div>
              <div className="face">
                <div className="eye eye-left"></div>
                <div className="eye eye-right"></div>
                <div className="nose"></div>
                <div className="mouth"></div>
                <div className="blush blush-left"></div>
                <div className="blush blush-right"></div>
              </div>
            </div>

            <div className="laptop-css">
              <div className="screen"></div>
              <div className="base"></div>
            </div>
          </div>
        </div>

        <div className="timer-block">
          <div className="timer">{formatTime(timeLeft)}</div>

          <div className="controls">
            <button className="icon-btn secondary-btn" onClick={handleReset} title="Reset">
              ↺
            </button>
            <button className="icon-btn play-btn" onClick={handleStartPause} title="Start / Pause">
              {isRunning ? "❚❚" : "▶"}
            </button>
          </div>
        </div>

        <div className="progress-shell">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span>Current Mode</span>
            <strong>{mode}</strong>
          </div>
          <div className="stat-card">
            <span>Completed Sessions</span>
            <strong>{sessions}</strong>
          </div>
        </div>

        <section className="settings-card">
          <div className="settings-header">
            <h2>Customize Timer</h2>
            <button
              className={soundOn ? "sound-btn active-sound" : "sound-btn"}
              onClick={() => setSoundOn((prev) => !prev)}
            >
              {soundOn ? "Sound On" : "Sound Off"}
            </button>
          </div>

          <div className="settings-grid">
            <label className="setting-item">
              <span>Pomodoro</span>
              <input
                type="number"
                min="1"
                max="180"
                value={focusMinutes}
                onChange={(e) => updateMinutes("focus", e.target.value)}
              />
            </label>

            <label className="setting-item">
              <span>Short Break</span>
              <input
                type="number"
                min="1"
                max="180"
                value={shortBreakMinutes}
                onChange={(e) => updateMinutes("short", e.target.value)}
              />
            </label>

            <label className="setting-item">
              <span>Long Break</span>
              <input
                type="number"
                min="1"
                max="180"
                value={longBreakMinutes}
                onChange={(e) => updateMinutes("long", e.target.value)}
              />
            </label>
          </div>

          <p className="settings-note">
            Settings are saved automatically in your browser.
          </p>
        </section>
      </main>
    </div>
  );
}