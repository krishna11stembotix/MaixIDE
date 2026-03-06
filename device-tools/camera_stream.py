# MaixPy Camera Streaming Script for MaixIDE
# Run this on the MaixDuino/MaixDock board via MaixIDE
# It streams camera frames and RGB histograms over serial

import sensor, image, time, ubinascii

sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)   # 320x240 — good balance of size vs speed
sensor.skip_frames(time=2000)        # let camera warm up

print("##RES:320x240")   # tell frontend the resolution

clock = time.clock()

while True:
    clock.tick()
    img = sensor.snapshot()

    # ── Compress frame to JPEG and send as base64 ──────────────
    jpeg = img.compress(quality=40)           # lower quality = smaller = faster
    b64  = ubinascii.b2a_base64(jpeg).decode().strip()
    print("##FRAME:" + b64)

    # ── Send FPS ────────────────────────────────────────────────
    print("##FPS:" + str(clock.fps()))

    # ── (Optional) Send histograms ──────────────────────────────
    # stats = img.get_statistics()
    # print("##HIST_R:" + ",".join([str(b) for b in stats.r_histogram()]))
    # print("##HIST_G:" + ",".join([str(b) for b in stats.g_histogram()]))
    # print("##HIST_B:" + ",".join([str(b) for b in stats.b_histogram()]))
