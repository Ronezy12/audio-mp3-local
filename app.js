/* global FFmpeg */
const { createFFmpeg, fetchFile } = FFmpeg;

const urlInput = document.getElementById("urlInput");
const loadBtn = document.getElementById("loadBtn");
const convertBtn = document.getElementById("convertBtn");
const bitrateEl = document.getElementById("bitrate");
const bar = document.getElementById("bar");
const statusEl = document.getElementById("status");
const downloadA = document.getElementById("download");

const ffmpeg = createFFmpeg({
  log: false,
  // progress ratio is 0..1
  progress: ({ ratio }) => setProgress(Math.round(ratio * 100)),
});

let loaded = null; // { bytes: Uint8Array, name: string, mime: string }

function setStatus(msg) { statusEl.textContent = msg; }
function setProgress(pct) { bar.style.width = `${Math.max(0, Math.min(100, pct))}%`; }

function guessExtFromMime(mime) {
  const map = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "application/ogg": "ogg",
  };
  return map[mime] || "bin";
}

function filenameFromUrl(url, fallback = "audio") {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || fallback;
    return decodeURIComponent(last);
  } catch {
    return fallback;
  }
}

function isDirectAudioUrl(url) {
  // heuristic only; real check will be Content-Type
  return /\.(mp3|wav|ogg|aac|m4a|webm)(\?.*)?$/i.test(url);
}

function makeDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadA.href = url;
  downloadA.download = filename;
  downloadA.style.display = "inline-block";
  downloadA.textContent = `Télécharger : ${filename}`;
}

async function fetchAudio(url) {
  setProgress(0);
  setStatus("Téléchargement du fichier…");

  // Basic block: prevent obvious platform links (UX + compliance)
  const blocked = /(youtube\.com|youtu\.be|soundcloud\.com|spotify\.com)/i;
  if (blocked.test(url)) {
    throw new Error("Lien de plateforme non supporté. Utilise une URL directe vers un fichier audio (mp3/wav/ogg…).");
  }

  // Optional: give user a hint early
  if (!isDirectAudioUrl(url)) {
    setStatus("Le lien ne ressemble pas à un fichier audio direct. Je tente quand même…");
  }

  const res = await fetch(url, { mode: "cors" });

  if (!res.ok) throw new Error(`HTTP ${res.status} — impossible de récupérer le fichier.`);

  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  if (!mime.startsWith("audio/") && mime !== "application/ogg") {
    throw new Error(`Le serveur ne renvoie pas un type audio (Content-Type: ${mime}).`);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  const name = filenameFromUrl(url, "audio") || "audio";
  return { bytes: buf, name, mime };
}

loadBtn.addEventListener("click", async () => {
  downloadA.style.display = "none";
  convertBtn.disabled = true;
  loaded = null;

  const url = urlInput.value.trim();
  if (!url) return setStatus("Colle une URL d’un fichier audio.");

  try {
    const audio = await fetchAudio(url);
    loaded = audio;
    setStatus(`Fichier chargé : ${audio.name} (${audio.mime})`);
    convertBtn.disabled = false;
  } catch (e) {
    setStatus(`Erreur : ${e.message}`);
    setProgress(0);
  }
});

convertBtn.addEventListener("click", async () => {
  downloadA.style.display = "none";
  setProgress(0);

  if (!loaded) return setStatus("Aucun fichier chargé.");

  const bitrate = bitrateEl.value;

  try {
    setStatus("Chargement du moteur de conversion (FFmpeg)…");
    if (!ffmpeg.isLoaded()) await ffmpeg.load();

    // Input / output filenames in FFmpeg FS
    const inExt = guessExtFromMime(loaded.mime);
    const inName = `input.${inExt}`;
    const outName = "output.mp3";

    setStatus("Préparation…");
    ffmpeg.FS("writeFile", inName, loaded.bytes);

    setStatus("Conversion en MP3…");
    // -vn: no video; -b:a bitrate
    await ffmpeg.run("-i", inName, "-vn", "-b:a", `${bitrate}k`, outName);

    const mp3Data = ffmpeg.FS("readFile", outName);
    const mp3Blob = new Blob([mp3Data.buffer], { type: "audio/mpeg" });

    // Cleanup
    try { ffmpeg.FS("unlink", inName); } catch {}
    try { ffmpeg.FS("unlink", outName); } catch {}

    setProgress(100);
    setStatus("Terminé ✅");
    const base = loaded.name.replace(/\.[^/.]+$/, "");
    makeDownload(mp3Blob, `${base}.mp3`);
  } catch (e) {
    setStatus(`Erreur conversion : ${e.message}`);
    setProgress(0);
  }
});
