function downloadBlob(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.setAttribute("href", downloadUrl);
  download.setAttribute("download", filename);
  download.click();
  window.URL.revokeObjectURL(download.href);
}

function downloadStr(str, filename) {
  const blob = new Blob([str], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, filename);
}

function downloadArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: "application/octet-stream",
  });
  downloadBlob(blob, filename);
}

export { downloadArrayBuffer, downloadStr };
