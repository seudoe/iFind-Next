import requests
from bs4 import BeautifulSoup
import pandas as pd
import time

URL = "https://in.indeed.com/jobs?q=internship+for+student"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/"
}

def clean(x):
    return x.strip() if x else "Not specified"

def scrape_indeed():
    jobs = []
    print(f"Fetching {URL}...")
    try:
        response = requests.get(URL, headers=HEADERS, timeout=15)
        if response.status_code == 403:
            print("Indeed blocked the request (403 Forbidden).")
            return []
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching Indeed: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")

    # Indeed often changes these classes. We try multiple known ones.
    cards = soup.select("div.job_seen_beacon") or soup.select("td.resultContent") or soup.select("div.cardOutline")
    
    print(f"Found {len(cards)} job cards")

    for card in cards:
        try:
            # Title
            title_tag = card.select_one("h2.jobTitle span[title]") or card.select_one("h2 span") or card.find("h2")
            title = clean(title_tag.text) if title_tag else "Not specified"

            # Company
            company_tag = card.select_one("span.companyName") or card.select_one("[data-testid='company-name']") or card.select_one(".css-1x7z1ps")
            company = clean(company_tag.text) if company_tag else "Not specified"

            # Location
            location_tag = card.select_one("div.companyLocation") or card.select_one("[data-testid='text-location']") or card.select_one(".css-1p0i51n")
            location = clean(location_tag.text) if location_tag else "Not specified"

            # Link
            link_tag = card.find("a", href=True)
            link = "https://in.indeed.com" + link_tag["href"] if link_tag else ""

            if title != "Not specified":
                jobs.append({
                    "title": title,
                    "company": company,
                    "location": location,
                    "salary": "Not specified",
                    "skills": "",
                    "link": link
                })

        except Exception as e:
            continue

    return jobs


def save_csv(jobs):
    if not jobs:
        print("No jobs found for Indeed. Skipping CSV creation.")
        return
    df = pd.DataFrame(jobs)
    expected_cols = ["title", "company", "location", "salary", "skills", "link"]
    for col in expected_cols:
        if col not in df.columns:
            df[col] = "Not specified"
    df = df[expected_cols]
    df.to_csv("indeed_internships.csv", index=False)
    print(f"Saved {len(df)} Indeed jobs to indeed_internships.csv")


if __name__ == "__main__":
    data = scrape_indeed()
    save_csv(data)