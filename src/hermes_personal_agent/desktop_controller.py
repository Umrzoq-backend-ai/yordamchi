# -*- coding: utf-8 -*-
"""Safe desktop application, media and OS automation for Yordamchi personal agent."""
import subprocess
import urllib.parse
import urllib.request
import re
import os
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
    """Search and play a video or music track on YouTube directly."""
    try:
        query = query.strip()
        if not query:
            return {"ok": False, "error": "Qidiruv so‘zi bo‘sh bo‘lishi mumkin emas."}
        encoded = urllib.parse.quote_plus(query)
        search_url = f"https://www.youtube.com/results?search_query={encoded}"
        video_url = search_url
        try:
            req = urllib.request.Request(
                search_url,
                headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            )
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
            video_ids = re.findall(r"/watch\?v=([a-zA-Z0-9_-]{11})", html)
            if video_ids:
                video_url = f"https://www.youtube.com/watch?v={video_ids[0]}"
        except Exception as search_err:
            LOG.warning("Direct video extraction fallback to search url: %s", search_err)

        env = os.environ.copy()
        if "DISPLAY" not in env:
            env["DISPLAY"] = ":0"
        if "WAYLAND_DISPLAY" not in env:
            env["WAYLAND_DISPLAY"] = "wayland-0"

        subprocess.Popen(["xdg-open", video_url], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {
            "ok": True,
            "url": video_url,
            "message": f"YouTube'da '{query}' qo‘shig‘i ochildi va ijro etilmoqda: {video_url}"
        }
    except Exception as exc:
        LOG.error("play_youtube failed: %s", exc)
        return {"ok": False, "error": str(exc)}

def open_app(app_name: str) -> Dict[str, Any]:
    """Launch any desktop application, camera, or web app by name or alias."""
    app_lower = app_name.lower().strip()
    if not app_lower:
        return {"ok": False, "error": "Ilova nomi ko‘rsatilmadi."}

    stem = re.sub(r'(ni|da|dan|ga|ning)$', '', app_lower).strip()

    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0"
    if "WAYLAND_DISPLAY" not in env:
        env["WAYLAND_DISPLAY"] = "wayland-0"

    # 1. High-priority explicit alias mappings
    explicit_aliases = {
        "youtube": "https://www.youtube.com",
        "youtub": "https://www.youtube.com",
        "yutub": "https://www.youtube.com",
        "google": "https://www.google.com",
        "gmail": "https://mail.google.com",
        "yandex": "https://yandex.com",
        "kamera": "cheese",
        "camera": "cheese",
        "vebkamera": "cheese",
        "webcam": "cheese",
        "rasmga olish": "cheese",
        "video olish": "cheese",
        "instagram": "chrome-akpamiohjfcnimfljfndmaldlcfphjmp-Default",
        "insta": "chrome-akpamiohjfcnimfljfndmaldlcfphjmp-Default",
        "claude": "chrome-fmpnliohjhemenmnlpbfagaolkdacoja-Default",
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
        "fayllar": "nautilus",
        "papka": "nautilus",
        "sozlamalar": "gnome-control-center",
        "settings": "gnome-control-center",
        "firefox": "firefox",
        "wps": "wps",
        "word": "wps",
        "rocketchat": "rocketchat-desktop",
    }

    target = explicit_aliases.get(app_lower) or explicit_aliases.get(stem)
    if target:
        if target.startswith("http://") or target.startswith("https://"):
            subprocess.Popen(["xdg-open", target], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True, "message": f"'{app_name}' ochildi: {target}"}
        bin_path = shutil.which(target)
        if bin_path:
            subprocess.Popen([bin_path], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True, "message": f"'{app_name}' ilovasi ishga tushirildi."}
        res = subprocess.run(["gtk-launch", target], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode == 0:
            return {"ok": True, "message": f"'{app_name}' ilovasi ishga tushirildi."}

    # 2. Dynamic discovery from all system and user .desktop files
    import glob
    search_dirs = [
        os.path.expanduser("~/.local/share/applications"),
        "/usr/share/applications",
        "/var/lib/snapd/desktop/applications",
    ]
    for d in search_dirs:
        for f in glob.glob(os.path.join(d, "*.desktop")):
            try:
                base = os.path.basename(f)
                name_val = None
                exec_val = None
                with open(f, "r", encoding="utf-8", errors="ignore") as fp:
                    for line in fp:
                        if line.startswith("Name=") and not name_val:
                            name_val = line.strip().split("=", 1)[1].lower()
                        elif line.startswith("Exec=") and not exec_val:
                            exec_val = line.strip().split("=", 1)[1]
                if name_val and (app_lower in name_val or name_val in app_lower or app_lower in base.lower()):
                    desktop_id = base[:-8] if base.endswith(".desktop") else base
                    res = subprocess.run(["gtk-launch", desktop_id], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if res.returncode == 0:
                        return {"ok": True, "message": f"'{name_val.title()}' ilovasi ochildi."}
                    if exec_val:
                        clean_exec = re.sub(r'%[a-zA-Z]', '', exec_val).strip()
                        subprocess.Popen(clean_exec, shell=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        return {"ok": True, "message": f"'{name_val.title()}' ilovasi ochildi."}
            except Exception:
                pass

    # 3. Direct binary lookup
    bin_path = shutil.which(app_lower)
    if bin_path:
        subprocess.Popen([bin_path], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "message": f"'{app_name}' ilovasi ishga tushirildi."}

    # 4. Web service fallback
    web_services = {
        "youtube": "https://www.youtube.com",
        "youtub": "https://www.youtube.com",
        "yutub": "https://www.youtube.com",
        "google": "https://www.google.com",
        "gmail": "https://mail.google.com",
        "yandex": "https://yandex.com",
        "instagram": "https://www.instagram.com",
        "tiktok": "https://www.tiktok.com",
        "chatgpt": "https://chatgpt.com",
        "gemini": "https://gemini.google.com",
        "github": "https://github.com",
        "linkedin": "https://linkedin.com",
        "whatsapp": "https://web.whatsapp.com",
        "spotify": "https://open.spotify.com",
        "notion": "https://notion.so",
    }
    for k, url in web_services.items():
        if k in app_lower:
            subprocess.Popen(["xdg-open", url], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True, "message": f"'{k.title()}' veb-ilovasi ochildi: {url}"}

    return {"ok": False, "error": f"'{app_name}' ilovasi kompyuterda topilmadi."}

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
