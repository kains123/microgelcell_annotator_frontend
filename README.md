# Microgel & Cell Annotator — Frontend (React + TypeScript + Vite + Konva)

## Try it!
https://incomparable-bonbon-827d75.netlify.app/

![demo](src/assets/Screen%20Recording%202025-08-26%20at%2001.14.27.gif)


Interactive web UI to:
- upload microscope images,
- run detection through the backend model,
- **edit boxes** (draw / move / resize / delete),
- apply **counting rules** (edge crop %, overlap IoU),
- export **YOLO Darknet `.txt`** and **Excel**.

The backend API is proxied so you can use relative URLs (`/api/*`, `/uploads/*`) both in development and in production.

---

## Features

- Modes: **Select (Esc)**, **Rectangle (R)**, **Eraser (D)**  
  (In draw mode, existing boxes are locked so cells inside microgels don’t move the microgel box.)
- Box styles: thick borders; **cell = neon yellow**, **microgel = teal**; semi‑transparent fill while drawing.
- Counts shown on canvas (rules applied):  
  - **Edge crop %**: exclude microgels cut by the image border beyond this percentage; cells inside excluded microgels are also ignored.  
  - **Overlap IoU**: exclude microgels whose IoU overlap ≥ threshold; cells inside excluded microgels are also ignored.
- Exports:
  - **YOLO ZIP**: one `.txt` per image + `classes.txt`
  - **YOLO txt (current)**: a single `.txt` for the active image
  - **Excel (each)**: one Excel per image (2 sheets)
  - **Excel ZIP (each)**: all Excels zipped

---

## Prerequisites

- **Node.js 18+** (recommend LTS)
- A running backend (see `backend/README.md`)

---

## Local Development

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
Dev proxy (already set in vite.config.ts):
* /api/* → http://localhost:8000
* /uploads/* → http://localhost:8000
So, just start the backend on port 8000 and the UI will work at 5173.

Build
npm run build
# Output: frontend/dist/

Production (Free) — Netlify
1. Create public/_redirects (so the frontend can talk to Render backend without CORS headaches):
/api/*     https://<YOUR-RENDER-BACKEND>.onrender.com/api/:splat      200
/uploads/* https://<YOUR-RENDER-BACKEND>.onrender.com/uploads/:splat   200
1. Push the repo to GitHub (or GitLab/Bitbucket).
2. Netlify → Add new site → Import from your repo
    * Base directory: frontend
    * Build command: npm ci && npm run build
    * Publish directory: dist
    * (Optional) Environment → NODE_VERSION=18
3. Deploy. You’ll get a URL like https://<your-app>.netlify.app.
Alternative: Use an absolute API URL. Define VITE_API_BASE=https://<YOUR-RENDER-BACKEND>.onrender.com in Netlify environment variables and prefix all fetches with it. (Current project uses relative URLs + _redirects, which is simpler.)

How to Use (UI)
* Upload images (file picker or drag & drop).
* Choose Confidence and NMS IoU (tooltips explain what they do).
* Choose Edge crop % and Overlap IoU rules for counting/Excel.
* Edit: click a box to select → drag to move; drag corners to resize; Delete/Backspace to remove.
* Draw new: press R or click Rectangle, then drag on image.
* Erase mode: press D; cursor becomes a hand; clicking a box deletes it.
* Export with the buttons on the header.

Configuration Notes
* Colors / stroke widths: in frontend/src/components/BoxEditor.tsx.
* Keyboard shortcuts: handled in BoxEditor.tsx (Esc, R, D, Delete/Backspace, 1/2/3 to switch classes).
* If you rename classes, the UI reads class names from the backend’s classMap.

Troubleshooting
* Vite fails: Cannot find package '@vitejs/plugin-react'Run npm install in frontend. Ensure @vitejs/plugin-react exists in devDependencies.
* Drag & Drop doesn’t triggerThe project includes a dedicated dropzone with global dragover/drop prevention. Make sure you drop files over the card that says “Drag & drop images here…”.
* Backend 404/500 in productionCheck public/_redirects points to your real Render URL and that the backend is running (Render service is live, not sleeping).

Project Layout (frontend)
frontend/
  public/
    _redirects            # Netlify edge proxy → Render backend
  src/
    components/
      BoxEditor.tsx
    api.ts
    App.tsx
    main.tsx
    styles.css
    types.ts
  index.html
  package.json
  tsconfig.json
  vite.config.ts
