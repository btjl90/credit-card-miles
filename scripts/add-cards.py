#!/usr/bin/env python3
"""
Add credit cards to Google Sheets via OAuth2 (service account).

Usage:
    python3 add-cards.py

Requirements:
    pip install google-auth google-api-python-client

OAuth2 setup:
    1. Create a GCP service account and download the JSON key
    2. Share your Google Sheet with the service account email
       (found in the JSON under "client_email")
    3. Set SERVICE_ACCOUNT_KEY path below, or set GOOGLE_SERVICE_ACCOUNT_KEY env var
"""

import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

# ─── CONFIG ─────────────────────────────────────────────────────────────────
# Path to your service account JSON key
SERVICE_ACCOUNT_KEY = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_KEY",
    "/Users/bentan/Documents/GitHub/credit-card-miles/workspaces/credit-card-miles/keys/best-miles-c48a9cf03d59.json"
)

SPREADSHEET_ID = "1Vx_gyV09OezNiUL6sBztt14iP2KUaRp4CGm-UB8hqEU"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_sheets_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_KEY, scopes=SCOPES
    )
    return build("sheets", "v4", credentials=creds)


def append_rows(sheets, sheet_name, rows):
    """Append rows to a sheet tab. Returns the updated range."""
    result = sheets.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A:Z",
        valueInputOption="USER_ENTERED",
        body={"values": rows},
    ).execute()
    return result.get("updates", {}).get("updatedRange", "?")


# ─── CARD DATA ───────────────────────────────────────────────────────────────
# Fields: id, name, bank, annual_fee, miles_per_sgd, points_system,
#         points_conversion_ratio, tnc_url
CARDS = [
    ["hsbc-travelone",    "HSBC TravelOne",           "HSBC", "18000", "0.4", "points", "2.5",
     "https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/travelone/credit-card-reward-points-programme-terms-and-conditions.pdf"],
    ["hsbc-revolution",   "HSBC Revolution",          "HSBC", "18000", "2.0", "points", "2.5",
     "https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/revolution-credit-card-reward-points-terms-and-conditions.pdf"],
    ["dbs-womans",        "DBS Woman's Card",         "DBS",  "16350", "0.2", "points", "2.0",
     "https://www.dbs.com.sg/iwov-resources/media/pdf/cards/dbs-womans-card-tnc.pdf"],
    ["dbs-womans-world",  "DBS Woman's World Card",   "DBS",  "19620", "0.2", "points", "2.0",
     "https://www.dbs.com.sg/iwov-resources/media/pdf/cards/dbs-womans-card-tnc.pdf"],
]

# Bonus categories: card_id, category, multiplier, description
BONUS_CATEGORIES = [
    ["hsbc-travelone",  "local",         "1",  "Base earn rate — all qualifying transactions"],
    ["hsbc-travelone",  "local_bonus",  "2",  "Dining, entertainment, and daily spend locally"],
    ["hsbc-travelone",  "overseas",      "5",  "All transactions made in foreign currency"],
    ["hsbc-revolution",  "local",        "1",  "Base earn rate — all qualifying transactions"],
    ["hsbc-revolution",  "select_online","10", "Travel, dining, retail, transport via contactless or online"],
    ["dbs-womans",      "local",        "1",  "Base earn rate — 1 DBS Point per S$5 on all spend"],
    ["dbs-womans",      "online",       "5",  "5 DBS Points per S$5 online spend — first S$1,000/month"],
    ["dbs-womans-world","local",         "1",  "Base earn rate — 1 DBS Point per S$5 on all spend"],
    ["dbs-womans-world","overseas",      "3",  "3 DBS Points per S$5 equivalent in foreign currency"],
    ["dbs-womans-world","online",        "10", "10 DBS Points per S$5 online spend — first S$1,000/month"],
]

