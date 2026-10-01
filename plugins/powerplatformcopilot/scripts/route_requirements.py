#!/usr/bin/env python3
"""Tag requirements with domain codes using TypeSafe System One.

Input : JSON list of {"id": str, "text": str}, from a file path or stdin.
Output: JSON list of {id, text, domains, primary, confidence, needs_review} on stdout.

Domain codes and their routing questions come from references/domain-codes.md.
Needs Python 3.10+ and the TYPESAFE_API_KEY environment variable.
"""

import argparse
import json
import re
import sys
from pathlib import Path

from typesafe_sdk import Choice, Noul, TypeSafeClient, TypeSafeError

DOMAIN_FILE = Path(__file__).resolve().parent.parent / "references" / "domain-codes.md"
ROW = re.compile(r"^\|\s*(D-[A-Z]+)\s*\|[^|]*\|[^|]*\|\s*(.+?)\s*\|\s*$")


def load_domains(path: Path) -> dict[str, str]:
    """Return {code: routing question} parsed from the domain table."""
    domains = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = ROW.match(line)
        if match:
            domains[match.group(1)] = match.group(2)
    if not domains:
        sys.exit(f"error: no domain rows found in {path}")
    return domains


def build_questions(domains: dict[str, str]) -> dict:
    questions = {code: Noul(instructions=question) for code, question in domains.items()}
    questions["primary"] = Choice(
        instructions="Which single domain is the best fit to design this requirement?",
        criteria={**{code: question for code, question in domains.items()}, "none": "No listed domain fits."},
    )
    return questions


def route(client: TypeSafeClient, item: dict, questions: dict, threshold: float, min_confidence: float) -> dict:
    response = client.system_one(state={"requirement": item["text"]}, questions=questions)
    hits = {code: a.noul for code, a in response.nouls.items() if a.noul >= threshold}
    primary = response.choices["primary"]
    domains = sorted(hits, key=hits.get, reverse=True)
    return {
        "id": item["id"],
        "text": item["text"],
        "domains": domains,
        "primary": primary.choice,
        "confidence": round(primary.confidence, 3),
        "needs_review": not domains or primary.choice == "none" or primary.confidence < min_confidence,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", nargs="?", help="JSON file of requirements. Reads stdin if omitted.")
    parser.add_argument("--threshold", type=float, default=0.5, help="Min yes-probability for a domain (default 0.5).")
    parser.add_argument("--min-confidence", type=float, default=0.6, help="Min primary confidence before review (default 0.6).")
    parser.add_argument("--domains", type=Path, default=DOMAIN_FILE, help="Domain table file.")
    args = parser.parse_args()

    raw = Path(args.input).read_text(encoding="utf-8") if args.input else sys.stdin.read()
    try:
        items = json.loads(raw)
        assert isinstance(items, list) and all("id" in i and "text" in i for i in items)
    except (json.JSONDecodeError, AssertionError, TypeError):
        sys.exit('error: input must be a JSON list of {"id": ..., "text": ...}')

    questions = build_questions(load_domains(args.domains))
    try:
        with TypeSafeClient() as client:
            results = [route(client, i, questions, args.threshold, args.min_confidence) for i in items]
    except TypeSafeError as error:
        sys.exit(f"error: TypeSafe request failed: {error}. Check TYPESAFE_API_KEY.")

    json.dump(results, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
