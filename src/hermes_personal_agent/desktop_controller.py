# -*- coding: utf-8 -*-
"""Safe desktop application, media and OS automation for Yordamchi personal agent."""
import subprocess
import urllib.parse
import shutil
import logging
from typing import Dict, Any

LOG = logging.getLogger("hermes_personal_agent.desktop_controller")

def open_url(url: str) -> Dict[str, Any]:
    """Open a URL in the user's default browser."""
    try:
        url = url.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            url = "https://" + url
        subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "message": f"Brauzerda havola ochildi: {url}"}
    except Exception as exc:
        LOG.error("open_url failed: %s", exc)
        return {"ok": False, "error": str(exc)}

def play_youtube(query: str) -> Dict[str, Any]:
    """Search and play a video or music track on YouTube."""
    try:
        query = query.strip()
        if not query:
            return {"ok": False, "error": "Qidiruv so‘zi bo‘sh bo‘lishi mumkin emas."}
        encoded = urllib.parse.quote_plus(query)
        url = f"https://www.youtube.com/results?search_query={encoded}"
        subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "message": f"YouTube'da '{query}' qidiruvi ochildi va ijroga tayyorlandi: {url}"}
    except Exception as exc:
        LOG.error("play_youtube failed: %s", exc)
        return {"ok": False, "error": str(exc)}

def open_app(app_name: str) -> Dict[str, Any]:
    """Launch a desktop application by common alias or system command."""
    app_lower = app_name.lower().strip()
    app_map = {
        "chrome": "google-chrome",
        "google chrome": "google-chrome",
        "brauzer": "google-chrome",
        "browser": "google-chrome",
        "code": "code",
        "vscode": "code",
        "vs code": "code",
        "pycharm": "pycharm-community",
        "clion": "clion",
        "telegram": "telegram-desktop",
        "terminal": "gnome-terminal",
        "calc": "gnome-calculator",
        "kalkulyator": "gnome-calculator",
        "files": "nautilus",
        "papka": "nautilus",
    }
    target = app_map.get(app_lower, app_lower)
    try:
        bin_path = shutil.which(target)
        if bin_path:
            subprocess.Popen([bin_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True, "message": f"'{target}' ilovasi ishga tushirildi."}
        subprocess.Popen(["gtk-launch", target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "message": f"'{target}' tizim ilovasi ishga tushirildi."}
    except Exception as exc:
        LOG.error("open_app failed: %s", exc)
        return {"ok": False, "error": str(exc)}

def set_volume(level: int) -> Dict[str, Any]:
    """Set system audio volume percentage (0..100)."""
    try:
        level_int = max(0, min(100, int(level)))
        subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level_int}%"], check=True)
        return {"ok": True, "message": f"Tizim ovozi balandligi {level_int}% ga o‘rnatildi."}
    except Exception as exc:
        LOG.error("set_volume failed: %s", exc)
        return {"ok": False, "error": str(exc)}

def get_volume() -> Dict[str, Any]:
    """Get current system volume level."""
    try:
        res = subprocess.run(["pactl", "get-sink-volume", "@DEFAULT_SINK@"], capture_output=True, text=True, check=True)
        return {"ok": True, "output": res.stdout.strip()}
    except Exception as exc:
        LOG.error("get_volume failed: %s", exc)
        return {"ok": False, "error": str(exc)}

def github_action(subcommand: str) -> Dict[str, Any]:
    """Execute authorized GitHub CLI command safely."""
    try:
        parts = subcommand.strip().split()
        if not parts:
            return {"ok": False, "error": "GitHub buyrug‘i ko‘rsatilmadi."}
        allowed = {"repo", "issue", "pr", "status", "gist", "browse"}
        if parts[0] not in allowed:
            return {"ok": False, "error": f"Faqat ruxsat etilgan buyruqlar: {list(allowed)}"}
        res = subprocess.run(["gh"] + parts, capture_output=True, text=True, timeout=20)
        return {
            "ok": res.returncode == 0,
            "output": res.stdout.strip() if res.returncode == 0 else res.stderr.strip()
        }
    except Exception as exc:
        LOG.error("github_action failed: %s", exc)
        return {"ok": False, "error": str(exc)}
