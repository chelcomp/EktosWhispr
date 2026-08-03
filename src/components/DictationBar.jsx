import { useEffect, useState } from "react";

const BAR_COUNTS = { capturing: 30, transcribing: 5, processing: 35 };

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DictationBar({
  state,
  transcript = "",
  partialTranscript = "",
  autoHideMs = 5000,
  onAutoHide,
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== "capturing" && state !== "transcribing") return undefined;
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== "error") return undefined;
    const id = setTimeout(() => onAutoHide?.(), autoHideMs);
    return () => clearTimeout(id);
  }, [state, autoHideMs, onAutoHide]);

  const liveText = `${transcript} ${partialTranscript}`.trim();
  const words = liveText.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] ?? "";
  const caption = words.slice(0, -1).join(" ");
  const barCount = BAR_COUNTS[state] ?? 0;

  return (
    <div className="dictation-bar" data-state={state}>
      {state === "error" ? (
        <div className="dictation-bar__error">
          <span className="dictation-bar__error-icon">!</span>
          <span className="dictation-bar__marquee">
            <span>Could not access the microphone — check system permissions.</span>
          </span>
        </div>
      ) : (
        <>
          {(state === "capturing" || state === "transcribing" || state === "processing") && (
            <div className={`dictation-bar__eq eq-${state}`}>
              {Array.from({ length: barCount }, (_, i) => (
                <span key={i} className="bar" style={{ animationDelay: `${(i % 8) * 0.09}s` }} />
              ))}
            </div>
          )}
          {state === "transcribing" && (
            <div className="dictation-bar__caption">
              <span className="dictation-bar__caption-inner">
                {caption ? <>{caption} </> : null}
                <span className="dictation-bar__caption-last">{lastWord}</span>
              </span>
            </div>
          )}
          {state === "processing" && <span className="dictation-bar__shine" />}
          {(state === "capturing" || state === "transcribing") && (
            <span className="dictation-bar__timer">{formatElapsed(elapsed)}</span>
          )}
        </>
      )}
    </div>
  );
}
