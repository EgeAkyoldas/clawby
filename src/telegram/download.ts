/**
 * Download a file from Telegram's servers by file_id.
 * Returns the raw bytes as a Buffer.
 */
export async function downloadTelegramFile(
  fileId: string,
  token: string
): Promise<Buffer> {
  // Step 1: Get file path from Telegram API
  const infoUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
  const infoRes = await fetch(infoUrl);

  if (!infoRes.ok) {
    throw new Error(`Telegram getFile failed: ${infoRes.status} ${infoRes.statusText}`);
  }

  const infoJson = (await infoRes.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };

  if (!infoJson.ok || !infoJson.result?.file_path) {
    throw new Error("Telegram getFile returned no file_path");
  }

  // Step 2: Download the actual file
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${infoJson.result.file_path}`;
  const fileRes = await fetch(downloadUrl);

  if (!fileRes.ok) {
    throw new Error(`Telegram file download failed: ${fileRes.status}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
