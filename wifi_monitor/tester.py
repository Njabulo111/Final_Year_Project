# tester.py
import subprocess
import platform
import re
import time
from typing import Tuple
import config


def ping_windows(target: str, count: int) -> Tuple[float, float]:
    try:
        result = subprocess.run(
            ['ping', '-n', str(count), '-w',
             str(config.PING_TIMEOUT_SECONDS * 1000), target],
            capture_output=True, text=True, timeout=count * 3
        )
        output = result.stdout
    except Exception as e:
        print(f'[Tester] Windows ping failed: {e}')
        return (999.0, 100.0)

    loss = 100.0
    loss_match = re.search(r'\((\d+)% loss\)', output)
    if loss_match:
        loss = float(loss_match.group(1))

    latency = 999.0
    avg_match = re.search(r'Average = (\d+)ms', output)
    if avg_match:
        latency = float(avg_match.group(1))

    return (latency, loss)


def ping_linux(target: str, count: int) -> Tuple[float, float]:
    try:
        result = subprocess.run(
            ['ping', '-c', str(count),
             '-W', str(config.PING_TIMEOUT_SECONDS), target],
            capture_output=True, text=True, timeout=count * 4
        )
        output = result.stdout
    except Exception as e:
        print(f'[Tester] Linux ping failed: {e}')
        return (999.0, 100.0)

    loss = 100.0
    loss_match = re.search(r'(\d+)% packet loss', output)
    if loss_match:
        loss = float(loss_match.group(1))

    latency = 999.0
    rtt_match = re.search(r'min/avg/max/mdev = [\d.]+/([\d.]+)/', output)
    if rtt_match:
        latency = float(rtt_match.group(1))

    return (latency, loss)


def measure_connection() -> Tuple[float, float]:
    os_name = platform.system()
    target  = config.PING_TARGET
    count   = config.PING_COUNT

    print(f'[Tester] Pinging {target} x{count}...')
    start = time.time()

    if os_name == 'Windows':
        latency, loss = ping_windows(target, count)
    elif os_name == 'Linux':
        latency, loss = ping_linux(target, count)
    else:
        print('[Tester] Unsupported OS')
        return (999.0, 100.0)

    elapsed = round(time.time() - start, 2)
    print(f'[Tester] Done in {elapsed}s — latency={latency}ms, loss={loss}%')
    return (latency, loss)
