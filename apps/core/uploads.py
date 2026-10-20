from __future__ import annotations

import os

from django.conf import settings

ORDER_MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".mp4", ".mov", ".3gp"}

# (extension set, magic prefixes) — Content-Type is client-controlled; sniff bytes instead.
_MAGIC_RULES: list[tuple[set[str], tuple[bytes, ...]]] = [
    ({".jpg", ".jpeg"}, (b"\xff\xd8\xff",)),
    ({".png"}, (b"\x89PNG\r\n\x1a\n",)),
    ({".webp"}, (b"RIFF",)),  # RIFF....WEBP — checked further below
    ({".heic", ".heif"}, (b"ftyp",)),  # ISO BMFF; offset may be 4
    ({".mp4", ".mov", ".3gp"}, (b"ftyp",)),
]


def _read_header(uploaded, size: int = 32) -> bytes:
    pos = uploaded.tell() if hasattr(uploaded, "tell") else 0
    try:
        if hasattr(uploaded, "seek"):
            uploaded.seek(0)
        header = uploaded.read(size) or b""
    finally:
        if hasattr(uploaded, "seek"):
            try:
                uploaded.seek(pos)
            except Exception:  # noqa: BLE001
                uploaded.seek(0)
    return header


def sniff_order_media(uploaded) -> str | None:
    """
    Return None if valid image/video; otherwise an error message.
    Relies on file extension + magic bytes (not client Content-Type).
    """
    max_files_msg = None  # unused; kept for call-site clarity
    del max_files_msg

    name = getattr(uploaded, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()
    if ext not in ORDER_MEDIA_EXTENSIONS:
        return "Faqat rasm yoki video yuklash mumkin."

    max_bytes = int(getattr(settings, "ORDER_MEDIA_MAX_BYTES", 10 * 1024 * 1024))
    size = getattr(uploaded, "size", None)
    if size is not None and size > max_bytes:
        return f"Fayl juda katta (maks. {max_bytes // (1024 * 1024)} MB)."

    header = _read_header(uploaded, 32)
    if not header:
        return "Fayl buzilgan yoki bo'sh."

    for exts, prefixes in _MAGIC_RULES:
        if ext not in exts:
            continue
        if ext == ".webp":
            if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
                return None
            return "WebP fayl formati noto'g'ri."
        if ext in {".heic", ".heif", ".mp4", ".mov", ".3gp"}:
            # ISO Base Media: size(4) + 'ftyp' at offset 4, or 'ftyp' early in header
            if len(header) >= 8 and b"ftyp" in header[:12]:
                return None
            return "Video/HEIC fayl formati noto'g'ri."
        for prefix in prefixes:
            if header.startswith(prefix):
                return None
        return "Rasm fayl formati noto'g'ri."

    return "Faqat rasm yoki video yuklash mumkin."
