import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from "react-konva";
import type { Box, ImageItem, Rules } from "../types";
import useImage from "use-image";
import { v4 as uuidv4 } from "uuid";

type Props = {
  item: ImageItem;
  classMap: Record<string | number, string>;
  rules: Rules;
  onChange: (boxes: Box[]) => void;
};

type Mode = "select" | "draw" | "erase";
type KRect = Box & { selected?: boolean };

const COLOR_MAP: Record<string, string> = {
  cell: "#E6FF00",     // neon yellow
  microgel: "#2A9D8F"  // teal
};
const PALETTE = ["#e76f51", "#3a86ff", "#ff006e", "#8338ec", "#fb5607", "#06d6a0"];

function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function BoxEditor({ item, classMap, rules, onChange }: Props) {
  const [image] = useImage(item.url, "anonymous");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [boxes, setBoxes] = useState<KRect[]>(item.boxes as KRect[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [drawStart, setDrawStart] = useState<{x:number,y:number} | null>(null);
  const [activeClassId, setActiveClassId] = useState<number>(() => {
    const keys = Object.keys(classMap); const k = (keys.length ? Number(keys[0]) : 0);
    return Number.isFinite(k) ? k : 0;
  });

  // scale to fit width
  useEffect(() => {
    const maxW = Math.min(820, containerRef.current?.clientWidth || 820);
    if (!item.width) return;
    const s = Math.min(1, maxW / item.width);
    setScale(s);
  }, [item.width]);

  useEffect(() => { onChange(boxes); }, [boxes]);
  useEffect(() => { setBoxes(item.boxes as KRect[]); setSelectedId(null); }, [item.id]);

  // shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMode("select");
      if (e.key.toLowerCase() === "r") setMode("draw");
      if (e.key.toLowerCase() === "d") setMode("erase");
      if (e.key === "Delete" || e.key === "Backspace") {
        if (mode === "select" && selectedId) {
          setBoxes(prev => prev.filter(b => b.id !== selectedId));
          setSelectedId(null);
        }
      }
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        const idx = Number(e.key) - 1;
        const ids = Object.keys(classMap).map(k => Number(k));
        if (ids[idx] !== undefined) setActiveClassId(ids[idx]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, mode, classMap]);

  function stageToImage(p: {x:number,y:number}) { return { x: p.x / scale, y: p.y / scale }; }
  function clampBox(b: KRect): KRect {
    const W = item.width, H = item.height;
    let x = Math.max(0, Math.min(b.x, W - 1));
    let y = Math.max(0, Math.min(b.y, H - 1));
    let w = Math.max(1, Math.min(b.w, W - x));
    let h = Math.max(1, Math.min(b.h, H - y));
    return { ...b, x, y, w, h };
  }

  // drawing
  function beginDraw(p: {x:number,y:number}) {
    const { x, y } = stageToImage(p);
    setDrawStart({ x, y });
    const newRect: KRect = {
      id: "tmp", x, y, w: 1, h: 1,
      classId: activeClassId,
      className: (classMap[activeClassId] ?? classMap[String(activeClassId)] ?? "class") as string
    };
    setBoxes(prev => [...prev, newRect]);
  }
  function moveDraw(p: {x:number,y:number}) {
    if (!drawStart) return;
    const { x, y } = stageToImage(p);
    const x0 = Math.min(drawStart.x, x), y0 = Math.min(drawStart.y, y);
    const w = Math.abs(x - drawStart.x), h = Math.abs(y - drawStart.y);
    setBoxes(prev => prev.map(b => b.id === "tmp" ? { ...b, x: x0, y: y0, w, h } : b));
  }
  function endDraw() {
    if (!drawStart) return;
    setDrawStart(null);
    setBoxes(prev => {
      const tmp = prev.find(b => b.id === "tmp");
      if (!tmp || tmp.w < 3 || tmp.h < 3) return prev.filter(b => b.id !== "tmp");
      const id = uuidv4();
      return prev.map(b => b.id === "tmp" ? clampBox({ ...b, id }) : b);
    });
  }

  const selectedRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  useEffect(() => {
    if (trRef.current && selectedRef.current) {
      trRef.current.nodes([selectedRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedId, boxes, mode]);

  // counts with rules (for overlay)
  const overlayCounts = useMemo(() => {
    const W = item.width, H = item.height;
    function iou(a:{x1:number,y1:number,x2:number,y2:number}, b:{x1:number,y1:number,x2:number,y2:number}) {
      const inter_x1 = Math.max(a.x1, b.x1), inter_y1 = Math.max(a.y1, b.y1);
      const inter_x2 = Math.min(a.x2, b.x2), inter_y2 = Math.min(a.y2, b.y2);
      const iw = Math.max(0, inter_x2 - inter_x1), ih = Math.max(0, inter_y2 - inter_y1);
      const inter = iw * ih;
      const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
      const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
      return inter / (areaA + areaB - inter + 1e-6);
    }
    function bbox(b:Box){ return { x1:b.x, y1:b.y, x2:b.x+b.w, y2:b.y+b.h }; }
    function center(b:Box){ return { cx: b.x + b.w/2, cy: b.y + b.h/2 }; }

    // ids
    let MICROGEL = 0, CELL = 1;
    for (const [k,v] of Object.entries(classMap)) {
      const name = String(v).toLowerCase();
      if (name === "microgel") MICROGEL = Number(k);
      if (name === "cell") CELL = Number(k);
    }

    const mg = boxes.filter(b => b.classId === MICROGEL);
    const cs = boxes.filter(b => b.classId === CELL);

    const severe = new Set<string>();
    const insideRatioThr = 1 - rules.edgeOutsidePercent/100.0;
    for (const b of mg) {
      const bb = bbox(b);
      const x1c = Math.max(0, bb.x1), y1c = Math.max(0, bb.y1);
      const x2c = Math.min(W, bb.x2), y2c = Math.min(H, bb.y2);
      const origA = Math.max(0, bb.x2-bb.x1) * Math.max(0, bb.y2-bb.y1);
      const clipA = Math.max(0, x2c-x1c) * Math.max(0, y2c-y1c);
      const inside = clipA / (origA + 1e-6);
      if (inside < insideRatioThr) severe.add(b.id);
    }

    const overlap = new Set<string>();
    for (let i=0;i<mg.length;i++){
      for (let j=i+1;j<mg.length;j++){
        if (iou(bbox(mg[i]), bbox(mg[j])) >= rules.overlapIoU) {
          overlap.add(mg[i].id); overlap.add(mg[j].id);
        }
      }
    }

    const valid = mg.filter(b => !severe.has(b.id) && !overlap.has(b.id));
    const mgCount = valid.length;

    const cellCount = cs.filter(c => {
      const {cx, cy} = center(c);
      return valid.some(m => (m.x <= cx && cx <= m.x+m.w && m.y <= cy && cy <= m.y+m.h));
    }).length;

    return { microgel: mgCount, cell: cellCount };
  }, [boxes, classMap, rules, item.width, item.height]);

  function colorFor(className: string, classId: number) {
    const lc = (className || "").toLowerCase();
    if (COLOR_MAP[lc]) return COLOR_MAP[lc];
    const ids = Object.keys(classMap).map(k => Number(k));
    const idx = Math.max(0, ids.indexOf(classId));
    return PALETTE[idx % PALETTE.length];
  }

  const isSelect = mode === "select";
  const isDraw = mode === "draw";
  const isErase = mode === "erase";
  // Requested: on Eraser (D), cursor should be a "hand"
  const cursorStyle = isDraw ? "crosshair" : (isErase ? "pointer" : "default");

  return (
    <div>
      {/* Top controls: class chips + mode buttons */}
      <div className="toolbar" style={{justifyContent:"space-between", gap:16, alignItems:"center", flexWrap:"wrap"}}>
        <div className="kv" style={{gap:8, alignItems:"center"}}>
          <span className="small">Class</span>
          {Object.keys(classMap).map(k => {
            const id = Number(k); const name = String(classMap[k]);
            const active = id === activeClassId;
            return (
              <button key={k}
                className={"chip " + (active ? "chip-active" : "")}
                onClick={() => setActiveClassId(id)}>
                <span className="dot" style={{background: colorFor(name, id)}} />
                {name}
              </button>
            );
          })}
        </div>
        <div className="kv" style={{gap:8}}>
          <button className={"mode-btn " + (mode==="select" ? "active": "")} onClick={() => setMode("select")} title="Esc">
            Select <kbd>Esc</kbd>
          </button>
          <button className={"mode-btn " + (mode==="draw" ? "active": "")} onClick={() => setMode("draw")} title="R">
            Rectangle <kbd>R</kbd>
          </button>
          <button className={"mode-btn " + (mode==="erase" ? "active": "")} onClick={() => setMode("erase")} title="D">
            Eraser <kbd>D</kbd>
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{position:"relative", cursor: cursorStyle}}>
        {/* on‑canvas counts (rules applied) */}
        <div className="overlay-counts">
          {Object.entries(overlayCounts).map(([k,v]) => (
            <div key={k} className="overlay-pill">
              <span className="dot" style={{background: colorFor(k, 0)}} />
              {k}: <b>{v}</b>
            </div>
          ))}
        </div>

        <Stage
          width={item.width * scale}
          height={item.height * scale}
          onMouseMove={(e) => {
            if (isDraw) {
              const p = e.target.getStage()?.getPointerPosition();
              if (p) moveDraw(p);
            }
          }}
          onMouseDown={(e) => {
            const stage = e.target.getStage(); if (!stage) return;
            const p = stage.getPointerPosition(); if (!p) return;
            if (isDraw) { beginDraw(p); return; }
            const clickedEmpty = e.target === stage;
            if (clickedEmpty && isSelect) setSelectedId(null);
          }}
          onMouseUp={() => { if (isDraw) endDraw(); }}
        >
          <Layer>
            {image && <KonvaImage image={image} width={item.width * scale} height={item.height * scale} />}

            {boxes.map((b) => {
              const selected = selectedId === b.id;
              const stroke = colorFor(b.className, b.classId);
              // Fill rectangles (semi‑transparent). While drawing (id==="tmp") fill stronger.
              const fill = hexToRgba(stroke, b.id === "tmp" ? 0.35 : 0.18);
              const baseProps = {
                key: b.id,
                x: b.x * scale, y: b.y * scale,
                width: b.w * scale, height: b.h * scale,
                stroke: selected ? "#1a73e8" : stroke,
                strokeWidth: selected ? 7.5 : 3,
                dash: selected ? [6, 4] : undefined,
                fill,
                draggable: isSelect && selected,
                listening: !isDraw,  // draw mode: boxes don't intercept events
                onDragEnd: (e:any) => {
                  if (!isSelect || !selected) return;
                  const x = e.target.x() / scale, y = e.target.y() / scale;
                  setBoxes(prev => prev.map(bb => bb.id === b.id ? clampBox({ ...bb, x, y }) : bb));
                },
                onClick: () => {
                  if (isErase) {
                    setBoxes(prev => prev.filter(bb => bb.id !== b.id));
                    setSelectedId(null);
                  } else if (isSelect) {
                    setSelectedId(b.id);
                  }
                }
              } as any;

              return (
                <>
                  <Rect {...baseProps} ref={selected ? selectedRef : undefined} />
                  {selected && isSelect && (
                    <Transformer
                      ref={trRef}
                      rotateEnabled={false} flipEnabled={false}
                      enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]}
                      onTransformEnd={(e:any) => {
                        const node = selectedRef.current; if (!node) return;
                        const scaleX = node.scaleX(), scaleY = node.scaleY();
                        const newW = Math.max(1, node.width() * scaleX);
                        const newH = Math.max(1, node.height() * scaleY);
                        const x = node.x() / scale, y = node.y() / scale;
                        node.scaleX(1); node.scaleY(1);
                        setBoxes(prev => prev.map(bb => bb.id === b.id
                          ? clampBox({ ...bb, x, y, w: newW/scale, h: newH/scale })
                          : bb));
                      }}
                    />
                  )}
                </>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {selectedId && isSelect && (
        <div className="card">
          <strong>Selected box</strong>
          <div className="toolbar">
            {boxes.filter(b => b.id === selectedId).map(b => (
              <div key={b.id} className="kv" style={{gap:16}}>
                <span>Class</span>
                <select className="select" value={b.classId}
                  onChange={e => {
                    const toId = Number(e.target.value);
                    const toName = (classMap[toId] ?? classMap[String(toId)]) as string;
                    setBoxes(prev => prev.map(bb => bb.id === b.id ? { ...bb, classId: toId, className: toName } : bb));
                  }}>
                  {Object.keys(classMap).map(k => (<option key={k} value={Number(k)}>{String(classMap[k])}</option>))}
                </select>
                <span className="small">x:{b.x.toFixed(0)} y:{b.y.toFixed(0)} w:{b.w.toFixed(0)} h:{b.h.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
