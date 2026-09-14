import subprocess
import platform
import time
import config


def get_linux_wifi_interface() -> str:
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
    return 'wlan0'


def switch_ap_windows(target_ssid: str, target_bssid: str = None) -> dict:
    start = time.time()
    try:
        subprocess.run(["netsh", "wlan", "disconnect"], capture_output=True, text=True, timeout=10)
    except Exception as e:
        return {"success": False, "message": f"Disconnect error: {e}", "time_taken_s": 0}

    time.sleep(1.5)

    try:
        if target_bssid:
            cmd = ["netsh", "wlan", "connect", f'ssid={target_ssid}', f'name={target_ssid}', f'bssid={target_bssid}']
        else:
            cmd = ["netsh", "wlan", "connect", f'ssid={target_ssid}', f'name={target_ssid}']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        elapsed = round(time.time() - start, 2)
        if result.returncode == 0:
            return {"success": True, "message": f"Successfully connected to {target_ssid}.", "time_taken_s": elapsed}
        return {"success": False, "message": f"Connect failed: {result.stdout.strip() or result.stderr.strip()}", "time_taken_s": elapsed}
    except Exception as e:
        return {"success": False, "message": f"Connect error: {e}", "time_taken_s": 0}


def switch_ap_linux(target_ssid: str, target_bssid: str = None) -> dict:
    start = time.time()
    wifi_interface = get_linux_wifi_interface()
    try:
        subprocess.run(["nmcli", "device", "disconnect", wifi_interface], capture_output=True, text=True, timeout=10)
    except Exception as e:
        return {"success": False, "message": f"Disconnect error: {e}", "time_taken_s": 0}

    time.sleep(1.5)

    try:
        if target_bssid:
            cmd = ["nmcli", "device", "wifi", "connect", target_ssid, "bssid", target_bssid]
        else:
            cmd = ["nmcli", "device", "wifi", "connect", target_ssid]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        elapsed = round(time.time() - start, 2)
        if result.returncode == 0:
            return {"success": True, "message": f"Successfully connected to {target_ssid}.", "time_taken_s": elapsed}

        if target_bssid:
            fallback_cmd = ["nmcli", "device", "wifi", "connect", target_ssid]
            fallback = subprocess.run(fallback_cmd, capture_output=True, text=True, timeout=30)
            if fallback.returncode == 0:
                return {"success": True, "message": f"Successfully connected to {target_ssid} using fallback command.", "time_taken_s": round(time.time() - start, 2)}

        return {"success": False, "message": f"Connect failed: {result.stderr.strip() or result.stdout.strip()}", "time_taken_s": elapsed}
    except Exception as e:
        return {"success": False, "message": f"Connect error: {e}", "time_taken_s": 0}


def switch_to_ap(target_ssid: str, target_bssid: str = None) -> dict:
    os_name = platform.system()
    if os_name == "Windows": return switch_ap_windows(target_ssid, target_bssid)
    elif os_name == "Linux": return switch_ap_linux(target_ssid, target_bssid)
    else: return {"success": False, "message": "Switching not supported on this OS.", "time_taken_s": 0}
