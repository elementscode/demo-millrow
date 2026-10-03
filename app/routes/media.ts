import { Request, Response, sql } from "@elements/app";

interface PhotoBytes {
  contentType: string;
  hash: string;
  data: Buffer;
}

const INLINE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

const YEAR = 31536000;

export default function serveMedia(req: Request, res: Response) {
  let photo = sql<PhotoBytes>(`
    select contentType, hash, data from productPhotos where id = ${req.params.id}
  `).firstOrThrow();

  // The hash in the url names these exact bytes; a stale one is a 404 rather
  // than new bytes cached under the old key.
  if (req.params.hash !== photo.hash) {
    res.status(404);
    return res.end();
  }

  if (INLINE.has(photo.contentType)) {
    res.setHeader("Content-Type", photo.contentType);
  } else {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment");
  }

  // The seeded photos are svg. Served on our origin, an svg must not run script.
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader("Cache-Control", `public, max-age=${YEAR}, immutable`);

  return photo.data;
}
