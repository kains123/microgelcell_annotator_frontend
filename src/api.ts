export async function detect(files: File[], conf?: number | string, iou?: number | string) {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  if (conf !== undefined) fd.append("conf", String(conf).replace(",", "."));
  if (iou !== undefined) fd.append("iou", String(iou).replace(",", "."));
  const res = await fetch("/api/detect", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportYolo(payload: any) {
  const res = await fetch("/api/export/yolo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "labels_yolo.zip";
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportYoloTxt(imagePayload: any) {
  const res = await fetch("/api/export/yolo/txt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imagePayload })
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stem = String(imagePayload.filename || "image").replace(/\.[^.]+$/, "");
  a.href = url;
  a.download = `${stem}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportExcelOne(imagePayload: any, rules: { overlap_iou: number; edge_outside_percent: number; }) {
  const res = await fetch("/api/export/excel/one", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imagePayload, rules })
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stem = String(imagePayload.filename || "image").replace(/\.[^.]+$/, "");
  a.href = url;
  a.download = `microgel_cell_report_${stem}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportExcelEachZip(payload: any, rules: { overlap_iou: number; edge_outside_percent: number; }) {
  const res = await fetch("/api/export/excel/each", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, rules })
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "excel_each.zip";
  a.click();
  URL.revokeObjectURL(url);
}
