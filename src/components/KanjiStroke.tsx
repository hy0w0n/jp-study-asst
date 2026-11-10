"use client";

import { useEffect, useRef, useState } from "react";
import type HanziWriter from "hanzi-writer";
import { loadCharData } from "@/lib/kanji/loader";

// 토큰 기준: docs/design.md (hanzi-writer는 CSS 변수를 못 읽어서 값으로 둔다)
const INK = "#1f1b16";
const LINE = "#e7e0d4";
const ACCENT = "#9e3d3f";
const MAX_SIZE = 300;

type Status = "loading" | "ready" | "nodata" | "error";
type Mode = "idle" | "play" | "step" | "quiz";

// 일본식 획순: 채워지는 재생 · 한 획씩 · 따라 쓰기 · 1×/2×
export default function KanjiStroke({ char }: { char: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const autoPlayed = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [total, setTotal] = useState(0);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>("idle");
  const [step, setStep] = useState(0);
  const [drawn, setDrawn] = useState(0);
  const [complete, setComplete] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // 속도 옵션을 바꾸는 API가 없어서 speed가 바뀌면 writer를 새로 만든다. attempt는 [다시 시도]용
  useEffect(() => {
    const el = targetRef.current;
    const box = boxRef.current;
    if (!el || !box) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;

    (async () => {
      // 획순 데이터·hanzi-writer 모듈 어느 쪽이든 네트워크로 받다 실패하면 오류 상태
      let data, HW;
      try {
        data = await loadCharData(char);
        HW = data && (await import("hanzi-writer")).default;
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;
      if (!data || !HW) {
        setStatus("nodata");
        return;
      }

      el.innerHTML = "";
      const size = Math.min(box.clientWidth, MAX_SIZE);
      const writer = HW.create(el, char, {
        width: size,
        height: size,
        padding: 8,
        showOutline: true,
        showCharacter: false,
        strokeColor: INK,
        outlineColor: LINE,
        highlightColor: ACCENT,
        drawingColor: ACCENT,
        strokeAnimationSpeed: speed,
        delayBetweenStrokes: 250,
        charDataLoader: (c, onLoad, onError) => {
          loadCharData(c).then((d) => (d ? onLoad(d) : onError(new Error("no-data"))), onError);
        },
      });
      writerRef.current = writer;
      setTotal(data.strokes.length);
      setStatus("ready");
      setMode("idle");
      setStep(0);
      setDrawn(0);
      setComplete(false);

      observer = new ResizeObserver(() => {
        const s = Math.min(box.clientWidth, MAX_SIZE);
        writer.updateDimensions({ width: s, height: s });
      });
      observer.observe(box);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!autoPlayed.current && !reduceMotion) {
        autoPlayed.current = true;
        play(writer);
      } else {
        writer.showCharacter();
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      writerRef.current?.cancelQuiz();
      writerRef.current = null;
      el.innerHTML = ""; // 안 비우면 SVG가 겹쳐 쌓인다
    };
  }, [char, speed, attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  function play(writer = writerRef.current) {
    if (!writer) return;
    setMode("play");
    setComplete(false);
    writer.animateCharacter({
      onComplete: () => setMode((m) => (m === "play" ? "idle" : m)),
    });
  }

  function nextStroke() {
    const writer = writerRef.current;
    if (!writer) return;
    let i = step;
    if (mode !== "step" || step >= total) {
      writer.hideCharacter({ duration: 0 });
      i = 0;
      setMode("step");
      setComplete(false);
    }
    writer.animateStroke(i);
    setStep(i + 1);
  }

  function startQuiz() {
    const writer = writerRef.current;
    if (!writer) return;
    setMode("quiz");
    setDrawn(0);
    setComplete(false);
    writer.quiz({
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      onCorrectStroke: (d) => setDrawn(d.strokeNum + 1),
      onComplete: () => setComplete(true),
    });
  }

  const ready = status === "ready";
  const progress =
    mode === "step" ? `${step} / ${total}` : mode === "quiz" ? `${drawn} / ${total}` : null;

  return (
    <section aria-label="획순">
      <div className="flex h-6 items-center justify-between text-sm text-muted">
        <span>{ready ? `총 ${total}획` : " "}</span>
        {progress && (
          <span aria-live="polite" className="font-medium text-accent tabular-nums">
            {mode === "quiz" ? "따라 쓰기 " : "한 획씩 "}
            {progress}
          </span>
        )}
      </div>

      <div
        ref={boxRef}
        className="relative mx-auto mt-2 aspect-square w-full max-w-[300px] touch-none select-none overflow-hidden rounded-[6px] border border-line bg-surface"
      >
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <span className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-line" />
        <div ref={targetRef} data-testid="stroke-canvas" className="absolute inset-0" />

        {status === "loading" && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            획순 불러오는 중…
          </p>
        )}
        {status === "nodata" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span lang="ja" className="font-brush text-[96px] leading-none text-ink">
              {char}
            </span>
            <p className="text-base text-ink">이 글자는 획순 데이터가 없어요</p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span lang="ja" className="font-brush text-[96px] leading-none text-ink">
              {char}
            </span>
            <p role="alert" className="text-base text-ink">
              연결이 불안정해서 획순을 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={retry}
              className="h-11 rounded-[14px] border border-accent bg-surface px-5 text-[15px] font-semibold text-accent active:bg-accent-soft"
            >
              다시 시도
            </button>
          </div>
        )}
        {complete && (
          <p
            role="status"
            className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ok px-4 py-1.5 text-sm font-semibold text-white"
          >
            완성!
          </p>
        )}
      </div>

      {ready && (
        <div className="mt-4 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <ControlButton active={mode === "play"} onClick={() => play()}>
            ▶ 재생
          </ControlButton>
          <ControlButton active={mode === "step"} onClick={nextStroke}>
            한 획씩
          </ControlButton>
          <ControlButton active={mode === "quiz"} onClick={startQuiz}>
            따라 쓰기
          </ControlButton>
          <button
            type="button"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
            aria-label={`재생 속도 ${speed}배, 눌러서 바꾸기`}
            className="h-11 min-w-12 rounded-[14px] border border-line bg-surface px-3 text-[15px] font-semibold text-ink tabular-nums active:bg-accent-soft"
          >
            {speed}×
          </button>
        </div>
      )}
    </section>
  );
}

function ControlButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-[14px] border text-[15px] font-semibold active:opacity-90 ${
        active ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}
