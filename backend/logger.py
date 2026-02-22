"""
Logging configuration for the Google Drive Chatbot backend.

Call setup_logging() once at startup (in main.py).
All other modules just use:  logger = logging.getLogger(__name__)
"""

import logging
import sys


# ---------------------------------------------------------------------------
# ANSI color codes
# ---------------------------------------------------------------------------

RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"

BLACK   = "\033[30m"
RED     = "\033[31m"
GREEN   = "\033[32m"
YELLOW  = "\033[33m"
BLUE    = "\033[34m"
MAGENTA = "\033[35m"
CYAN    = "\033[36m"
WHITE   = "\033[37m"

BRIGHT_RED     = "\033[91m"
BRIGHT_GREEN   = "\033[92m"
BRIGHT_YELLOW  = "\033[93m"
BRIGHT_BLUE    = "\033[94m"
BRIGHT_MAGENTA = "\033[95m"
BRIGHT_CYAN    = "\033[96m"
BRIGHT_WHITE   = "\033[97m"


# ---------------------------------------------------------------------------
# Level → color / icon mapping
# ---------------------------------------------------------------------------

LEVEL_STYLES: dict[int, tuple[str, str]] = {
    logging.DEBUG:    (DIM + WHITE,        "  DEBUG"),
    logging.INFO:     (BRIGHT_GREEN,       "   INFO"),
    logging.WARNING:  (BRIGHT_YELLOW,      "   WARN"),
    logging.ERROR:    (BRIGHT_RED,         "  ERROR"),
    logging.CRITICAL: (BOLD + BRIGHT_RED,  "   CRIT"),
}


# ---------------------------------------------------------------------------
# Colored formatter
# ---------------------------------------------------------------------------

class ColorFormatter(logging.Formatter):
    """
    Outputs log lines in the form:
      HH:MM:SS  LEVEL  module_name  » message
    with per-level ANSI colors.
    """

    def format(self, record: logging.LogRecord) -> str:
        color, label = LEVEL_STYLES.get(record.levelno, (WHITE, "UNKNOWN"))

        # Shorten the logger name for readability
        name = record.name
        if name.startswith("uvicorn") or name.startswith("fastapi"):
            name_display = f"{DIM}{CYAN}{name}{RESET}"
        else:
            name_display = f"{BRIGHT_CYAN}{name}{RESET}"

        time_str = self.formatTime(record, "%H:%M:%S")

        # Format the message (handles % and exception info)
        msg = record.getMessage()
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)

        line = (
            f"{DIM}{time_str}{RESET}  "
            f"{color}{label}{RESET}  "
            f"{name_display}  "
            f"{BRIGHT_WHITE}»{RESET}  "
            f"{msg}"
        )
        return line


# ---------------------------------------------------------------------------
# Public setup function
# ---------------------------------------------------------------------------

def setup_logging(level: int = logging.INFO) -> None:
    """
    Configure the root logger with a colored console handler.
    Call this exactly once, at application startup.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColorFormatter())

    root = logging.getLogger()
    root.setLevel(level)

    # Remove any handlers that uvicorn or basicConfig may have already added
    root.handlers.clear()
    root.addHandler(handler)

    # ----------------------------------------------------------------
    # Silence noisy third-party loggers
    # ----------------------------------------------------------------
    _quiet = [
        "httpcore",
        "httpx",
        "urllib3",
        "anyio",
        "asyncio",
        "hpack",
        "h2",
        "multipart",
        "google.auth",
        "google.auth.transport",
        "google.api_core",
        "langchain_core.callbacks",
        "langchain.callbacks",
        "langchain_community",
        "openai",
        "anthropic",
    ]
    for name in _quiet:
        logging.getLogger(name).setLevel(logging.WARNING)

    # Uvicorn access log → INFO (keep request lines visible)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)

    logging.getLogger(__name__).debug("Logging initialised (level=%s)", logging.getLevelName(level))
