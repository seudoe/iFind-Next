import requests
from bs4 import BeautifulSoup
import pandas as pd

URL = "https://www.freshersworld.com/jobs/category/it-software-job-vacancies"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def clean(x):
    return x.strip() if x else "Not specified"

def scrape_freshersworld():
    jobs = []
    print(f"Fetching {URL}...")
    try:
        response = requests.get(URL, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching Freshersworld: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")

    # Try different selectors for Freshersworld
    listings = soup.find_all("div", class_="job-container") or soup.select("div[class*='job-container']") or soup.select(".job-card")
    
    if not listings:
        # Fallback: look for any div that contains job titles
        listings = soup.select("div.col-md-12.job-container") or soup.select(".inner-job-container")

    print(f"Found {len(listings)} listings")

    for job in listings:
        try:
            title_tag = job.find("span", class_="job-title") or job.find("h3") or job.select_one(".job-title")
            company_tag = job.find("span", class_="company-name") or job.select_one(".company-name")
            location_tag = job.find("span", class_="job-location") or job.select_one(".job-location")

            title = clean(title_tag.text) if title_tag else "Not specified"
            company = clean(company_tag.text) if company_tag else "Not specified"
            location = clean(location_tag.text) if location_tag else "Not specified"

            link_tag = job.find("a", href=True)
            link = link_tag.get("href") if link_tag else ""
            if link and not link.startswith("http"):
                link = "https://www.freshersworld.com" + link

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
        print("No jobs found for Freshersworld. Skipping CSV creation.")
        return
    df = pd.DataFrame(jobs)
    expected_cols = ["title", "company", "location", "salary", "skills", "link"]
    for col in expected_cols:
        if col not in df.columns:
            df[col] = "Not specified"
    df = df[expected_cols]
    df.to_csv("freshersworld_internships.csv", index=False)
    print(f"Saved {len(df)} Freshersworld jobs to freshersworld_internships.csv")


if __name__ == "__main__":
    data = scrape_freshersworld()
    save_csv(data)