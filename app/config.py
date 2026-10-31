"""Project paths and settings; launch commands work from the project directory."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
DATA = ROOT / 'data'
MODELS = ROOT / 'models'
PROVIDER = os.getenv('AGENT_PROVIDER', 'demo').lower()
