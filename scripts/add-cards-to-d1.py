#!/usr/bin/env python3
"""Insert exclusion rows into D1 via wrangler."""
import subprocess

exclusions = [
    ("hsbc-travelone",  "government",     "Government payments — court costs, fines, bail, tax, government services, postal"),
    ("hsbc-travelone",  "financial",      "Financial institutions — money transfer, cash disbursements, securities brokers/dealers"),
    ("hsbc-travelone",  "insurance",      "Insurance — sales, underwriting, premiums"),
    ("hsbc-travelone",  "quasi_cash",    "Quasi-cash — cryptocurrency, money orders, travelers cheques, debt repayment"),
    ("hsbc-travelone",  "ewallet_load",  "E-wallet loads and top-ups (EZ-Link, Transitlink, NETS Flashpay, YouTrip, etc.)"),
    ("hsbc-travelone",  "utilities",     "Utilities — electric, gas, water, sanitary"),
    ("hsbc-travelone",  "education",     "Educational institutions — schools, colleges, universities"),
    ("hsbc-travelone",  "donations",     "Donations to charitable, social organisations, religious organisations"),
    ("hsbc-travelone",  "professional", "Professional services — Google Ads, Facebook Ads, AWS, media traffic agency"),
    ("hsbc-travelone",  "cleaning",     "Cleaning, maintenance and janitorial services"),
    ("hsbc-travelone",  "gambling",     "Gambling — lottery tickets, casino chips, horse/dog racing"),
    ("hsbc-revolution",  "government",   "Government payments — court costs, fines, bail, tax, government services, postal"),
    ("hsbc-revolution",  "financial",    "Financial institutions — money transfer, cash disbursements, securities brokers/dealers"),
    ("hsbc-revolution",  "insurance",    "Insurance — sales, underwriting, premiums"),
    ("hsbc-revolution",  "quasi_cash",   "Quasi-cash — cryptocurrency, money orders, travelers cheques, debt repayment"),
    ("hsbc-revolution",  "ewallet_load", "E-wallet loads and top-ups (EZ-Link, Transitlink, NETS Flashpay, YouTrip, etc.)"),
    ("hsbc-revolution",  "utilities",    "Utilities — electric, gas, water, sanitary"),
    ("hsbc-revolution",  "education",    "Educational institutions — schools, colleges, universities"),
    ("hsbc-revolution",  "donations",    "Donations to charitable, social organisations, religious organisations"),
    ("hsbc-revolution",  "professional", "Professional services — Google Ads, Facebook Ads, AWS, media traffic agency"),
    ("hsbc-revolution",  "cleaning",     "Cleaning, maintenance and janitorial services"),
    ("hsbc-revolution",  "gambling",     "Gambling — lottery tickets, casino chips, horse/dog racing"),
    ("dbs-womans",      "financial",    "Financial institutions — cash disbursements, merchandise/services/debt repayment"),
    ("dbs-womans",      "insurance",   "Insurance — sales, underwriting, premiums (MCC 6300, 6381, 6399)"),
    ("dbs-womans",      "government",  "Government — court costs, fines, bail, tax, government services"),
    ("dbs-womans",      "education",    "Educational institutions — schools, colleges, universities, vocational"),
    ("dbs-womans",      "charity",      "Charitable and non-profit organisations"),
    ("dbs-womans",      "quasi_cash",   "Quasi-cash — tolls, parking, truck stops, stored value loads"),
    ("dbs-womans",      "mcc_4829",    "MCC 4829 — Money Transfer"),
    ("dbs-womans",      "mcc_4900",    "MCC 4900 — Utilities"),
    ("dbs-womans",      "mcc_5199",    "MCC 5199 — Nondurable Goods"),
    ("dbs-womans",      "mcc_5960",    "MCC 5960 — Direct Marketing Insurance"),
    ("dbs-womans",      "mcc_6050",    "MCC 6050 — Quasi Cash Financial Institutions"),
    ("dbs-womans",      "mcc_6051",    "MCC 6051 — Cryptocurrency / Non-fiat currency"),
    ("dbs-womans",      "mcc_6211",    "MCC 6211 — Security Brokers / Dealers"),
    ("dbs-womans",      "mcc_6513",    "MCC 6513 — Real Estate Agents and Managers"),
    ("dbs-womans",      "mcc_7523",    "MCC 7523 — Parking Lots and Garages"),
    ("dbs-womans",      "mcc_7995",    "MCC 7995 — Betting and Lottery"),
    ("dbs-womans",      "mcc_8062",    "MCC 8062 — Hospitals"),
    ("dbs-womans",      "mcc_8211_8299","MCC 8211-8299 — Schools and Educational Services"),
    ("dbs-womans",      "mcc_8661",    "MCC 8661 — Religious Organisations"),
    ("dbs-womans",      "mcc_9311",    "MCC 9311 — Tax Payments"),
    ("dbs-womans",      "mcc_9399_9405","MCC 9399-9405 — Government Services and Postal"),
    ("dbs-womans-world","financial",    "Financial institutions — cash disbursements, merchandise/services/debt repayment"),
    ("dbs-womans-world","insurance",    "Insurance — sales, underwriting, premiums (MCC 6300, 6381, 6399)"),
    ("dbs-womans-world","government",   "Government — court costs, fines, bail, tax, government services"),
    ("dbs-womans-world","education",    "Educational institutions — schools, colleges, universities, vocational"),
    ("dbs-womans-world","charity",      "Charitable and non-profit organisations"),
    ("dbs-womans-world","quasi_cash",   "Quasi-cash — tolls, parking, truck stops, stored value loads"),
    ("dbs-womans-world","mcc_4829",    "MCC 4829 — Money Transfer"),
    ("dbs-womans-world","mcc_4900",    "MCC 4900 — Utilities"),
    ("dbs-womans-world","mcc_5199",    "MCC 5199 — Nondurable Goods"),
    ("dbs-womans-world","mcc_5960",    "MCC 5960 — Direct Marketing Insurance"),
    ("dbs-womans-world","mcc_6050",    "MCC 6050 — Quasi Cash Financial Institutions"),
    ("dbs-womans-world","mcc_6051",    "MCC 6051 — Cryptocurrency / Non-fiat currency"),
    ("dbs-womans-world","mcc_6211",    "MCC 6211 — Security Brokers / Dealers"),
    ("dbs-womans-world","mcc_6513",    "MCC 6513 — Real Estate Agents and Managers"),
    ("dbs-womans-world","mcc_7523",    "MCC 7523 — Parking Lots and Garages"),
    ("dbs-womans-world","mcc_7995",    "MCC 7995 — Betting and Lottery"),
    ("dbs-womans-world","mcc_8062",    "MCC 8062 — Hospitals"),
    ("dbs-womans-world","mcc_8211_8299","MCC 8211-8299 — Schools and Educational Services"),
    ("dbs-womans-world","mcc_8661",    "MCC 8661 — Religious Organisations"),
    ("dbs-womans-world","mcc_9311",    "MCC 9311 — Tax Payments"),
    ("dbs-womans-world","mcc_9399_9405","MCC 9399-9405 — Government Services and Postal"),
]

count = 0
for card_id, category, description in exclusions:
    # Escape single quotes in SQLite string literals
    desc_escaped = description.replace("'", "''")
    cmd = f"INSERT INTO exclusions (card_id, category, description) VALUES ('{card_id}', '{category}', '{desc_escaped}') ON CONFLICT(card_id, category) DO UPDATE SET description = excluded.description"
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "bestmiles-db",
         "--remote",
         "--command", cmd],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        count += 1
    else:
        print(f"FAILED: {card_id}/{category}: {result.stderr[:200]}")

print(f"Inserted {count}/{len(exclusions)} exclusion rows")
