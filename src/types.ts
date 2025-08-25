export type Box = {
  id: string;
  x: number; y: number; w: number; h: number;
  classId: number;
  className: string;
  score?: number;
};

export type ImageItem = {
  id: string;
  filename: string;
  storedFilename?: string;
  url: string;
  width: number; height: number;
  boxes: Box[];
  counts?: Record<string, number>;
};

export type DetectResponse = {
  classMap: Record<string | number, string>;
  images: ImageItem[];
};

export type Rules = {
  overlapIoU: number;          // exclude microgels if IoU >= this
  edgeOutsidePercent: number;  // exclude microgels if > this % area is outside
};
