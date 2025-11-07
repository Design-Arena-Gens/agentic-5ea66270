"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AgendaItem = {
  id: string;
  title: string;
  description: string;
  duration: number;
  accent: string;
};

type SlideContext = {
  item: AgendaItem;
  index: number;
  total: number;
  focus: number;
};

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

const defaultAgenda: AgendaItem[] = [
  {
    id: makeId(),
    title: "Mirëseardhje",
    description: "Përshëndetja hyrëse dhe prezantimi i ekipit organizator.",
    duration: 5,
    accent: "#6366f1",
  },
  {
    id: makeId(),
    title: "Agjenda e Ditës",
    description:
      "Rënditja e aktiviteteve kryesore dhe pritshmëritë për secilën prej tyre.",
    duration: 6,
    accent: "#14b8a6",
  },
  {
    id: makeId(),
    title: "Diskutime Kryesore",
    description:
      "Tema të hapura për koment, bashkëpunim dhe vendimmarrje të përbashkët.",
    duration: 6,
    accent: "#f97316",
  },
  {
    id: makeId(),
    title: "Mbyllja",
    description:
      "Pikat kryesore të përmbledhura dhe hapat e ardhshëm për pjesëmarrësit.",
    duration: 5,
    accent: "#ec4899",
  },
];

const accentPalette = [
  "#6366f1",
  "#22d3ee",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#8b5cf6",
  "#facc15",
];

