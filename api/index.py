import sys
from pathlib import Path

# Let Vercel find the backend code
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from main import app  # noqa: E402,F401