# MaixIDE Camera Stream — Hello World style
# Works exactly like the original MaixPy IDE example.
# Just run this script: the IDE shows live camera preview + RGB histogram.

import sensor, image, time, lcd, ubinascii  # type: ignore[import]

# ── Board setup (same as original MaixPy IDE Hello World) ───────────────────
lcd.init(freq=15000000)
sensor.reset()
sensor.set_pixformat(sensor.RGB565)   # RGB565 color
sensor.set_framesize(sensor.QVGA)     # 320 × 240
sensor.skip_frames(time=2000)         # let camera settle

clock = time.clock()  # type: ignore[attr-defined]
print("##RES:320x240")


# ── Histogram helpers ────────────────────────────────────────────────────────
# N_BINS bins spanning 0-255. Each bin i represents
# pixel values in the range [i * BIN_W, (i+1) * BIN_W).
N_BINS: int = 64
BIN_W: int = 256 // N_BINS   # = 4 pixel values per bin


def rgb_histograms(img) -> "tuple[list,list,list]":  # type: ignore[return]
    """Sample every 6th pixel and build R, G, B count arrays."""
    r: list = [0] * N_BINS
    g: list = [0] * N_BINS
    b: list = [0] * N_BINS
    w: int = img.width()
    h: int = img.height()
    for y in range(0, h, 6):
        for x in range(0, w, 6):
            p = img.get_pixel(x, y)         # (R, G, B) 0-255
            ri: int = int(p[0]) >> 2        # 0-255 → 0-63  (divide by BIN_W=4)
            gi: int = int(p[1]) >> 2
            bi: int = int(p[2]) >> 2
            r[ri] += 1
            g[gi] += 1
            b[bi] += 1
    return r, g, b


def channel_stats(bins: list) -> "tuple[float,int,int,float,int,int,int,int]":
    """Return pixel-space stats (0-255) for a bin array."""
    total: int = 0
    for v in bins:
        total += v
    n: int = len(bins)
    scale: int = BIN_W

    if total == 0:
        return 0.0, 0, 0, 0.0, 0, 255, 0, 255

    # Weighted mean in pixel space
    wsum: float = 0.0
    for i in range(n):
        wsum += float(bins[i]) * float(i * scale)
    mean: float = wsum / float(total)

    # Weighted variance → stdev
    vsum: float = 0.0
    for i in range(n):
        diff: float = float(i * scale) - mean
        vsum += float(bins[i]) * diff * diff
    stdev: float = (vsum / float(total)) ** 0.5

    # Mode = bin with highest count (converted to pixel space)
    mode_bin: int = 0
    mode_cnt: int = 0
    for i in range(n):
        if bins[i] > mode_cnt:
            mode_cnt = bins[i]
            mode_bin = i
    mode: int = int(mode_bin) * scale

    # Percentile scan → median, lq, uq (pixel space)
    cumsum: int = 0
    lq: int = 0; median: int = 0; uq: int = 0
    found_lq: bool = False; found_med: bool = False; found_uq: bool = False
    s: int = int(scale)
    for i in range(n):
        cumsum += bins[i]
        ii: int = int(i)
        if not found_lq and cumsum * 4 >= total:
            lq = ii * s  # type: ignore[operator]
            found_lq = True
        if not found_med and cumsum * 2 >= total:
            median = ii * s  # type: ignore[operator]
            found_med = True
        if not found_uq and cumsum * 4 >= total * 3:
            uq = ii * s  # type: ignore[operator]
            found_uq = True

    # Min / Max (first / last non-zero bin, pixel space)
    min_v: int = 0
    for i in range(n):
        if bins[i] > 0:
            min_v = int(i) * s; break
    max_v: int = 255
    for i in range(n - 1, -1, -1):
        if bins[i] > 0:
            max_v = (int(i) + 1) * s - 1; break

    return mean, median, mode, stdev, min_v, max_v, lq, uq


def fmt_channel(bins: list) -> str:
    """Format a histogram channel as bins_csv|mean=n|..."""
    mean, median, mode, stdev, mn, mx, lq, uq = channel_stats(bins)
    bs: str = ",".join(str(v) for v in bins)
    # Use integer arithmetic to avoid float formatting issues
    mean_str: str = str(int(mean * 10) // 10) + "." + str(int(mean * 10) % 10)
    sd_str: str = str(int(stdev * 10) // 10) + "." + str(int(stdev * 10) % 10)
    return (bs
            + "|mean="   + mean_str
            + "|median=" + str(median)
            + "|mode="   + str(mode)
            + "|stdev="  + sd_str
            + "|min="    + str(mn)
            + "|max="    + str(mx)
            + "|lq="     + str(lq)
            + "|uq="     + str(uq))


# ── Main loop ────────────────────────────────────────────────────────────────
while True:
    clock.tick()
    img = sensor.snapshot()    # capture frame
    lcd.display(img)            # show on board LCD

    # ── Send frame to MaixIDE preview ──────────────────────────
    jpeg = img.compress(quality=35)
    b64: str = ubinascii.b2a_base64(jpeg).decode().strip()
    print("##FRAME:" + b64)

    # ── Send FPS ────────────────────────────────────────────────
    fps_val: float = clock.fps()
    print("##FPS:" + str(int(fps_val * 10) // 10) + "." + str(int(fps_val * 10) % 10))

    # ── Send RGB histograms ──────────────────────────────────────
    rh, gh, bh = rgb_histograms(img)
    print("##HIST_R:" + fmt_channel(rh))
    print("##HIST_G:" + fmt_channel(gh))
    print("##HIST_B:" + fmt_channel(bh))
