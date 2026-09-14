import math
import config


# Calibration constant — RSSI measured at exactly 1 metre from the AP.
RSSI_AT_1M_DEFAULT = -40


def rssi_to_distance(rssi: int, rssi_at_1m: int = None, n: float = None) -> float:
    """
    Convert RSSI (dBm) to estimated distance (metres)
    using the Log-Distance Path Loss model.

    Formula: d = 10 ^ ((RSSI_0 - RSSI) / (10 * n))
    """
    if rssi_at_1m is None:
        rssi_at_1m = getattr(config, 'RSSI_AT_1M', RSSI_AT_1M_DEFAULT)
    if n is None:
        n = getattr(config, 'PATH_LOSS_EXPONENT', 2.7)

    exponent = (rssi_at_1m - rssi) / (10.0 * n)
    distance = math.pow(10, exponent)
    return max(0.5, round(distance, 1))


def get_direction_guidance(
    current_rssi: int,
    previous_rssi: int,
    target_bssid: str = None
) -> str:
    """
    Determines if user is moving closer or further from target AP.
    Uses RSSI delta between the current and previous scan.
    """
    delta = current_rssi - previous_rssi
    noise_threshold = 2  # dBm

    ap_positions = getattr(config, 'AP_POSITIONS', {})
    known_wall = None
    ap_label = "the target AP"
    if target_bssid and target_bssid in ap_positions:
        info = ap_positions[target_bssid]
        known_wall = info.get("wall")
        ap_label   = info.get("label", "the target AP")

    if known_wall:
        base_direction = f"Move towards the {known_wall.upper()} wall ({ap_label})"
    else:
        base_direction = f"Move towards {ap_label}"

    if delta > noise_threshold:
        return f"Signal improving (+{delta} dBm). Keep going — you are moving CLOSER to {ap_label}."
    elif delta < -noise_threshold:
        return f"Signal weakening ({delta} dBm). TURN AROUND — you are moving FURTHER from {ap_label}. {base_direction}."
    else:
        if known_wall:
            return f"Signal stable. {base_direction}. Try moving LEFT or RIGHT along your current path."
        else:
            return f"Signal stable. Try moving in a different direction to find {ap_label}."


def build_location_message(
    target_bssid: str,
    current_rssi: int,
    previous_rssi: int = None,
    target_ssid: str = ""
) -> str:
    """Builds the full location guidance message shown on the dashboard."""
    distance = rssi_to_distance(current_rssi)

    if previous_rssi is not None:
        direction_hint = get_direction_guidance(current_rssi, previous_rssi, target_bssid)
    else:
        direction_hint = "Starting navigation. Begin walking towards the AP."

    ap_positions = getattr(config, 'AP_POSITIONS', {})
    ap_label = target_ssid or target_bssid
    wall_hint = ""
    if target_bssid in ap_positions:
        info = ap_positions[target_bssid]
        ap_label  = info.get("label", ap_label)
        known_wall = info.get("wall")
        if known_wall:
            wall_hint = f" (located on the {known_wall.upper()} wall)"

    message = (
        f"Navigation to {ap_label}{wall_hint}: "
        f"Estimated distance = {distance} m | "
        f"Signal = {current_rssi} dBm | "
        f"{direction_hint}"
    )

    return message
