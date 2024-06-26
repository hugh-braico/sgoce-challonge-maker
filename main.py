from requests import post
import json
from sys import exit
from datetime import date, timedelta
from dateutil.relativedelta import FR, SU, relativedelta


# Get date object representing the last friday of a given month
def last_friday_of_month(y,m):
    return date.fromisoformat(f"{y}-{m:02d}-01") + relativedelta(day=31, weekday=FR(-1))


# Get date object representing the first sunday of a given month
def first_sunday_of_month(y,m):
    return date.fromisoformat(f"{y}-{m:02d}-01") + relativedelta(day=1, weekday=SU(1))


# Tournaments are run at 7pm NSW time, but NSW has daylight savings
# Given a day, figure out the UTC timestamp we need to use for it to be 7pm NSW
def nsw_timestamp(d):
    if d >= first_sunday_of_month(d.year,4) and d < first_sunday_of_month(d.year,10):
        return " 19:00+10:00"
    else:
        return " 19:00+11:00"


def post_api_request(api_url, data):
    headers = {
        "User-Agent": "python3/Windows"
    }
    while True:
        resp = post(api_url, json=data, headers=headers)
        if resp: 
            print(f"Success!")
            return
        elif resp.status_code == 422:
            print(f"Server returned 422, probably URL already taken. Skipping.")
            return
        elif resp.status_code == 502:
            print(f"Server returned 502, retrying...")
        else:
            print(f"ERROR: HTTP request returned {resp.status_code}")
            print(resp.text)
            input("\nPress Enter to continue...")
            exit()


def create_newbbats(api_url, event_date, event_number):
    print(f"Creating Newbbats  {event_number} on {event_date.isoformat()}...")
    newbbats_description = "<br>".join([
        "<b>Open to newer players of Skullgirls Oceania and more familiar players trying very new things!</b> Feel free to sign up now, and let me know if anything comes up later on.",
        "<br><b>The format depends on the number of entrants:</b>",
        "<b>2: One FT10 set</b>",
        "<b>3-4: FT5 round robin</b>",
        "<b>5-6: FT3 round robin</b>",
        "<b>7+: FT3 Swiss (5 rounds)</b>",
        "<br>If it's round robin, you're free to organise your matches to happen in any order - just remember to report your scores as you go. I'll be streaming/commentating some of the matches while the others happen in the background.",
        "<br><b>We're going to be running on Retail currently.</b>"
    ])
    data = {
        "tournament": {
            "name": f"Skullgirls OCE {event_date.year} - Newbbats {event_number}",
            "url": f"sgoce{event_date.year}newbbats{event_number}",
            "description": newbbats_description,
            "tournament_type": "round robin",
            "start_at": event_date.isoformat() + nsw_timestamp(event_date),
            "open_signup": "true"
        }
    }
    post_api_request(api_url, data)


def create_quickbats(api_url, event_date, event_number):
    print(f"Creating Quickbats {event_number} on {event_date.isoformat()}...")
    data = {
        "tournament": {
            "name": f"Skullgirls OCE {event_date.year} - Quickbats {event_number}",
            "url": f"sgoce{event_date.year}quickbats{event_number}",
            "description": "<br>".join([
                "SGOCE's weekly netplay tournament, designed to finish nice and quickly. All sets are FT2, except for Winners Final, Losers Final, and Grand Final, which are all FT3.",
                "<br><b>We're going to be running on Retail currently.</b>"
            ]),
            "tournament_type": "double elimination",
            "start_at": event_date.isoformat() + nsw_timestamp(event_date),
            "open_signup": "true"
        }
    }
    post_api_request(api_url, data)


def create_ranbats(api_url, event_date):
    month_abv = event_date.strftime("%b")
    print(f"Creating Ranbats {month_abv} on {event_date.isoformat()}...")
    data = {
        "tournament": {
            "name": f"Skullgirls OCE {event_date.year} - Ranbats {month_abv}",
            "url": f"sgoce{event_date.year}ranbats{month_abv.lower()}",
            "description": "<br>".join([
                "SGOCE's premier netplay monthly tournament! FT3 all the way through.",
                "<br><b>We're going to be running on Retail currently.</b>"
            ]),
            "tournament_type": "double elimination",
            "start_at": event_date.isoformat() + nsw_timestamp(event_date),
            "open_signup": "true"
        }
    }
    post_api_request(api_url, data)


if __name__ == "__main__":

    # get username and API key
    with open("credentials.json", "r") as f:
        creds = json.load(f)
    api_url = f"""https://{creds["username"]}:{creds["apikey"]}@api.challonge.com/v1/tournaments.json"""

    # get month to generate brackets for
    month_abv = input(f"Enter month to generate brackets for (jan, feb, etc): ").lower()
    month_mapping = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4,  "may": 5,  "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    }
    if month_abv not in month_mapping:
        print(f"ERROR: month must be one of {list(month_mapping.keys())}")
        input("\nPress Enter to continue...")
        exit()
    month = month_mapping[month_abv]

    # get year
    # account for possibility that it's (eg) dec 2022 and making brackets for jan 2023
    today = date.today()
    year = today.year
    if month == 1 and today.month == 12:
        year += 1

    # figure out which newbbats/quickbats number to start from
    newbbats_counter = 1
    quickbats_counter = 1
    day_counter = date.fromisoformat(f"{year}-01-01")
    while day_counter.month != month:
        if day_counter.weekday() == 3:
            newbbats_counter += 1
            # print(f"{day_counter.isoformat()} is a Thursday, newbbats_counter = {newbbats_counter}")
        if day_counter.weekday() == 4 and day_counter != last_friday_of_month(year,day_counter.month):
            quickbats_counter += 1
            # print(f"{day_counter.isoformat()} is a non-final Friday, quickbats_counter = {quickbats_counter}")
        day_counter += timedelta(days=1)

    # generate newbbats and quickbats brackets
    day_counter = date.fromisoformat(f"{year}-{month:02d}-01")
    last_friday = last_friday_of_month(year,day_counter.month)
    while day_counter.month == month:
        if day_counter.weekday() == 3:
            create_newbbats(api_url, day_counter, newbbats_counter)
            newbbats_counter += 1
        elif day_counter.weekday() == 4 and day_counter != last_friday:
            create_quickbats(api_url, day_counter, quickbats_counter)
            quickbats_counter += 1
        day_counter += timedelta(days=1)

    # generate ranbats on the last Friday of the month
    create_ranbats(api_url, last_friday)

    input("\nDone!\n\nPress Enter to continue...")