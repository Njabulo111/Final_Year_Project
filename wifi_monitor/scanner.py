# scanner.py
import platform
import subprocess
import re
import time
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AccessPoint:
    """Holds all data for one scanned WiFi access point."""
    ssid:        str   = ''       # WiFi name e.g. 'Eduroam'
    bssid:       str   = ''       # Unique MAC e.g. 'AA:11:22:33:44:55'
    rssi:        int   = -99      # Signal strength in dBm e.g. -65
    channel:     int   = 0        # WiFi channel number 1-13 or 36-165
    frequency:   float = 0.0      # Frequency in GHz e.g. 2.437
    band:        str   = ''       # '2.4GHz' or '5GHz'
    is_connected: bool = False    # True if this is the current AP

    def __post_init__(self):
        # Automatically determine band from frequency
        if self.frequency >= 5.0:
            self.band = '5GHz'
        elif self.frequency >= 2.4:
            self.band = '2.4GHz'


def scan_windows() -> List[AccessPoint]:
    """
    Calls: netsh wlan show networks mode=bssid
    Parses the text output line by line.
    Returns a list of AccessPoint objects.
    """
    aps = []
    try:
        result = subprocess.run(
            ['netsh', 'wlan', 'show', 'networks', 'mode=bssid'],
            capture_output=True,
            text=True,
            timeout=15
        )
        output = result.stdout
    except Exception as e:
        print(f'[Scanner] Windows scan failed: {e}')
        return []

    current_ssid = ''
    for line in output.splitlines():
        line = line.strip()

        ssid_match = re.match(r'SSID \d+ +: (.+)', line)
        if ssid_match:
            current_ssid = ssid_match.group(1).strip()
            continue

        bssid_match = re.match(r'BSSID \d+ +: ([0-9a-fA-F:]{17})', line)
        if bssid_match and current_ssid:
            ap = AccessPoint(ssid=current_ssid, bssid=bssid_match.group(1))
            aps.append(ap)
            continue

        signal_match = re.match(r'Signal +: (\d+)%', line)
        if signal_match and aps:
            pct = int(signal_match.group(1))
            aps[-1].rssi = int((pct / 2) - 100)
            continue

        channel_match = re.match(r'Channel +: (\d+)', line)
        if channel_match and aps:
            ch = int(channel_match.group(1))
            aps[-1].channel = ch
            if ch <= 13:
                aps[-1].frequency = 2.407 + ch * 0.005
                aps[-1].band = '2.4GHz'
            else:
                aps[-1].frequency = 5.0 + ch * 0.005
                aps[-1].band = '5GHz'
            continue

    return aps


def get_linux_wifi_interface() -> Optional[str]:
    try:
        result = subprocess.run(
            ['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE', 'device'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                parts = line.split(':')
                if len(parts) >= 3 and parts[1] == 'wifi':
                    return parts[0].strip()
    except Exception:
        pass

    try:
        result = subprocess.run(['iwconfig'], capture_output=True, text=True, timeout=10)
        for line in result.stdout.splitlines():
            if 'IEEE 802.11' in line:
                return line.split()[0]
    except Exception:
        pass

    return None


def scan_linux() -> List[AccessPoint]:
    aps = []
    try:
        result = subprocess.run(
            ['nmcli', '-t', '-f',
             'SSID,BSSID,SIGNAL,CHAN,FREQ',
             'device', 'wifi', 'list'],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if not line.strip():
                    continue
                parts = line.split(':')
                if len(parts) < 5:
                    continue
                if len(parts) > 5:
                    ssid = ':'.join(parts[:-4]).strip()
                    bssid = parts[-4].strip()
                    signal = parts[-3].strip()
                    channel = parts[-2].strip()
                    freq = parts[-1].strip()
                else:
                    ssid, bssid, signal, channel, freq = [p.strip() for p in parts]
                rssi = int(signal) - 110 if signal.isdigit() else -99
                ch = int(channel) if channel.isdigit() else 0
                freq_val = float(freq) if freq.replace('.', '', 1).isdigit() else 0.0
                aps.append(AccessPoint(
                    ssid=ssid,
                    bssid=bssid.lower(),
                    rssi=rssi,
                    channel=ch,
                    frequency=freq_val
                ))
            return aps
    except FileNotFoundError:
        pass

    wifi_interface = get_linux_wifi_interface() or 'wlan0'
    try:
        result = subprocess.run(
            ['sudo', 'iwlist', wifi_interface, 'scan'],
            capture_output=True, text=True, timeout=20
        )
        output = result.stdout
        cell = None
        for line in output.splitlines():
            line = line.strip()
            if 'Cell' in line and 'Address' in line:
                bssid = line.split('Address:')[-1].strip()
                cell = AccessPoint(bssid=bssid.lower())
                aps.append(cell)
            elif cell:
                if 'ESSID:' in line:
                    cell.ssid = line.split('ESSID:')[-1].strip().strip('"')
                elif 'Signal level=' in line:
                    m = re.search(r'Signal level=(-\d+)', line)
                    if m: cell.rssi = int(m.group(1))
                elif 'Channel:' in line:
                    m = re.search(r'Channel:(\d+)', line)
                    if m:
                        cell.channel = int(m.group(1))
                        cell.frequency = 2.407 + cell.channel * 0.005
    except Exception as e:
        print(f'[Scanner] iwlist failed: {e}')

    return aps


def get_connected_bssid_windows() -> Optional[str]:
    try:
        result = subprocess.run(
            ['netsh', 'wlan', 'show', 'interfaces'],
            capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.splitlines():
            m = re.search(r'BSSID +: ([0-9a-fA-F:]{17})', line)
            if m:
                return m.group(1).lower()
    except Exception:
        pass
    return None


def get_connected_bssid_linux() -> Optional[str]:
    try:
        result = subprocess.run(
            ['iwgetid', '-r', '-a'],
            capture_output=True, text=True, timeout=5
        )
        bssid = result.stdout.strip()
        return bssid.lower() if bssid else None
    except FileNotFoundError:
        pass
    try:
        result = subprocess.run(
            ['cat', '/sys/class/net/wlan0/address'],
            capture_output=True, text=True
        )
        return result.stdout.strip().lower()
    except Exception:
        return None


def scan_all_aps() -> List[AccessPoint]:
    os_name = platform.system()
    if os_name == 'Windows':
        aps = scan_windows()
        connected_bssid = get_connected_bssid_windows()
    elif os_name == 'Linux':
        aps = scan_linux()
        connected_bssid = get_connected_bssid_linux()
    else:
        print('[Scanner] Unsupported OS')
        return []

    if connected_bssid:
        for ap in aps:
            if ap.bssid.lower() == connected_bssid.lower():
                ap.is_connected = True
                break

    seen = set()
    unique_aps = []
    for ap in aps:
        key = ap.bssid.lower() if ap.bssid else f"{ap.ssid}:{ap.channel}"
        if key not in seen:
            seen.add(key)
            unique_aps.append(ap)
    return unique_aps