# Exclusions: card_id, category, description
EXCLUSIONS = [
    # HSBC TravelOne & Revolution (same exclusion set)
    ["hsbc-travelone",  "government",      "Government payments — court costs, fines, bail, tax, government services, postal"],
    ["hsbc-travelone",  "financial",        "Financial institutions — money transfer, cash disbursements, securities brokers/dealers"],
    ["hsbc-travelone",  "insurance",        "Insurance — sales, underwriting, premiums"],
    ["hsbc-travelone",  "quasi_cash",       "Quasi-cash — cryptocurrency, money orders, travelers cheques, debt repayment"],
    ["hsbc-travelone",  "ewallet_load",     "E-wallet loads and top-ups (EZ-Link, Transitlink, NETS Flashpay, YouTrip, etc.)"],
    ["hsbc-travelone",  "utilities",        "Utilities — electric, gas, water, sanitary"],
    ["hsbc-travelone",  "education",        "Educational institutions — schools, colleges, universities"],
    ["hsbc-travelone",  "donations",        "Donations to charitable, social organisations, religious organisations"],
    ["hsbc-travelone",  "professional",     "Professional services — Google Ads, Facebook Ads, AWS, media traffic agency"],
    ["hsbc-travelone",  "cleaning",         "Cleaning, maintenance and janitorial services"],
    ["hsbc-travelone",  "gambling",         "Gambling — lottery tickets, casino chips, horse/dog racing"],
    ["hsbc-revolution",  "government",      "Government payments — court costs, fines, bail, tax, government services, postal"],
    ["hsbc-revolution",  "financial",        "Financial institutions — money transfer, cash disbursements, securities brokers/dealers"],
    ["hsbc-revolution",  "insurance",       "Insurance — sales, underwriting, premiums"],
    ["hsbc-revolution",  "quasi_cash",       "Quasi-cash — cryptocurrency, money orders, travelers cheques, debt repayment"],
    ["hsbc-revolution",  "ewallet_load",    "E-wallet loads and top-ups (EZ-Link, Transitlink, NETS Flashpay, YouTrip, etc.)"],
    ["hsbc-revolution",  "utilities",        "Utilities — electric, gas, water, sanitary"],
    ["hsbc-revolution",  "education",        "Educational institutions — schools, colleges, universities"],
    ["hsbc-revolution",  "donations",        "Donations to charitable, social organisations, religious organisations"],
    ["hsbc-revolution",  "professional",     "Professional services — Google Ads, Facebook Ads, AWS, media traffic agency"],
    ["hsbc-revolution",  "cleaning",         "Cleaning, maintenance and janitorial services"],
    ["hsbc-revolution",  "gambling",         "Gambling — lottery tickets, casino chips, horse/dog racing"],
    # DBS Woman's Card
    ["dbs-womans",      "financial",        "Financial institutions — cash disbursements, merchandise/services/debt repayment"],
    ["dbs-womans",      "insurance",       "Insurance — sales, underwriting, premiums (MCC 6300, 6381, 6399)"],
    ["dbs-womans",      "government",       "Government — court costs, fines, bail, tax, government services"],
    ["dbs-womans",      "education",         "Educational institutions — schools, colleges, universities, vocational"],
    ["dbs-womans",      "charity",           "Charitable and non-profit organisations"],
    ["dbs-womans",      "quasi_cash",        "Quasi-cash — tolls, parking, truck stops, stored value loads"],
    ["dbs-womans",      "mcc_4829",         "MCC 4829 — Money Transfer"],
    ["dbs-womans",      "mcc_4900",         "MCC 4900 — Utilities"],
    ["dbs-womans",      "mcc_5199",         "MCC 5199 — Nondurable Goods"],
    ["dbs-womans",      "mcc_5960",         "MCC 5960 — Direct Marketing Insurance"],
    ["dbs-womans",      "mcc_6050",          "MCC 6050 — Quasi Cash Financial Institutions"],
    ["dbs-womans",      "mcc_6051",          "MCC 6051 — Cryptocurrency / Non-fiat currency"],
    ["dbs-womans",      "mcc_6211",           "MCC 6211 — Security Brokers / Dealers"],
    ["dbs-womans",      "mcc_6513",           "MCC 6513 — Real Estate Agents and Managers"],
    ["dbs-womans",      "mcc_7523",           "MCC 7523 — Parking Lots and Garages"],
    ["dbs-womans",      "mcc_7995",           "MCC 7995 — Betting and Lottery"],
    ["dbs-womans",      "mcc_8062",           "MCC 8062 — Hospitals"],
    ["dbs-womans",      "mcc_8211_8299",     "MCC 8211-8299 — Schools and Educational Services"],
    ["dbs-womans",      "mcc_8661",           "MCC 8661 — Religious Organisations"],
    ["dbs-womans",      "mcc_9311",           "MCC 9311 — Tax Payments"],
    ["dbs-womans",      "mcc_9399_9405",     "MCC 9399-9405 — Government Services and Postal"],
    # DBS Woman's World Card
    ["dbs-womans-world","financial",         "Financial institutions — cash disbursements, merchandise/services/debt repayment"],
    ["dbs-womans-world","insurance",          "Insurance — sales, underwriting, premiums (MCC 6300, 6381, 6399)"],
    ["dbs-womans-world","government",          "Government — court costs, fines, bail, tax, government services"],
    ["dbs-womans-world","education",           "Educational institutions — schools, colleges, universities, vocational"],
    ["dbs-womans-world","charity",              "Charitable and non-profit organisations"],
    ["dbs-womans-world","quasi_cash",          "Quasi-cash — tolls, parking, truck stops, stored value loads"],
    ["dbs-womans-world","mcc_4829",           "MCC 4829 — Money Transfer"],
    ["dbs-womans-world","mcc_4900",           "MCC 4900 — Utilities"],
    ["dbs-womans-world","mcc_5199",           "MCC 5199 — Nondurable Goods"],
    ["dbs-womans-world","mcc_5960",           "MCC 5960 — Direct Marketing Insurance"],
    ["dbs-womans-world","mcc_6050",           "MCC 6050 — Quasi Cash Financial Institutions"],
    ["dbs-womans-world","mcc_6051",           "MCC 6051 — Cryptocurrency / Non-fiat currency"],
    ["dbs-womans-world","mcc_6211",            "MCC 6211 — Security Brokers / Dealers"],
    ["dbs-womans-world","mcc_6513",            "MCC 6513 — Real Estate Agents and Managers"],
    ["dbs-womans-world","mcc_7523",            "MCC 7523 — Parking Lots and Garages"],
    ["dbs-womans-world","mcc_7995",            "MCC 7995 — Betting and Lottery"],
    ["dbs-womans-world","mcc_8062",            "MCC 8062 — Hospitals"],
    ["dbs-womans-world","mcc_8211_8299",       "MCC 8211-8299 — Schools and Educational Services"],
    ["dbs-womans-world","mcc_8661",            "MCC 8661 — Religious Organisations"],
    ["dbs-womans-world","mcc_9311",            "MCC 9311 — Tax Payments"],
    ["dbs-womans-world","mcc_9399_9405",      "MCC 9399-9405 — Government Services and Postal"],
]


def main():
    sheets = get_sheets_service()

    print(f"Writing to spreadsheet: {SPREADSHEET_ID}")
    print(f"Using service account: {SERVICE_ACCOUNT_KEY}\n")

    print("=== Cards ===")
    for row in CARDS:
        rng = append_rows(sheets, "Cards", [row])
        print(f"  {row[1]}: {rng}")

    print("\n=== Bonus Categories ===")
    for row in BONUS_CATEGORIES:
        rng = append_rows(sheets, "BonusCategories", [row])
        print(f"  {row[0]} / {row[1]}: {rng}")

    print("\n=== Exclusions ===")
    for row in EXCLUSIONS:
        rng = append_rows(sheets, "Exclusions", [row])
        print(f"  {row[0]} / {row[1]}: {rng}")

    print("\nAll done!")


if __name__ == "__main__":
    main()
