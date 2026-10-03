"""Haqiqiy Avtora serveri; faqat Google'ning ochiq kaliti sinov kaliti bilan almashtiriladi (token tekshiruvi — haqiqiy kod)."""
import os, sys
from cryptography.hazmat.primitives import serialization
sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
import accounts.google as g
PUB = serialization.load_pem_public_key(open(os.environ["GOOGLE_TEST_PUBKEY"], "rb").read())
g._signing_key = lambda token: PUB
from django.core.management import execute_from_command_line
execute_from_command_line(["manage.py", "start", "--port", os.environ.get("PORT", "8500")])
