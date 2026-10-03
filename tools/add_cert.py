#!/usr/bin/env python3
"""Add or list certificate records for the Aurelle Academy verification page.

Records are encrypted so the public data/certificates.json reveals no names or IDs.
The owner's plain-text ledger lives in tools/registry.private.csv (git-ignored, never published).

Usage:
  python tools/add_cert.py add --name "Zeinab Shirini" --course "Cluster & Temporary Lash Application" --date "October 2026"
  python tools/add_cert.py list
"""
import argparse
import base64
import csv
import hashlib
import json
import secrets
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "certificates.json"
LEDGER = Path(__file__).resolve().parent / "registry.private.csv"

SALT = b"aurelle-academy-certificates-v1"
ITERATIONS = 200_000
ID_PREFIX = "AUR"
ID_BODY_LENGTH = 8
# Unambiguous alphabet: no I, O, 0, 1
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def normalize(raw: str) -> str:
    return "".join(ch for ch in raw.upper() if ch.isalnum())


def format_id(normalized: str) -> str:
    body = normalized[len(ID_PREFIX):]
    return f"{ID_PREFIX}-{body[:4]}-{body[4:]}"


def derive(normalized_id: str):
    raw = hashlib.pbkdf2_hmac("sha256", normalized_id.encode(), SALT, ITERATIONS, dklen=32)
    return raw[:16].hex(), raw[16:32]


def load():
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {"v": 1, "iter": ITERATIONS, "records": {}}


def save(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def new_id(existing_lookups):
    while True:
        body = "".join(secrets.choice(ALPHABET) for _ in range(ID_BODY_LENGTH))
        normalized = ID_PREFIX + body
        lookup, key = derive(normalized)
        if lookup not in existing_lookups:
            return normalized, lookup, key


def cmd_add(args):
    data = load()
    normalized, lookup, key = new_id(data["records"])
    payload = {
        "name": args.name,
        "course": args.course,
        "date": args.date,
        "status": args.status,
    }
    iv = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(payload, ensure_ascii=False).encode("utf-8"), None)
    data["iter"] = ITERATIONS
    data["records"][lookup] = {
        "iv": base64.b64encode(iv).decode(),
        "ct": base64.b64encode(ct).decode(),
    }
    save(data)

    display_id = format_id(normalized)
    new_file = not LEDGER.exists()
    with LEDGER.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if new_file:
            writer.writerow(["id", "name", "course", "date", "status"])
        writer.writerow([display_id, args.name, args.course, args.date, args.status])

    print(f"Certificate ID: {display_id}")
    print(f"Student: {args.name}")
    print("Saved to data/certificates.json (encrypted) and tools/registry.private.csv (private).")


def cmd_list(_args):
    if not LEDGER.exists():
        print("No records yet.")
        return
    with LEDGER.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            print(f"{row['id']}  {row['name']}  |  {row['course']}  |  {row['date']}  |  {row['status']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", help="create a new certificate record and ID")
    add.add_argument("--name", required=True)
    add.add_argument("--course", required=True)
    add.add_argument("--date", required=True, help='e.g. "October 2026"')
    add.add_argument("--status", default="Valid")
    add.set_defaults(func=cmd_add)

    ls = sub.add_parser("list", help="show the private ledger")
    ls.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    sys.exit(main())