export default function Home() {
  const [agenda, setAgenda] = useState<AgendaItem[]>(defaultAgenda);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [durationInput, setDurationInput] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationAbortRef = useRef<boolean>(false);

  const selectedItem = agenda[selectedIndex] ?? null;

  const totalDuration = useMemo(
    () => agenda.reduce((acc, item) => acc + item.duration, 0),
    [agenda],
  );

  useEffect(() => {
    setSelectedIndex((current) =>
      Math.min(current, Math.max(agenda.length - 1, 0)),
    );
  }, [agenda.length]);

  useEffect(() => {
    if (!videoUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (isGenerating || !selectedItem) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    drawSlide(ctx, {
      item: selectedItem,
      index: selectedIndex,
      total: agenda.length,
      focus: 0,
    });
  }, [agenda, isGenerating, selectedIndex, selectedItem]);

  const handleAddItem = () => {
    if (!titleInput.trim() || !descriptionInput.trim() || durationInput <= 0) {
      return;
    }

    const paletteChoice =
      accentPalette[agenda.length % accentPalette.length] ?? "#38bdf8";

    const newItem: AgendaItem = {
      id: makeId(),
      title: titleInput.trim(),
      description: descriptionInput.trim(),
      duration: Math.max(2, Math.min(durationInput, 60)),
      accent: paletteChoice,
    };

    setAgenda((items) => [...items, newItem]);
    setTitleInput("");
    setDescriptionInput("");
    setDurationInput(5);
    setSelectedIndex((current) => (current === -1 ? 0 : current));
  };

  const handleRemoveItem = (itemId: string) => {
    setAgenda((items) => items.filter((item) => item.id !== itemId));
  };

  const generateVideo = useCallback(async () => {
    if (agenda.length === 0) {
      setError("Shtoni të paktën një pikë përpara se të gjeneroni videon.");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (!("MediaRecorder" in window)) {
      setError(
        "Ky shfletues nuk mbështet MediaRecorder. Përdorni Chrome ose Edge.",
      );
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Canvas nuk gjendet.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Canvas nuk mund të inicializohet.");
      return;
    }

    animationAbortRef.current = false;
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    const stream = canvas.captureStream(30);
    const preferredMime = "video/webm;codecs=vp9";
    const mimeType = MediaRecorder.isTypeSupported(preferredMime)
      ? preferredMime
      : "video/webm";
    const recorder = new MediaRecorder(stream, {
      mimeType,
    });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const recordingDone = new Promise<string>((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        resolve(URL.createObjectURL(blob));
      };
      recorder.onerror = (event) => {
        reject(
          event.error instanceof Error
            ? event.error
            : new Error("Pati një problem gjatë regjistrimit."),
        );
      };
    });

    recorder.start();

    try {
      const fps = 30;
      const frameDelay = 1000 / fps;

      for (let index = 0; index < agenda.length; index += 1) {
        if (animationAbortRef.current) {
          break;
        }

        const item = agenda[index];
        const totalFrames = Math.max(1, Math.round(item.duration * fps));
        const accent = item.accent;
        const baseProgress = (index / agenda.length) * 100;

        for (let frame = 0; frame < totalFrames; frame += 1) {
          if (animationAbortRef.current) {
            break;
          }

          drawSlide(ctx, {
            item: { ...item, accent },
            index,
            total: agenda.length,
            focus: frame / totalFrames,
          });

          if (frame % fps === 0) {
            setProgress(Math.min(99, Math.round(baseProgress)));
          }

          await delay(frameDelay);
        }

        setProgress(Math.min(99, Math.round(((index + 1) / agenda.length) * 100)));
      }
    } catch (recordError) {
      console.error(recordError);
      setError("Pati një problem gjatë gjenerimit të videos.");
    } finally {
      recorder.stop();
      try {
        const url = await recordingDone;
        if (!animationAbortRef.current) {
          setVideoUrl(url);
          setProgress(100);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (recordError) {
        console.error(recordError);
        setError("Video nuk u ruajt siç duhet.");
      }

      setIsGenerating(false);
      animationAbortRef.current = false;
    }
  }, [agenda, videoUrl]);

  const cancelGeneration = () => {
    if (!isGenerating) {
      return;
    }
    animationAbortRef.current = true;
    setError("Gjenerimi u anulua.");
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 text-slate-50 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[1.1fr,0.9fr] xl:px-8">
        <div className="space-y-8">
          <header className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Video Agjenda
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
              Krijoni video të shpejta prezantuese me agjendën tuaj.
            </h1>
            <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
              Shtoni temat kryesore, përcaktoni kohëzgjatjen dhe gjeneroni një
              video informuese për ta shpërndarë me ekipin ose anëtarët tuaj.
            </p>
          </header>

          <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-slate-100">
              Pikat e agjendës
            </h2>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(140px,0.4fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                  placeholder="Titulli"
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  disabled={isGenerating}
                />
                <input
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                  placeholder="Përshkrimi"
                  value={descriptionInput}
                  onChange={(event) => setDescriptionInput(event.target.value)}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={60}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                  value={durationInput}
                  onChange={(event) => setDurationInput(Number(event.target.value))}
                  disabled={isGenerating}
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={isGenerating}
                  className="whitespace-nowrap rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-400/60"
                >
                  Shto pikë
                </button>
              </div>
            </div>

            <ul className="space-y-3">
              {agenda.map((item, index) => {
                const active = index === selectedIndex;
                return (
                  <li
                    key={item.id}
                    className={`group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 transition hover:border-cyan-400/70 hover:bg-slate-900 ${
                      active ? "border-cyan-400/70 shadow-[0_0_0_2px_rgba(34,211,238,0.35)]" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className="flex flex-1 items-start gap-3 text-left"
                      disabled={isGenerating}
                    >
                      <span
                        className="mt-1 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.accent }}
                      />
                      <span className="flex-1 space-y-1">
                        <span className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            {index + 1 < 10 ? `0${index + 1}` : index + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-50">
                            {item.title}
                          </span>
                        </span>
                        <span className="text-sm text-slate-300">
                          {item.description}
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs font-medium text-slate-400">
                        {item.duration} sek
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={agenda.length <= 1 || isGenerating}
                        className="text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:text-rose-200 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        Hiq
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-900/50 px-5 py-4 text-sm text-slate-200">
              <span>
                Koha totale e videos:{" "}
                <strong className="font-semibold text-cyan-300">
                  {totalDuration} sekonda
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateVideo}
                  disabled={isGenerating}
                  className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-400/60"
                >
                  Gjenero video
                </button>
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={cancelGeneration}
                    className="rounded-xl border border-rose-500/70 px-4 py-2 font-semibold text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                  >
                    Anulo
                  </button>
                ) : null}
              </div>
            </div>
            {error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-lg">
            <div className="flex items-center justify-between px-1 pb-4">
              <span className="text-sm font-semibold text-slate-200">
                Pamja e videos
              </span>
              <span className="text-xs text-slate-400">
                {isGenerating ? `Gjenerimi… ${progress}%` : "Paraqitje"}
              </span>
            </div>

            <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg">
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="h-full w-full object-cover"
              />
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80">
                  <svg
                    className="h-10 w-10 animate-spin text-cyan-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6-8.485" />
                  </svg>
                  <span className="text-sm font-medium text-slate-300">
                    Po krijojmë videon…
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {videoUrl ? (
            <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-100">
                Videoja e gjeneruar
              </h2>
              <video
                key={videoUrl}
                controls
                className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                <source src={videoUrl} type="video/webm" />
              </video>
              <a
                href={videoUrl}
                download="video-agjenda.webm"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/80 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
              >
                Shkarko videon
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 17l4 4 4-4" />
                  <path d="M12 12v9" />
                  <path d="M20 12a8 8 0 1 0-16 0v5" />
                </svg>
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function drawSlide(ctx: CanvasRenderingContext2D, data: SlideContext) {
  const { item, index, total, focus } = data;
  const { canvas } = ctx;
  const { width, height } = canvas;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, hexWithOpacity(item.accent, 0.35));
  gradient.addColorStop(1, hexWithOpacity("#0f172a", 0.95));

  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawBackdrop(ctx, width, height, item.accent);
  drawHeader(ctx, item, index, total, width);
  drawBody(ctx, item, width, height);
  drawProgress(ctx, width, height, index, total, focus);

  ctx.restore();
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: string,
) {
  const orbCount = 3;
  for (let i = 0; i < orbCount; i += 1) {
    const radius = (width / (4 + i * 2)) * 0.8;
    const x = width * 0.3 + i * radius * 0.8;
    const y = height * (0.6 - i * 0.05);
    const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    gradient.addColorStop(0, hexWithOpacity(accent, 0.5 / (i + 1)));
    gradient.addColorStop(1, "rgba(2, 6, 23, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  item: AgendaItem,
  index: number,
  total: number,
  width: number,
) {
  ctx.fillStyle = hexWithOpacity(item.accent, 0.85);
  ctx.font = "600 42px 'Geist', 'Inter', sans-serif";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.translate(width * 0.08, 110);
  roundedRect(ctx, 0, 0, 160, 66, 33);
  ctx.fill();

  ctx.fillStyle = "#020617";
  ctx.font = "700 32px 'Geist', 'Inter', sans-serif";
  ctx.fillText(
    `#${index + 1}/${total}`,
    40,
    33,
  );
  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  item: AgendaItem,
  width: number,
  height: number,
) {
  ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
  roundedRect(ctx, width * 0.08, height * 0.22, width * 0.84, height * 0.6, 40);
  ctx.fill();

  ctx.save();
  ctx.translate(width * 0.11, height * 0.3);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 72px 'Geist', 'Inter', sans-serif";
  const titleLines = wrapText(ctx, item.title.toUpperCase(), width * 0.76);
  titleLines.forEach((line, lineIndex) => {
    ctx.fillText(line, 0, lineIndex * 84);
  });

  ctx.fillStyle = "rgba(226, 232, 240, 0.86)";
  ctx.font = "400 36px 'Geist', 'Inter', sans-serif";
  const descriptionLines = wrapText(ctx, item.description, width * 0.72);
  const offsetY = titleLines.length * 84 + 60;
  descriptionLines.forEach((line, lineIndex) => {
    ctx.fillText(line, 0, offsetY + lineIndex * 48);
  });
  ctx.restore();
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  index: number,
  total: number,
  focus: number,
) {
  const barWidth = width * 0.84;
  const barHeight = 16;
  const x = width * 0.08;
  const y = height * 0.84;

  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  roundedRect(ctx, x, y, barWidth, barHeight, barHeight / 2);
  ctx.fill();

  const progress = Math.min(1, (index + Math.max(0, Math.min(focus, 1))) / total);
  const filledWidth = barWidth * progress;

  const gradient = ctx.createLinearGradient(x, y, x + filledWidth, y);
  gradient.addColorStop(0, "#06b6d4");
  gradient.addColorStop(1, "#a855f7");

  if (filledWidth > 0) {
    ctx.fillStyle = gradient;
    roundedRect(ctx, x, y, filledWidth, barHeight, barHeight / 2);
    ctx.fill();
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function hexWithOpacity(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}
