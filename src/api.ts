// api.ts
export async function detect(files: File[], conf: string, iou: string) {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  fd.append("conf", conf);
  fd.append("iou", iou);

  const r = await fetch("/api/detect", { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function exportYolo(payload: { images: any[]; classMap: any }) {
  const r = await fetch("/api/export/yolo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  downloadBlob(blob, "labels_yolo.zip");
}

export async function exportYoloTxt(image: any) {
  const r = await fetch("/api/export/yolo/txt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!r.ok) throw new Error(await r.text());
  const name = (image.filename || image.storedFilename || "image").replace(/\.[^.]+$/, "");
  const blob = await r.blob();
  downloadBlob(blob, `${name}.txt`);
}

export async function exportExcelOne(image: any, rules: { overlap_iou: number; edge_outside_percent: number }) {
  const r = await fetch("/api/export/excel/one", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, rules }),     // ← 단수 key: image
  });
  if (!r.ok) throw new Error(await r.text());
  const name = (image.filename || image.storedFilename || "image").replace(/\.[^.]+$/, "");
  const blob = await r.blob();
  downloadBlob(blob, `microgel_cell_report_${name}.xlsx`);
}

export async function exportExcelEachZip(
  images: any[],
  rules: { overlap_iou: number; edge_outside_percent: number }
) {
  const r = await fetch("/api/export/excel/each", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, rules }),    // ← 복수 key: images
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  downloadBlob(blob, "excel_each.zip");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
