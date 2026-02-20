const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const pickBtn = document.getElementById("pickBtn");
const convertBtn = document.getElementById("convertBtn");
const fileList = document.getElementById("fileList");
const logEl = document.getElementById("log");
const bitrateEl = document.getElementById("bitrate");

let files = [];

function log(msg) {
  logEl.textContent = msg;
}

function formatBytes(bytes) {
  const units = ["B","KB","MB","GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function render() {
  fileList.innerHTML = "";
  for (const f of files) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="top">
        <div class="name">${f.name}</div>
        <div class="meta">${formatBytes(f.size)}</div>
      </div>
      <div class="progress"><div></div></div>
      <div class="meta status">Prêt</div>
    `;
    li._bar = li.querySelector(".progress > div");
    li._status = li.querySelector(".status");
    f._li = li;
    fileList.appendChild(li);
  }
  convertBtn.disabled = files.length === 0;
}

function addFiles(list) {
  const incoming = Array.from(list).filter(x => x.type.startsWith("audio/"));
  files.push(...incoming);
  log(incoming.length ? "" : "Aucun fichier audio détecté.");
  render();
}

pickBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => addFiles(e.target.files));

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  addFiles(e.dataTransfer.files);
});

/**
 * Conversion MP3:
 * - Pour rester 100% côté navigateur, on utilise typiquement FFmpeg.wasm.
 * - Ici je laisse un "hook" où brancher la conversion.
 * Je peux te fournir l’intégration complète FFmpeg.wasm + téléchargement du MP3,
 * tant qu’on convertit des fichiers importés localement (pas extraction depuis plateformes).
 */
async function convertOne(file, bitrate) {
  // TODO: brancher FFmpeg.wasm (WASM) ici
  // Doit retourner un Blob MP3
  throw new Error("Conversion non branchée (FFmpeg.wasm).");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

convertBtn.addEventListener("click", async () => {
  const bitrate = bitrateEl.value;
  log("Conversion en cours…");

  for (const f of files) {
    const li = f._li;
    li._status.textContent = "Conversion…";
    li._bar.style.width = "15%";

    try {
      const mp3Blob = await convertOne(f, bitrate);
      li._bar.style.width = "100%";
      li._status.textContent = "Terminé ✅";
      downloadBlob(mp3Blob, f.name.replace(/\.[^/.]+$/, "") + ".mp3");
    } catch (err) {
      li._bar.style.width = "0%";
      li._status.textContent = "Erreur";
      log(`Erreur sur ${f.name} : ${err.message}`);
    }
  }
});
