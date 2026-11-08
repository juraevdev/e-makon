#!/usr/bin/env python3
"""
E-Makon API stress / load smoke runner (read-only public endpoints).

Usage:
  python loadtests/stress.py --base-url https://api.e-makon.uz
  python loadtests/stress.py --base-url http://127.0.0.1:8110 --workers 80 --duration 45
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx

DEFAULT_PATHS = (
    "/health/",
    "/api/v1/services/",
    "/api/v1/partners/",
    "/api/v1/banners/",
)


@dataclass
class RequestSample:
    path: str
    status: int
    elapsed_ms: float
    error: str | None = None


@dataclass
class StressReport:
    base_url: str
    started_at: str
    duration_s: float
    workers: int
    total_requests: int
    success: int
    failed: int
    rps: float
    latency_ms: dict[str, float]
    status_histogram: dict[str, int] = field(default_factory=dict)
    path_summary: dict[str, dict[str, float | int]] = field(default_factory=dict)
    errors_sample: list[str] = field(default_factory=list)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * (pct / 100.0)
    f = int(k)
    c = min(f + 1, len(ordered) - 1)
    if f == c:
        return ordered[f]
    return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


async def worker(
    client: httpx.AsyncClient,
    paths: tuple[str, ...],
    deadline: float,
    samples: list[RequestSample],
    lock: asyncio.Lock,
) -> None:
    while time.monotonic() < deadline:
        path = random.choice(paths)
        url = path
        t0 = time.perf_counter()
        status = 0
        err: str | None = None
        try:
            resp = await client.get(url)
            status = resp.status_code
        except Exception as exc:  # noqa: BLE001 — aggregate for report
            err = type(exc).__name__ + ": " + str(exc)[:200]
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        sample = RequestSample(path=path, status=status, elapsed_ms=elapsed_ms, error=err)
        async with lock:
            samples.append(sample)


def build_report(
    base_url: str,
    started_at: datetime,
    duration_s: float,
    workers: int,
    samples: list[RequestSample],
) -> StressReport:
    latencies = [s.elapsed_ms for s in samples if s.error is None]
    success = sum(1 for s in samples if s.error is None and 200 <= s.status < 400)
    failed = len(samples) - success
    hist: dict[str, int] = {}
    for s in samples:
        key = str(s.status) if s.error is None else "error"
        hist[key] = hist.get(key, 0) + 1

    path_summary: dict[str, dict[str, float | int]] = {}
    for path in {s.path for s in samples}:
        subset = [s for s in samples if s.path == path]
        ok = [s.elapsed_ms for s in subset if s.error is None]
        path_summary[path] = {
            "count": len(subset),
            "p50_ms": percentile(ok, 50) if ok else 0.0,
            "p95_ms": percentile(ok, 95) if ok else 0.0,
            "errors": sum(1 for s in subset if s.error is not None or s.status >= 400),
        }

    errors_sample = [
        f"{s.path} status={s.status} {s.error or ''}".strip()
        for s in samples
        if s.error or s.status >= 400
    ][:20]

    return StressReport(
        base_url=base_url,
        started_at=started_at.isoformat(),
        duration_s=round(duration_s, 3),
        workers=workers,
        total_requests=len(samples),
        success=success,
        failed=failed,
        rps=round(len(samples) / duration_s, 2) if duration_s > 0 else 0.0,
        latency_ms={
            "min": round(min(latencies), 2) if latencies else 0.0,
            "mean": round(statistics.mean(latencies), 2) if latencies else 0.0,
            "p50": round(percentile(latencies, 50), 2),
            "p95": round(percentile(latencies, 95), 2),
            "p99": round(percentile(latencies, 99), 2),
            "max": round(max(latencies), 2) if latencies else 0.0,
        },
        status_histogram=hist,
        path_summary=path_summary,
        errors_sample=errors_sample,
    )


async def run_stress(
    base_url: str,
    workers: int,
    duration: float,
    paths: tuple[str, ...],
    timeout: float,
) -> StressReport:
    started = datetime.now(UTC)
    t_start = time.monotonic()
    samples: list[RequestSample] = []
    lock = asyncio.Lock()
    limits = httpx.Limits(max_connections=workers + 10, max_keepalive_connections=workers)
    async with httpx.AsyncClient(
        base_url=base_url.rstrip("/"),
        timeout=httpx.Timeout(timeout),
        limits=limits,
        headers={"Accept": "application/json", "User-Agent": "e-makon-loadtest/1.0"},
    ) as client:
        deadline = time.monotonic() + duration
        tasks = [asyncio.create_task(worker(client, paths, deadline, samples, lock)) for _ in range(workers)]
        await asyncio.gather(*tasks)
    duration_s = time.monotonic() - t_start
    return build_report(base_url, started, duration_s, workers, samples)


def main() -> int:
    parser = argparse.ArgumentParser(description="E-Makon read-only API stress runner")
    parser.add_argument("--base-url", default="https://api.e-makon.uz", help="API origin (no trailing path)")
    parser.add_argument("--workers", type=int, default=50, help="Concurrent async workers")
    parser.add_argument("--duration", type=float, default=30.0, help="Test duration in seconds")
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-request timeout (s)")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="JSON report path (default: loadtests/results/<timestamp>.json)",
    )
    args = parser.parse_args()

    out = args.out
    if out is None:
        out_dir = Path(__file__).resolve().parent / "results"
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        out = out_dir / f"stress_{stamp}.json"

    report = asyncio.run(
        run_stress(
            base_url=args.base_url,
            workers=args.workers,
            duration=args.duration,
            paths=DEFAULT_PATHS,
            timeout=args.timeout,
        )
    )
    payload = asdict(report)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Base URL:     {report.base_url}")
    print(f"Duration:     {report.duration_s}s  workers={report.workers}")
    print(f"Requests:     {report.total_requests}  success={report.success}  failed={report.failed}")
    print(f"RPS:          {report.rps}")
    print(f"Latency (ms): p50={report.latency_ms['p50']}  p95={report.latency_ms['p95']}  p99={report.latency_ms['p99']}  max={report.latency_ms['max']}")
    print(f"Status hist:  {report.status_histogram}")
    if report.errors_sample:
        print("Errors (sample):", *report.errors_sample[:5], sep="\n  ")
    print(f"Report saved: {out}")
    return 0 if report.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
