import React, { useEffect, useState } from "react";
import { detect, exportYolo, exportYoloTxt, exportExcelOne, exportExcelEachZip } from "./api";
import type { Box, ImageItem, DetectResponse, Rules } from "./types";
import BoxEditor from "./components/BoxEditor";

function getIds(classMap: Record<string | number, string>) {
  let microgel = 0, cell = 1;
  for (const [k, v] of Object.entries(classMap)) {
    const name = String(v).toLowerCase();
    if (name === "microgel") microgel = Number(k);
    if (name === "cell") cell = Number(k);
  }
  return { MICROGEL: microgel, CELL: cell };
}

function iou(a: {x1:number,y1:number,x2:number,y2:number}, b:{x1:number,y1:number,x2:number,y2:number}) {
  const inter_x1 = Math.max(a.x1, b.x1), inter_y1 = Math.max(a.y1, b.y1);
  const inter_x2 = Math.min(a.x2, b.x2), inter_y2 = Math.min(a.y2, b.y2);
  const iw = Math.max(0, inter_x2 - inter_x1), ih = Math.max(0, inter_y2 - inter_y1);
  const inter = iw * ih;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-6);
}

function recalcCountsWithRules(item: ImageItem, classMap: Record<string|number,string>, rules: Rules) {
  const { MICROGEL, CELL } = getIds(classMap);
  const W = item.width, H = item.height;

  const mg: Box[] = item.boxes.filter(b => b.classId === MICROGEL);
  const cells: Box[] = item.boxes.filter(b => b.classId === CELL);

  // compute exclusions
  const severeExcl = new Set<string>();    // > edgeOutsidePercent outside
  const bbox = (b:Box) => ({ x1:b.x, y1:b.y, x2:b.x+b.w, y2:b.y+b.h });

  const insideRatioThr = 1 - rules.edgeOutsidePercent / 100.0;
  for (const b of mg) {
    const bb = bbox(b);
    const x1c = Math.max(0, bb.x1), y1c = Math.max(0, bb.y1);
    const x2c = Math.min(W, bb.x2), y2c = Math.min(H, bb.y2);
    const origA = Math.max(0, bb.x2-bb.x1) * Math.max(0, bb.y2-bb.y1);
    const clipA = Math.max(0, x2c-x1c) * Math.max(0, y2c-y1c);
    const insideRatio = clipA / (origA + 1e-6);
    if (insideRatio < insideRatioThr) severeExcl.add(b.id);
  }

  const overlapExcl = new Set<string>();
  for (let i=0;i<mg.length;i++){
    for (let j=i+1;j<mg.length;j++){
      if (iou(bbox(mg[i]), bbox(mg[j])) >= rules.overlapIoU) {
        overlapExcl.add(mg[i].id); overlapExcl.add(mg[j].id);
      }
    }
  }

  const validMg = mg.filter(b => !severeExcl.has(b.id) && !overlapExcl.has(b.id));
  const microgelCount = validMg.length;

  // count cells INSIDE any valid microgel
  function center(b:Box){ return { cx: b.x + b.w/2, cy: b.y + b.h/2 }; }
  const cellCount = cells.filter(c => {
    const { cx, cy } = center(c);
    return validMg.some(m => (m.x <= cx && cx <= m.x+m.w && m.y <= cy && cy <= m.y+m.h));
  }).length;

  return { microgel: microgelCount, cell: cellCount };
}

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [classMap, setClassMap] = useState<Record<string | number, string>>({});
  const [conf, setConf] = useState<string>("0.25");
  const [iou, setIou] = useState<string>("0.45");
  const [rules, setRules] = useState<Rules>({ overlapIoU: 0.10, edgeOutsidePercent: 50 });
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const active = images[activeIdx];

  function updateActiveBoxes(boxes: Box[]) {
    setImages(prev => {
      const copy = [...prev];
      const nextItem = { ...copy[activeIdx], boxes };
      nextItem.counts = recalcCountsWithRules(nextItem, classMap, rules);
      copy[activeIdx] = nextItem;
      return copy;
    });
  }

  async function onDetectSelected(files: File[]) {
    if (!files.length) return;
    setLoading(true);
    try {
      const data: DetectResponse = await detect(files, conf, iou);
      setClassMap(data.classMap);
      const normalized: ImageItem[] = data.images.map(img => ({
        ...img,
        boxes: img.boxes.map(b => ({
          ...b,
          className: (data.classMap[b.classId] ?? data.classMap[String(b.classId)] ?? b.className) as string
        }))
      }));
      // counts with rules
      normalized.forEach(i => (i.counts = recalcCountsWithRules(i, data.classMap, rules)));
      setImages(prev => [...prev, ...normalized]);
      setActiveIdx(images.length);
    } catch (e: any) {
      alert(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  // ---- Global drag & drop fix ----
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => { e.preventDefault(); };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => { window.removeEventListener("dragover", onDragOver); window.removeEventListener("drop", onDrop); };
  }, []);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation();
    setDragging(false);
    const dt = e.dataTransfer;
    const files: File[] = [];
    if (dt?.items && dt.items.length) {
      for (const it of Array.from(dt.items)) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
    } else if (dt?.files && dt.files.length) {
      for (const f of Array.from(dt.files)) files.push(f);
    }
    onDetectSelected(files);
  }

  function downloadYoloZip() { exportYolo({ images, classMap }); }
  function downloadYoloTxtCurrent() { if (active) exportYoloTxt(active); }

  async function downloadExcelEachIndividually() {
    for (const img of images) {
      await exportExcelOne(img, {
        overlap_iou: rules.overlapIoU,
        edge_outside_percent: rules.edgeOutsidePercent,
      });
    }
  }

  // ZIP으로 한 번에
  function downloadExcelEachAsZip() {
    exportExcelEachZip(images, {                 // ← 첫 번째 인자: images 배열 (classMap 필요 없음)
      overlap_iou: rules.overlapIoU,
      edge_outside_percent: rules.edgeOutsidePercent,
    });
  }
  
  return (
    <div>
      <header>
        <div className="container">
          <h1>Microgel &amp; Cell Annotator</h1>
          <div className="toolbar">
            <label title="Confidence threshold (0–1). Detections below this score are ignored. Increase to reduce false positives; decrease to recover faint/small cells.">
              Confidence
              <input className="select" style={{width: 110, marginLeft: 6}} type="text"
                value={conf} onChange={e => setConf(e.target.value)} />
            </label>
            <label title="NMS IoU threshold (0–1). When two boxes overlap more than this, the lower-score box is suppressed.">
              NMS IoU
              <input className="select" style={{width: 110, marginLeft: 6}} type="text"
                value={iou} onChange={e => setIou(e.target.value)} />
            </label>

            {/* Rules for Excel & on-screen counts */}
            <label title="Exclude microgels if more than this % of their area lies outside the image. Cells inside excluded microgels are also excluded.">
              Edge crop %
              <input className="select" style={{width: 110, marginLeft: 6}} type="number" min={0} max={100} step={1}
                value={rules.edgeOutsidePercent}
                onChange={e => setRules(r => ({ ...r, edgeOutsidePercent: Math.max(0, Math.min(100, Number(e.target.value)||0)) }))} />
            </label>
            <label title="Exclude microgels if their overlap (IoU) with any other microgel is at least this value (0–1). Cells inside excluded microgels are also excluded.">
              Overlap IoU
              <input className="select" style={{width: 110, marginLeft: 6}} type="number" min={0} max={1} step={0.01}
                value={rules.overlapIoU}
                onChange={e => setRules(r => ({ ...r, overlapIoU: Math.max(0, Math.min(1, Number(e.target.value))) }))} />
            </label>

            <input type="file" multiple accept="image/*"
              onChange={e => onDetectSelected(Array.from(e.target.files || []))} />

            <button className="btn primary" disabled={!images.length} onClick={downloadYoloZip}>YOLO ZIP</button>
            <button className="btn" disabled={!active} onClick={downloadYoloTxtCurrent}>YOLO txt (current)</button>

            <button className="btn" disabled={!images.length} onClick={downloadExcelEachIndividually}>Excel (each)</button>
            <button className="btn" disabled={!images.length} onClick={downloadExcelEachAsZip}>Excel ZIP (each)</button>
          </div>
        </div>
      </header>

      <div className="container">
        {/* Dropzone */}
        <div
          className={"card dropzone " + (dragging ? "dragover" : "")}
          onDragEnter={(e)=>{ e.preventDefault(); setDragging(true); }}
          onDragOver={(e)=>{ e.preventDefault(); setDragging(true); }}
          onDragLeave={(e)=>{ e.preventDefault(); setDragging(false); }}
          onDrop={onDrop}
        >
          <div className="small">Drag & drop images here to auto-detect with the backend model.</div>
        </div>

        {images.length > 0 ? (
          <div className="grid">
            <aside className="sidebar">
              {images.map((img, idx) => (
                <div key={img.id} className={"thumb " + (activeIdx === idx ? "active": "")}
                  onClick={() => setActiveIdx(idx)}>
                  <img src={img.url} alt={img.filename} />
                  <div>
                    <div><strong>{img.filename}</strong></div>
                    <div className="small">{img.width}×{img.height}</div>
                    <div className="counts">
                      {Object.entries(img.counts || {}).map(([k, v]) =>
                        <span key={k} className="count-pill">{k}: {v}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </aside>

            <main>
              {images[activeIdx] && (
                <BoxEditor
                  item={images[activeIdx]}
                  classMap={classMap}
                  rules={rules}
                  onChange={(boxes) => updateActiveBoxes(boxes)}
                />
              )}
            </main>
          </div>
        ) : (
          <div className="card">
            <p>Upload images to see detections here.</p>
            <ul>
              <li>Modes: <b>Select</b> (Esc), <b>Rectangle</b> (R), <b>Eraser</b> (D)</li>
              <li>Draw: drag to add a new box; existing boxes won’t move while drawing</li>
              <li>Edit: click → move; corners → resize; Delete key to delete</li>
            </ul>
          </div>
        )}

        <footer>
          <hr />
          <div className="small">Backend: Flask + Ultralytics YOLO | Frontend: React + TypeScript + Konva</div>
        </footer>
      </div>

      {loading && <div style={{
        position: "fixed", inset: 0, background: "rgba(255,255,255,.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18
      }}>Running inference…</div>}
    </div>
  );
}
